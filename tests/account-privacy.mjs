import assert from 'node:assert/strict';

export async function testAccountPrivacy(context) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  try {
    await page.goto('https://www.tinkercad.com/things/account-privacy/editel');
    await page.locator('.ohmi-mascot').waitFor();
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
    await cdp.send('Runtime.enable');
    const isolated = worlds.find(world => world.origin === `chrome-extension://${extensionId}` && !world.auxData?.isDefault);
    assert.ok(isolated, 'Use the actual content-script context');
    const inWorld = async expression => {
      const result = await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression, awaitPromise: true, returnByValue: true });
      assert.equal(result.exceptionDetails, undefined);
      return result.result.value;
    };
    await inWorld(`globalThis.privacyState = {configured:true,user:null,profile:null,assignments:[],recovery:false};
      const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = async (message, ...rest) => message?.channel === 'ohmi' && message.action === 'account.state'
        ? {ok:true,data:privacyState} : nativeSend(message, ...rest);`);
    const changeAccount = async id => {
      const state = { configured: true, user: id ? { id, email: `${id}@example.test` } : null,
        profile: id ? { id, display_name: id, language: 'english' } : null, assignments: [], recovery: false };
      await inWorld(`privacyState = ${JSON.stringify(state)}`);
      await worker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ url: 'https://www.tinkercad.com/*' });
        await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { channel: 'ohmi', event: 'account.changed' })));
      });
    };
    const openChat = async () => {
      if (await page.locator('.ohmi-panel-content[data-section="chat"]').count()) return;
      await page.getByRole('button', { name: 'Ask section', exact: true }).click();
    };
    if (await page.getByRole('button', { name: 'Open OHMI assistant', exact: true }).count()) await page.locator('.ohmi-mascot').click();
    await changeAccount('student-a');
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    await page.getByText('student-a@example.test', { exact: true }).waitFor();
    await openChat();
    const question = page.getByLabel('Your demo question', { exact: true });
    await question.fill('Private question from A');
    await page.getByRole('button', { name: 'Use sample attachment', exact: true }).click();
    await page.getByRole('button', { name: 'Send demo', exact: true }).click();
    await page.locator('.ohmi-message-ohmi').waitFor();
    await question.fill('Unsent draft from A');
    await page.getByRole('button', { name: 'Use sample attachment', exact: true }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await openChat();
    await changeAccount('student-a');
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    await page.getByText('student-a@example.test', { exact: true }).waitFor();
    await openChat();
    assert.equal(await question.inputValue(), 'Unsent draft from A', 'Same-account refresh/navigation preserves draft');
    assert.equal(await page.locator('.ohmi-message').count(), 2, 'Same-account messages remain');
    assert.equal(await page.getByRole('button', { name: 'Remove sample attachment', exact: true }).count(), 1);

    await page.getByRole('button', { name: 'Send demo', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Loading a sample reply' }).waitFor();
    await changeAccount('student-b');
    await page.locator('.ohmi-panel-content[data-section="home"]').waitFor();
    await openChat();
    assert.equal(await question.inputValue(), '');
    assert.equal(await page.locator('.ohmi-message').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Remove sample attachment', exact: true }).count(), 0);
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.ohmi-message').count(), 0, 'A pending reply cannot appear for B');

    await question.fill('Unsent draft from B');
    await page.getByRole('button', { name: 'Use sample attachment', exact: true }).click();
    await changeAccount(null);
    await page.locator('.ohmi-panel-content[data-section="home"]').waitFor();
    await openChat();
    assert.equal(await question.inputValue(), '', 'Sign-out clears private draft');
    assert.equal(await page.getByRole('button', { name: 'Remove sample attachment', exact: true }).count(), 0);
    await changeAccount('student-a');
    await page.locator('.ohmi-panel-content[data-section="home"]').waitFor();
    await openChat();
    assert.equal(await page.locator('.ohmi-message').count(), 0, 'Returning to A cannot revive discarded state');

    const account = await context.newPage();
    try {
      await account.addInitScript(() => {
        const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime);
        chrome.runtime.sendMessage = async (message, ...rest) => message?.action === 'account.state'
          ? { ok: true, data: { configured: true, user: { id: 'student-a', email: 'student-a@example.test' }, profile: null, assignments: [], recovery: false } }
          : nativeSend(message, ...rest);
      });
      await account.goto(`chrome-extension://${extensionId}/account.html`);
      await account.getByRole('heading', { name: 'Your private workspace', exact: true }).waitFor();
      assert.equal(await account.getByRole('button', { name: 'Reset password', exact: true }).isDisabled(), true, 'Signed-in reset is gated too');
      assert.equal(await account.getByRole('button', { name: 'Sign out', exact: true }).isEnabled(), true);
    } finally { await account.close(); }
    console.log('PASS account privacy: A/B/sign-out resets messages, drafts, attachments and pending replies; same-account navigation/refresh preserves state. Synthetic accounts; no hosted writes.');
  } finally { await cdp.detach(); await page.close(); }
}
