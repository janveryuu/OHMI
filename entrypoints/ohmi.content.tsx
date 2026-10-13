import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createRoot } from 'react-dom/client';
import { OhmiApp } from '../src/OhmiApp';
import { isCircuitEditorUrl } from '../src/editor-url';
import { readSavedState } from '../src/placement';
import { readPreferences } from '../src/preview';
import { request } from '../src/bridge';
import '../src/ohmi.css';

export default defineContentScript({
  matches: ['https://www.tinkercad.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    let ui: { remove(): void } | undefined;
    let change = 0;

    const update = async (url: URL) => {
      const current = ++change;
      if (!isCircuitEditorUrl(url)) {
        ui?.remove();
        ui = undefined;
        return;
      }
      if (ui) return;

      const stored: Record<string, unknown> = await request<Record<string, unknown>>('local.read').catch(() => ({}));
      if (current !== change) return;
      const initial = readSavedState(stored.ohmi, { width: window.innerWidth, height: window.innerHeight });
      const imageUrl = new URL('assets/mascot/ohmi-pixel-front.png', browser.runtime.getURL('/')).href;
      const next = await createShadowRootUi(ctx, {
        name: 'ohmi-companion',
        position: 'inline',
        anchor: 'body',
        isolateEvents: ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel', 'keydown', 'keyup', 'keypress', 'input', 'change', 'submit', 'dragover', 'drop'],
        onMount(container) {
          const root = createRoot(container);
          root.render(<OhmiApp imageUrl={imageUrl} initial={initial} initialPreferences={readPreferences(stored.ohmiPreferences)} />);
          return root;
        },
        onRemove(root) { root?.unmount(); },
      });
      if (current !== change) return;
      next.mount();
      ui = next;
    };

    ctx.addEventListener(window, 'wxt:locationchange', (event) => { void update(event.newUrl); });
    ctx.onInvalidated(() => { change++; ui?.remove(); ui = undefined; });
    await update(new URL(window.location.href));
  },
});
