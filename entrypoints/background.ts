import { browser } from 'wxt/browser';
import { initializeBackend, handleRequest, publicError } from '../src/backend/service';
import { validateRequest } from '../src/backend/validation';
import { captureFromAction } from '../src/capture';

export default defineBackground(() => {
  const ready = initializeBackend();

  browser.action?.onClicked?.addListener((tab) => {
    void (async () => {
      await ready;
      await captureFromAction(tab as any);
    })();
  });

  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.channel !== 'ohmi' || message?.event) return;
    void (async () => {
      try {
        const request = validateRequest(message, sender, browser.runtime.id);
        await ready;
        respond({ ok: true, data: await handleRequest(request) });
      } catch (error) { respond({ ok: false, error: publicError(error) }); }
    })();
    return true;
  });
});
