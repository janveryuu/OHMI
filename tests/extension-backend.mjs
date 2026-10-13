import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { chromium } from 'playwright';

export async function testExtensionBackend(fixtures) {
  const profile = await mkdtemp(join(tmpdir(), 'ohmi-account-test-'));
  const extension = resolve('.output/chrome-mv3');
  const screenshots = resolve('docs/screenshots');
  let context;
  const launch = async () => {
    const next = await chromium.launchPersistentContext(profile, { headless: true, channel: process.env.OHMI_CHROMIUM_PATH ? undefined : 'chromium', executablePath: process.env.OHMI_CHROMIUM_PATH, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`], reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
    await next.route('https://www.tinkercad.com/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><title>OHMI backend fixture</title><h1>SIMULATED EDITOR · BACKEND TEST</h1>' }));
    return next;
  };
  try {
    context = await launch();
    let worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    assert.equal(id, 'ikemolangalcofljjajakagdnfdpnakh', 'Production extension retains registered callback identity');
    let account = await context.newPage();
    await account.goto(`chrome-extension://${id}/account.html`);
    const login = async (user) => {
      await account.getByLabel('Email', { exact: true }).fill(user.email);
      await account.getByLabel('Password', { exact: true }).fill(user.password);
      await account.getByRole('button', { name: 'Sign in', exact: true }).click();
      await account.getByRole('heading', { name: 'Your private workspace', exact: true }).waitFor();
      await account.getByText(user.email, { exact: true }).waitFor();
    };
    await login(fixtures[0]);
    console.log('PASS live extension sign-in and verified account view.');
    await account.getByLabel('Display name', { exact: true }).fill('Student A private workspace');
    await account.getByRole('button', { name: 'Save account name', exact: true }).click();
    await account.getByText('Account name saved.', { exact: true }).waitFor();
    const uploadUrl = 'https://vhmdgfydvoljzqztuxmu.supabase.co/storage/v1/object/ohmi-assignments/**';
    await context.route(uploadUrl, route => route.request().method() === 'POST' ? route.fulfill({ status: 503, body: 'Test upload interruption' }) : route.continue());
    await account.getByLabel('Assignment file', { exact: true }).setInputFiles({ name: 'interrupted.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nInterrupted test\n%%EOF') });
    await account.getByRole('button', { name: 'Save private assignment', exact: true }).click();
    await account.getByRole('alert').filter({ hasText: 'Upload failed' }).waitFor();
    await account.waitForFunction(() => document.querySelectorAll('.ohmi-file-list li').length === 0);
    await account.screenshot({ path: join(screenshots, 'phase-3-upload-error.png'), fullPage: true });
    await context.unroute(uploadUrl);
    console.log('PASS interrupted-upload recovery: real pending metadata cleaned through owner APIs; retry available.');
    await account.getByLabel('Assignment file', { exact: true }).setInputFiles({ name: 'private-lab.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nOHMI extension upload fixture\n%%EOF') });
    await account.getByRole('button', { name: 'Save private assignment', exact: true }).click();
    await account.getByText('Assignment saved privately. No AI analysis was performed.', { exact: true }).waitFor();
    await account.locator('.ohmi-file-list').getByText('private-lab.pdf', { exact: true }).waitFor();
    await account.screenshot({ path: join(screenshots, 'phase-3-private-account.png'), fullPage: true });
    const opened = context.waitForEvent('page');
    await account.getByRole('button', { name: 'Open file', exact: true }).click();
    const filePage = await opened;
    await filePage.waitForURL('https://vhmdgfydvoljzqztuxmu.supabase.co/storage/v1/object/sign/**');
    assert.ok(new URL(filePage.url()).searchParams.has('token'), 'Worker opens short-lived owner signed URL');
    await filePage.close();
    await account.getByRole('button', { name: 'Saved steps', exact: true }).click();
    await account.getByLabel('New assignment step', { exact: true }).fill('Explain my own circuit connections');
    await account.getByRole('button', { name: 'Add saved step', exact: true }).click();
    await account.getByRole('checkbox', { name: 'Explain my own circuit connections', exact: true }).check();
    await account.getByText('1 of 1 saved steps done', { exact: true }).waitFor();
    await account.getByRole('checkbox', { name: 'Explain my own circuit connections', exact: true }).waitFor({ state: 'visible' });
    await account.waitForFunction(() => !document.querySelector('.ohmi-step-list input').disabled);
    await account.reload();
    await account.getByRole('heading', { name: 'Your private workspace', exact: true }).waitFor();
    assert.equal(await account.getByLabel('Display name', { exact: true }).inputValue(), 'Student A private workspace', 'Name persists');
    const editor = await context.newPage();
    await editor.goto('https://www.tinkercad.com/things/private-test/editel');
    await editor.getByRole('button', { name: 'Open OHMI assistant', exact: true }).click();
    await editor.getByRole('button', { name: 'Open Settings', exact: true }).click();
    await editor.getByText(fixtures[0].email, { exact: true }).waitFor();
    await editor.getByLabel('Explanation language', { exact: true }).selectOption('taglish');
    await editor.getByRole('button', { name: 'Home', exact: true }).click();
    await editor.getByRole('button', { name: 'Assignments', exact: true }).click();
    await editor.locator('.ohmi-file-list').getByText('private-lab.pdf', { exact: true }).waitFor();
    await editor.getByRole('button', { name: 'Saved steps', exact: true }).click();
    await editor.getByText('1 of 1 saved steps done', { exact: true }).waitFor();
    await editor.screenshot({ path: join(screenshots, 'phase-3-saved-steps.png') });

    const cdp = await context.newCDPSession(editor);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
    await cdp.send('Runtime.enable');
    const isolated = worlds.find(world => world.origin === `chrome-extension://${id}` && !world.auxData?.isDefault);
    assert.ok(isolated, 'Locate the actual content-script world');
    const blockedStorage = await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression: "(async()=>{try{await chrome.storage.local.get('ohmi-auth');return false}catch{return true}})()", awaitPromise: true, returnByValue: true });
    assert.equal(blockedStorage.result.value, true, 'Content script cannot read auth storage');
    const blockedAuth = await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression: "chrome.runtime.sendMessage({channel:'ohmi',action:'auth.google',payload:{}})", awaitPromise: true, returnByValue: true });
    assert.equal(blockedAuth.result.value.ok, false, 'Content script cannot invoke sensitive auth');
    const blockedUpload = await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression: "chrome.runtime.sendMessage({channel:'ohmi',action:'files.prepare',payload:{}})", awaitPromise: true, returnByValue: true });
    assert.equal(blockedUpload.result.value.ok, false, 'Content script cannot request tokens/upload authorization');
    await cdp.detach();
    console.log('PASS live upload/steps and content-script credential isolation.');

    const oldAccount = await context.newPage();
    await oldAccount.goto(`chrome-extension://${id}/account.html`);
    await oldAccount.getByLabel('Display name', { exact: true }).fill('Stale account A input');

    await account.getByRole('button', { name: 'Sign out', exact: true }).click();
    await account.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await login(fixtures[1]);
    const stale = await oldAccount.evaluate(accountId => chrome.runtime.sendMessage({ channel: 'ohmi', action: 'profile.name', payload: { accountId, name: 'Stale account A input' } }), fixtures[0].id);
    assert.equal(stale.ok, false, 'Stale Account A action cannot write to B');
    assert.match(stale.error, /Account changed/);
    await oldAccount.getByText(fixtures[1].email, { exact: true }).waitFor();
    assert.notEqual(await oldAccount.getByLabel('Display name', { exact: true }).inputValue(), 'Stale account A input', 'Other trusted pages clear previous-account input');
    await oldAccount.close();
    assert.equal(await account.locator('.ohmi-file-list li').count(), 0, 'Account B cannot see account A file');
    await editor.bringToFront();
    await editor.getByRole('button', { name: 'Open Settings', exact: true }).click();
    await editor.getByText(fixtures[1].email, { exact: true }).waitFor();
    try { await editor.waitForFunction(() => document.querySelector('ohmi-companion').shadowRoot.querySelector('#ohmi-language').value === 'english'); }
    catch (error) { console.log('Language switch diagnostics:', await editor.getByLabel('Explanation language', { exact: true }).inputValue(), await editor.locator('.ohmi-setting').first().innerText()); throw error; }
    await account.getByRole('button', { name: 'Sign out', exact: true }).click();
    await account.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await login(fixtures[0]);
    await editor.bringToFront();
    await editor.getByText(fixtures[0].email, { exact: true }).waitFor();
    await editor.waitForFunction(() => document.querySelector('ohmi-companion').shadowRoot.querySelector('#ohmi-language').value === 'taglish');

    await worker.evaluate(async () => {
      const stored = await chrome.storage.local.get('ohmi-auth');
      const session = JSON.parse(stored['ohmi-auth']);
      session.expires_at = 1;
      await chrome.storage.local.set({ 'ohmi-auth': JSON.stringify(session) });
    });
    await context.close();
    context = await launch();
    worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    account = await context.newPage();
    await account.goto(`chrome-extension://${id}/account.html`);
    await account.getByText(fixtures[0].email, { exact: true }).waitFor();
    await account.locator('.ohmi-file-list').getByText('private-lab.pdf', { exact: true }).waitFor();
    await account.getByRole('button', { name: 'Saved steps', exact: true }).click();
    await account.getByText('1 of 1 saved steps done', { exact: true }).waitFor();
    await account.getByRole('button', { name: 'Back to assignments', exact: true }).click();
    account.on('dialog', dialog => dialog.accept());
    await account.getByRole('button', { name: 'Delete', exact: true }).click();
    await account.waitForFunction(() => document.querySelectorAll('.ohmi-file-list li').length === 0);
    await account.getByRole('button', { name: 'Sign out', exact: true }).click();
    await account.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    console.log('PASS LIVE extension worker/UI: login/logout, private XHR upload, saved name/steps/language, account isolation/switches, session restoration/refresh after restart, deletion, trusted-storage and sensitive-message denial.');
  } finally {
    await context?.close();
    assert.equal(dirname(profile), resolve(tmpdir()));
    assert.ok(basename(profile).startsWith('ohmi-account-test-'));
    await rm(profile, { recursive: true, force: true });
  }
}
