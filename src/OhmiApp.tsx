import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './bridge';
import { clampMascot, fitMascotForPanel, MASCOT_SIZE, panelRect, type Point, type SavedState } from './placement';
import { AssistantPanel } from './AssistantPanel';
import type { Motion, Preferences } from './preview';
import { useAccount } from './useAccount';

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
const directions: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function OhmiApp({ imageUrl, initial, initialPreferences }: { imageUrl: string; initial: SavedState; initialPreferences: Preferences }) {
  const [position, setPosition] = useState(initial.position);
  const [open, setOpen] = useState(initial.open);
  const [screen, setScreen] = useState(viewport);
  const mascotRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ start: Point; origin: Point; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const previousOpen = useRef(open);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [preferenceError, setPreferenceError] = useState(false);
  const [motion, setMotion] = useState<Motion>('idle');
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionTimer = useRef<number | undefined>(undefined);
  const account = useAccount();

  useEffect(() => {
    const language = account.state.profile?.language;
    if (!language) return;
    setPreferences((current) => {
      if (current.language === language) return current;
      const next = { ...current, language };
      void request('local.preferences', next).catch(() => setPreferenceError(true));
      return next;
    });
  }, [account.state.user?.id, account.state.profile?.language]);

  const reactTo = useCallback((next: Motion) => {
    window.clearTimeout(motionTimer.current);
    setMotion(next);
    if (next !== 'idle') motionTimer.current = window.setTimeout(() => setMotion('idle'), next === 'happy' ? 900 : 1800);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setSystemReducedMotion(media.matches);
    media.addEventListener('change', changed);
    return () => { media.removeEventListener('change', changed); window.clearTimeout(motionTimer.current); };
  }, []);

  useEffect(() => {
    if (!preferences.animations || systemReducedMotion) reactTo('idle');
  }, [preferences.animations, systemReducedMotion, reactTo]);

  const savePreferences = (next: Preferences) => {
    setPreferences(next);
    setPreferenceError(false);
    void request('local.preferences', next).catch(() => setPreferenceError(true));
    if (account.state.user && next.language !== account.state.profile?.language) {
      void request('profile.language', { accountId: account.state.user.id, language: next.language }).then(() => account.refresh()).catch(() => setPreferenceError(true));
    }
  };

  const save = (next: SavedState) => {
    void request('local.position', next).catch((error: unknown) => console.warn('OHMI could not save its position:', error));
  };

  useEffect(() => {
    const resize = () => {
      const nextScreen = viewport();
      setScreen(nextScreen);
      setPosition((current) => {
        const next = open ? fitMascotForPanel(current, nextScreen) : clampMascot(current, nextScreen);
        if (next.x !== current.x || next.y !== current.y) save({ position: next, open });
        return next;
      });
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [open]);

  useEffect(() => {
    if (previousOpen.current !== open) {
      if (open) closeRef.current?.focus();
      else mascotRef.current?.focus();
      previousOpen.current = open;
    }
  }, [open]);

  const setPanelOpen = (next: boolean) => {
    const nextPosition = next ? fitMascotForPanel(position, screen) : position;
    setPosition(nextPosition);
    setOpen(next);
    save({ position: nextPosition, open: next });
    if (next) reactTo('happy');
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    suppressClick.current = false;
    drag.current = {
      start: { x: event.clientX, y: event.clientY },
      origin: position,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active) return;
    const deltaX = event.clientX - active.start.x;
    const deltaY = event.clientY - active.start.y;
    if (!active.moved && Math.hypot(deltaX, deltaY) < 5) return;
    active.moved = true;
    setPosition(clampMascot({ x: active.origin.x + deltaX, y: active.origin.y + deltaY }, viewport()));
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active.moved) {
      const released = event.type === 'pointercancel' ? position : clampMascot({
        x: active.origin.x + event.clientX - active.start.x,
        y: active.origin.y + event.clientY - active.start.y,
      }, viewport());
      const next = open ? fitMascotForPanel(released, viewport()) : released;
      setPosition(next);
      save({ position: next, open });
      suppressClick.current = event.type !== 'pointercancel';
    }
  };

  const rect = panelRect(position, screen);

  return (
    <div className={`ohmi-root${!preferences.animations || systemReducedMotion ? ' ohmi-static' : ''}`} data-appearance={preferences.appearance}>
        <section
          id="ohmi-panel"
          className={`ohmi-panel${open ? ' ohmi-panel-open' : ''}`}
          role="dialog"
          aria-modal="false"
          aria-labelledby="ohmi-title"
          aria-hidden={!open}
          inert={!open}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setPanelOpen(false);
            }
          }}
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, maxHeight: rect.height }}
        >
          <AssistantPanel imageUrl={imageUrl} preferences={preferences} onPreferencesChange={savePreferences} onMotion={reactTo} onClose={() => setPanelOpen(false)} closeRef={closeRef} open={open} systemReducedMotion={systemReducedMotion} preferenceError={preferenceError} account={account} />
        </section>

      <button
        ref={mascotRef}
        className={`ohmi-mascot ohmi-motion-${motion}${open ? ' ohmi-mascot-open' : ''}`}
        type="button"
        aria-label={open ? 'Minimize OHMI assistant' : 'Open OHMI assistant'}
        aria-expanded={open}
        aria-controls="ohmi-panel"
        title="Click to open or minimize. Drag to move. Use arrow keys when focused."
        aria-describedby="ohmi-move-help"
        style={{ left: position.x, top: position.y, width: MASCOT_SIZE, height: MASCOT_SIZE }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={(event) => {
          const direction = directions[event.key];
          if (direction) {
            event.preventDefault();
            const step = event.shiftKey ? 1 : 10;
            const moved = { x: position.x + direction[0] * step, y: position.y + direction[1] * step };
            const next = open ? fitMascotForPanel(moved, screen) : clampMascot(moved, screen);
            setPosition(next);
            save({ position: next, open });
          } else if (event.key === 'Escape' && open) setPanelOpen(false);
        }}
        onClick={(event) => {
          const skipPointerClick = suppressClick.current && event.detail !== 0;
          suppressClick.current = false;
          if (skipPointerClick) return;
          setPanelOpen(!open);
        }}
      >
        <img src={imageUrl} alt="" width={MASCOT_SIZE} height={MASCOT_SIZE} draggable={false} />
      </button>
      <span id="ohmi-move-help" className="ohmi-sr-only">Drag to move OHMI, or use arrow keys when focused. Hold Shift for smaller steps.</span>
    </div>
  );
}
