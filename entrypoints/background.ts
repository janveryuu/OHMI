import { browser } from 'wxt/browser';
import { initializeBackend, handleRequest, publicError } from '../src/backend/service';
import { validateRequest } from '../src/backend/validation';

export default defineBackground(() => {
  const ready = initializeBackend();
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.channel !== 'ohmi' || message?.event) return;
    void (async () => {
      try {
        const request = validateRequest(message, sender, browser.runtime.id);
        await ready;
        respond({ ok: true, data: await handleRequest(request) });
      } catch (error) { const code=(error as {code?:string})?.code; respond({ ok: false, error: publicError(error), ...(code==='AI_RETRY_NEW'||code==='AI_RETRY_SAME'?{code}:{}) }); }
    })();
    return true;
  });
});
