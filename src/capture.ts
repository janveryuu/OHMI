import { isCircuitEditorUrl } from './editor-url';

export interface PendingCaptureHandoff {
  captureId: string;
  dataUrl: string;
  createdAt: number;
  expiresAt: number;
  ownerId: string | null;
  documentGeneration: string;
  claimed: boolean;
  reviewTabId?: number;
}

export const CAPTURE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const HIDE_TIMEOUT_MS = 2000; // 2 seconds
export const WATCHDOG_TIMEOUT_MS = 3000; // 3 seconds

let isCapturing = false;

// Mockable dependencies for testing
export interface CaptureDependencies {
  windowsGet: (windowId: number) => Promise<{ focused: boolean }>;
  tabsGet?: (tabId: number) => Promise<any>;
  captureVisibleTab: (windowId: number, options: { format: string }) => Promise<string>;
  sendMessage: (tabId: number, message: any, options?: { frameId?: number }) => Promise<any>;
  createTab: (options: { url: string }) => Promise<{ id?: number }>;
  storageSessionGet: (key: string) => Promise<any>;
  storageSessionSet: (items: Record<string, any>) => Promise<void>;
  storageSessionRemove: (key: string) => Promise<void>;
  storageLocalGet: (key: string) => Promise<any>;
  storageLocalSet: (items: Record<string, any>) => Promise<void>;
  getCurrentUser?: () => Promise<{ id: string } | null>;
  addTabActivatedListener?: (listener: (activeInfo: { tabId: number; windowId: number }) => void) => () => void;
  addTabUpdatedListener?: (listener: (tabId: number, changeInfo: { url?: string; status?: string }) => void) => () => void;
  getURL?: (path: string) => string;
  hideTimeoutMs?: number;
}

const defaultDependencies = (): CaptureDependencies => ({
  windowsGet: async (windowId) => (window as any).browser?.windows?.get(windowId) ?? (window as any).chrome?.windows?.get(windowId),
  captureVisibleTab: async (windowId, options) => {
    const api = (window as any).browser?.tabs ?? (window as any).chrome?.tabs;
    return api.captureVisibleTab(windowId, options);
  },
  sendMessage: async (tabId, message, options) => {
    const api = (window as any).browser?.tabs ?? (window as any).chrome?.tabs;
    return api.sendMessage(tabId, message, options);
  },
  createTab: async (options) => {
    const api = (window as any).browser?.tabs ?? (window as any).chrome?.tabs;
    return api.create(options);
  },
  storageSessionGet: async (key) => {
    const storage = (window as any).browser?.storage?.session ?? (window as any).chrome?.storage?.session;
    const res = await storage?.get(key);
    return res?.[key];
  },
  storageSessionSet: async (items) => {
    const storage = (window as any).browser?.storage?.session ?? (window as any).chrome?.storage?.session;
    return storage?.set(items);
  },
  storageSessionRemove: async (key) => {
    const storage = (window as any).browser?.storage?.session ?? (window as any).chrome?.storage?.session;
    return storage?.remove(key);
  },
  storageLocalGet: async (key) => {
    const storage = (window as any).browser?.storage?.local ?? (window as any).chrome?.storage?.local;
    const res = await storage?.get(key);
    return res?.[key];
  },
  storageLocalSet: async (items) => {
    const storage = (window as any).browser?.storage?.local ?? (window as any).chrome?.storage?.local;
    return storage?.set(items);
  },
  addTabActivatedListener: (listener) => {
    const api = (window as any).browser?.tabs?.onActivated ?? (window as any).chrome?.tabs?.onActivated;
    api?.addListener(listener);
    return () => api?.removeListener(listener);
  },
  addTabUpdatedListener: (listener) => {
    const api = (window as any).browser?.tabs?.onUpdated ?? (window as any).chrome?.tabs?.onUpdated;
    api?.addListener(listener);
    return () => api?.removeListener(listener);
  },
  getURL: (path) => {
    const api = (window as any).browser?.runtime ?? (window as any).chrome?.runtime;
    return api?.getURL?.(path) ?? path;
  },
});

export async function captureFromAction(
  tab: { id?: number; windowId?: number; url?: string; active?: boolean; status?: string; discarded?: boolean; incognito?: boolean },
  deps: CaptureDependencies = defaultDependencies()
): Promise<{ ok: boolean; captureId?: string; introShown?: boolean; error?: string }> {
  // 1. Validate tab and window
  if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    return { ok: false, error: 'Unsupported tab: missing tab or window ID.' };
  }
  if (tab.incognito) {
    return { ok: false, error: 'Incognito capture is not supported.' };
  }
  if (tab.status === 'loading' || tab.discarded) {
    return { ok: false, error: 'Cannot capture a loading or discarded tab.' };
  }
  if (!tab.active) {
    return { ok: false, error: 'Cannot capture an inactive tab.' };
  }
  if (!tab.url) {
    return { ok: false, error: 'Missing tab URL.' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(tab.url);
  } catch {
    return { ok: false, error: 'Invalid tab URL.' };
  }

  if (!isCircuitEditorUrl(parsedUrl)) {
    return { ok: false, error: 'Capture is only supported in the Tinkercad Circuits editor.' };
  }

  // 2. Validate window focus
  try {
    const win = await deps.windowsGet(tab.windowId);
    if (!win || !win.focused) {
      return { ok: false, error: 'Window must be focused to capture visible circuit.' };
    }
  } catch (err: any) {
    return { ok: false, error: `Failed to verify window focus: ${err.message || err}` };
  }

  // 3. Concurrency check
  if (isCapturing) {
    return { ok: false, error: 'A circuit capture is already in progress.' };
  }
  isCapturing = true;

  // 4. First-use explanation check
  try {
    const explained = await deps.storageLocalGet('ohmi_capture_explained');
    if (!explained) {
      await deps.storageLocalSet({ ohmi_capture_explained: true });
      const introUrl = deps.getURL ? deps.getURL('/check.html?intro=1#capture-intro') : '/check.html?intro=1#capture-intro';
      await deps.createTab({ url: introUrl });
      return { ok: true, introShown: true };
    }
  } catch (err: any) {
    // If storage fails, proceed cautiously
  }

  const nonce = crypto.randomUUID();
  let invalidated = false;
  let unsubscribeActivated: (() => void) | undefined;
  let unsubscribeUpdated: (() => void) | undefined;

  // Setup tab switch & navigation race listeners
  if (deps.addTabActivatedListener) {
    unsubscribeActivated = deps.addTabActivatedListener((activeInfo) => {
      if (activeInfo.tabId !== tab.id || activeInfo.windowId !== tab.windowId) {
        invalidated = true;
      }
    });
  }
  if (deps.addTabUpdatedListener) {
    unsubscribeUpdated = deps.addTabUpdatedListener((updatedTabId, changeInfo) => {
      if (updatedTabId === tab.id && (changeInfo.url || changeInfo.status === 'loading')) {
        invalidated = true;
      }
    });
  }

  let documentGeneration = '0';

  try {
    // 5. Send capture:hide to content script with 2s timeout
    const hidePromise = deps.sendMessage(tab.id, {
      channel: 'ohmi-internal',
      action: 'capture:hide',
      nonce,
    }, { frameId: 0 });

    const timeoutMs = deps.hideTimeoutMs ?? HIDE_TIMEOUT_MS;
    const timeoutPromise = new Promise<{ ok: false; error: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Hide overlay timeout: companion did not acknowledge within 2 seconds.')), timeoutMs);
    });

    const hideResponse = await Promise.race([hidePromise, timeoutPromise]) as { ok: boolean; documentGeneration?: string; error?: string };
    if (!hideResponse?.ok) {
      throw new Error(hideResponse?.error || 'Content script failed to hide overlay.');
    }
    documentGeneration = hideResponse.documentGeneration ?? '0';

    // 6. Verify tab is still active and valid
    if (invalidated) {
      throw new Error('Capture invalidated: tab was switched or navigated during preparation.');
    }

    const winCheck = await deps.windowsGet(tab.windowId);
    if (!winCheck || !winCheck.focused) {
      throw new Error('Capture invalidated: window lost focus during preparation.');
    }

    // 7. Perform captureVisibleTab
    const dataUrl = await deps.captureVisibleTab(tab.windowId, { format: 'png' });

    // Check again after capture
    if (invalidated) {
      throw new Error('Capture invalidated: tab was switched or navigated during capture.');
    }

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new Error('Capture failed to produce valid image data.');
    }

    // 8. Create pending handoff
    const captureId = crypto.randomUUID();
    const now = Date.now();
    let currentUserId: string | null = null;
    if (deps.getCurrentUser) {
      try {
        const u = await deps.getCurrentUser();
        currentUserId = u?.id ?? null;
      } catch {
        currentUserId = null;
      }
    }

    const handoff: PendingCaptureHandoff = {
      captureId,
      dataUrl,
      createdAt: now,
      expiresAt: now + CAPTURE_TTL_MS,
      ownerId: currentUserId,
      documentGeneration,
      claimed: false,
    };

    // Save handoff to trusted session storage
    await deps.storageSessionSet({ ohmi_pending_capture: handoff });

    // 9. Open review tab and bind reviewTabId
    const checkUrl = deps.getURL ? deps.getURL(`/check.html#capture=${captureId}`) : `/check.html#capture=${captureId}`;
    const reviewTab = await deps.createTab({ url: checkUrl });
    if (reviewTab?.id) {
      handoff.reviewTabId = reviewTab.id;
      await deps.storageSessionSet({ ohmi_pending_capture: handoff });
    }

    return { ok: true, captureId };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    // 10. Always restore overlay in finally
    try {
      await deps.sendMessage(tab.id, {
        channel: 'ohmi-internal',
        action: 'capture:restore',
        nonce,
      }, { frameId: 0 });
    } catch {
      // Content script watchdog will also recover if message delivery fails
    }

    if (unsubscribeActivated) unsubscribeActivated();
    if (unsubscribeUpdated) unsubscribeUpdated();
    isCapturing = false;
  }
}

export async function claimPendingCapture(
  callerTabId: number,
  callerAccountId: string | null | undefined,
  deps: CaptureDependencies = defaultDependencies()
): Promise<{ captureId: string; dataUrl: string; createdAt: number; documentGeneration: string }> {
  const handoff = (await deps.storageSessionGet('ohmi_pending_capture')) as PendingCaptureHandoff | undefined;
  if (!handoff || handoff.claimed) {
    throw new Error('No pending capture available.');
  }

  const now = Date.now();
  if (now > handoff.expiresAt) {
    await deps.storageSessionRemove('ohmi_pending_capture');
    throw new Error('Capture has expired. Please take a new capture.');
  }

  if (typeof handoff.reviewTabId === 'number' && handoff.reviewTabId !== callerTabId) {
    throw new Error('Capture belongs to a different review tab.');
  }

  if (handoff.ownerId !== null && callerAccountId !== undefined && handoff.ownerId !== callerAccountId) {
    throw new Error('Capture belongs to a different account.');
  }

  // Mark claimed and delete from session storage immediately
  handoff.claimed = true;
  await deps.storageSessionRemove('ohmi_pending_capture');

  return {
    captureId: handoff.captureId,
    dataUrl: handoff.dataUrl,
    createdAt: handoff.createdAt,
    documentGeneration: handoff.documentGeneration,
  };
}
