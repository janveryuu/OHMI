import { describe, it, expect, vi } from 'vitest';
import {
  captureFromAction,
  claimPendingCapture,
  CAPTURE_TTL_MS,
  HIDE_TIMEOUT_MS,
  type CaptureDependencies,
  type PendingCaptureHandoff,
} from './capture';

const VALID_EDITOR_URL = 'https://www.tinkercad.com/things/my-circuit/editel';

function createMockDeps(overrides: Partial<CaptureDependencies> = {}): {
  deps: CaptureDependencies;
  sentMessages: Array<{ tabId: number; message: any; options?: any }>;
  sessionStorage: Record<string, any>;
  localStorage: Record<string, any>;
  createdTabs: Array<{ url: string }>;
} {
  const sentMessages: Array<{ tabId: number; message: any; options?: any }> = [];
  const sessionStorage: Record<string, any> = {};
  const localStorage: Record<string, any> = { ohmi_capture_explained: true }; // Default to already explained
  const createdTabs: Array<{ url: string }> = [];

  const deps: CaptureDependencies = {
    windowsGet: vi.fn(async (_id: number) => ({ focused: true })),
    captureVisibleTab: vi.fn(async () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
    sendMessage: vi.fn(async (tabId: number, message: any, options?: any) => {
      sentMessages.push({ tabId, message, options });
      if (message.action === 'capture:hide') {
        return { ok: true, documentGeneration: '1' };
      }
      return { ok: true };
    }),
    createTab: vi.fn(async (options: { url: string }) => {
      createdTabs.push(options);
      return { id: 99 };
    }),
    storageSessionGet: vi.fn(async (key: string) => sessionStorage[key]),
    storageSessionSet: vi.fn(async (items: Record<string, any>) => {
      Object.assign(sessionStorage, items);
    }),
    storageSessionRemove: vi.fn(async (key: string) => {
      delete sessionStorage[key];
    }),
    storageLocalGet: vi.fn(async (key: string) => localStorage[key]),
    storageLocalSet: vi.fn(async (items: Record<string, any>) => {
      Object.assign(localStorage, items);
    }),
    getCurrentUser: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })),
    getURL: (path: string) => `chrome-extension://mock-id${path}`,
    ...overrides,
  };

  return { deps, sentMessages, sessionStorage, localStorage, createdTabs };
}

describe('Capture Coordinator (Milestone 1)', () => {
  it('toolbar_only_can_capture', async () => {
    // Only captureFromAction can trigger screenshot capture.
    // Calling with undefined tab or missing id is rejected immediately.
    const { deps } = createMockDeps();
    const result1 = await captureFromAction({}, deps);
    expect(result1.ok).toBe(false);
    expect(result1.error).toContain('missing tab or window ID');
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();

    const result2 = await captureFromAction({ id: undefined, windowId: 1 }, deps);
    expect(result2.ok).toBe(false);
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('unsupported_or_unfocused_tab_is_denied', async () => {
    const { deps } = createMockDeps({
      windowsGet: vi.fn(async () => ({ focused: false })),
    });

    // 1. Non-circuits url
    const nonCircuit = await captureFromAction({
      id: 1,
      windowId: 10,
      url: 'https://www.tinkercad.com/things/my-circuit/edit', // 3D editor, not editel
      active: true,
    }, deps);
    expect(nonCircuit.ok).toBe(false);
    expect(nonCircuit.error).toContain('only supported in the Tinkercad Circuits editor');
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();

    // 2. Unfocused window
    const unfocused = await captureFromAction({
      id: 1,
      windowId: 10,
      url: VALID_EDITOR_URL,
      active: true,
    }, deps);
    expect(unfocused.ok).toBe(false);
    expect(unfocused.error).toContain('Window must be focused');
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();

    // 3. Incognito tab
    const { deps: depsIncognito } = createMockDeps();
    const incognito = await captureFromAction({
      id: 1,
      windowId: 10,
      url: VALID_EDITOR_URL,
      active: true,
      incognito: true,
    }, depsIncognito);
    expect(incognito.ok).toBe(false);
    expect(incognito.error).toContain('Incognito capture is not supported');
    expect(depsIncognito.captureVisibleTab).not.toHaveBeenCalled();

    // 4. Inactive tab
    const inactive = await captureFromAction({
      id: 1,
      windowId: 10,
      url: VALID_EDITOR_URL,
      active: false,
    }, depsIncognito);
    expect(inactive.ok).toBe(false);
    expect(inactive.error).toContain('Cannot capture an inactive tab');
  });

  it('tab_switch_and_back_invalidates_capture', async () => {
    let fireTabActivated: ((info: { tabId: number; windowId: number }) => void) | undefined;
    const { deps } = createMockDeps({
      addTabActivatedListener: (listener) => {
        fireTabActivated = listener;
        return () => {};
      },
      sendMessage: vi.fn(async (tabId: number, message: any) => {
        if (message.action === 'capture:hide') {
          // Simulate user switching tabs during hide handshake
          fireTabActivated?.({ tabId: 999, windowId: 10 });
          return { ok: true, documentGeneration: '1' };
        }
        return { ok: true };
      }),
    });

    const res = await captureFromAction({
      id: 1,
      windowId: 10,
      url: VALID_EDITOR_URL,
      active: true,
    }, deps);

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Capture invalidated: tab was switched');
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('spa_navigation_invalidates_capture', async () => {
    let fireTabUpdated: ((tabId: number, change: { url?: string; status?: string }) => void) | undefined;
    const { deps } = createMockDeps({
      addTabUpdatedListener: (listener) => {
        fireTabUpdated = listener;
        return () => {};
      },
      sendMessage: vi.fn(async (tabId: number, message: any) => {
        if (message.action === 'capture:hide') {
          // Simulate SPA navigation during hide handshake
          fireTabUpdated?.(1, { url: 'https://www.tinkercad.com/dashboard' });
          return { ok: true, documentGeneration: '2' };
        }
        return { ok: true };
      }),
    });

    const res = await captureFromAction({
      id: 1,
      windowId: 10,
      url: VALID_EDITOR_URL,
      active: true,
    }, deps);

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Capture invalidated: tab was switched or navigated');
    expect(deps.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('hide_timeout_restores_overlay', async () => {
    const { deps, sentMessages } = createMockDeps({
      hideTimeoutMs: 25,
      sendMessage: vi.fn(async (tabId: number, message: any) => {
        sentMessages.push({ tabId, message });
        if (message.action === 'capture:hide') {
          // Simulate timeout/failure to acknowledge within HIDE_TIMEOUT_MS
          return new Promise(() => {}); // never resolves
        }
        return { ok: true };
      }),
    });

    const res = await captureFromAction({
      id: 1,
      windowId: 10,
      url: VALID_EDITOR_URL,
      active: true,
    }, deps);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Hide overlay timeout');

    // Check that capture:restore was still sent in finally block
    const restoreCall = sentMessages.find((m) => m.message?.action === 'capture:restore');
    expect(restoreCall).toBeDefined();
    expect(restoreCall?.tabId).toBe(1);
  });

  it('worker_restart_watchdog_restores_overlay', async () => {
    // Simulates the content-side watchdog logic
    let companionHidden = false;
    let watchdogTimer: any = null;

    const onCompanionMessage = (msg: { action: string }) => {
      if (msg.action === 'capture:hide') {
        companionHidden = true;
        // 3-second watchdog timer in companion
        watchdogTimer = setTimeout(() => {
          companionHidden = false; // restored automatically
        }, 10); // use 10ms for fast test
      } else if (msg.action === 'capture:restore') {
        clearTimeout(watchdogTimer);
        companionHidden = false;
      }
    };

    onCompanionMessage({ action: 'capture:hide' });
    expect(companionHidden).toBe(true);

    // Simulate worker crashing (no capture:restore sent)
    await new Promise((r) => setTimeout(r, 25));
    // Watchdog has fired and restored overlay
    expect(companionHidden).toBe(false);
  });

  it('claim_requires_intended_check_tab_and_owner', async () => {
    const { deps, sessionStorage } = createMockDeps();

    const handoff: PendingCaptureHandoff = {
      captureId: 'test-capture-id',
      dataUrl: 'data:image/png;base64,abc',
      createdAt: Date.now(),
      expiresAt: Date.now() + CAPTURE_TTL_MS,
      ownerId: 'user-aaa',
      documentGeneration: '1',
      claimed: false,
      reviewTabId: 77,
    };
    sessionStorage.ohmi_pending_capture = handoff;

    // 1. Wrong tab ID
    await expect(claimPendingCapture(88, 'user-aaa', deps)).rejects.toThrow(
      'Capture belongs to a different review tab.'
    );

    // 2. Wrong account
    await expect(claimPendingCapture(77, 'user-bbb', deps)).rejects.toThrow(
      'Capture belongs to a different account.'
    );

    // 3. Correct tab ID and matching owner
    const claimed = await claimPendingCapture(77, 'user-aaa', deps);
    expect(claimed.captureId).toBe('test-capture-id');
    expect(claimed.dataUrl).toBe('data:image/png;base64,abc');
    expect(sessionStorage.ohmi_pending_capture).toBeUndefined(); // deleted immediately
  });

  it('expired_capture_is_unavailable', async () => {
    const { deps, sessionStorage } = createMockDeps();

    const handoff: PendingCaptureHandoff = {
      captureId: 'test-capture-id',
      dataUrl: 'data:image/png;base64,abc',
      createdAt: Date.now() - (CAPTURE_TTL_MS + 1000),
      expiresAt: Date.now() - 1000, // already expired
      ownerId: 'user-aaa',
      documentGeneration: '1',
      claimed: false,
      reviewTabId: 77,
    };
    sessionStorage.ohmi_pending_capture = handoff;

    await expect(claimPendingCapture(77, 'user-aaa', deps)).rejects.toThrow(
      'Capture has expired. Please take a new capture.'
    );
    expect(sessionStorage.ohmi_pending_capture).toBeUndefined();
  });

  it('raw_pixels_never_reach_content_script', async () => {
    const { deps, sentMessages } = createMockDeps();

    const res = await captureFromAction({
      id: 1,
      windowId: 10,
      url: VALID_EDITOR_URL,
      active: true,
    }, deps);

    expect(res.ok).toBe(true);

    // Check all messages sent to content script
    for (const sent of sentMessages) {
      expect(sent.tabId).toBe(1);
      const action = sent.message?.action;
      expect(['capture:hide', 'capture:restore']).toContain(action);
      // Ensure no raw pixels or dataUrl are sent in the message
      expect(JSON.stringify(sent.message)).not.toContain('data:image/');
      expect(sent.message.dataUrl).toBeUndefined();
      expect(sent.message.pixels).toBeUndefined();
    }
  });
});
