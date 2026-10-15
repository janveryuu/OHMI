import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { chromium } from 'playwright';
import { testPhase2 } from './phase2.mjs';
import { testPhase3 } from './phase3.mjs';
import { testAccountPrivacy } from './account-privacy.mjs';

const extension = resolve('.output/chrome-mv3');
const screenshots = resolve(process.env.OHMI_SCREENSHOTS_DIR || '.superpowers/stabilization-2026-10-15/screenshots');
const profile = await mkdtemp(join(tmpdir(), 'ohmi-browser-'));
const errors = [];
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  channel: process.env.OHMI_CHROMIUM_PATH ? undefined : 'chromium',
  executablePath: process.env.OHMI_CHROMIUM_PATH,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  viewport: { width: 1280, height: 800 },
  hasTouch: true,
  reducedMotion: 'reduce',
});

try {
  await mkdir(screenshots, { recursive: true });
  await context.route('https://www.tinkercad.com/**', (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>OHMI isolated browser test</title>
      <style>body{margin:0;background:#e9eef0;color:#39545b;font:14px system-ui}header{padding:20px;background:white;border-bottom:1px solid #ccd6da}main{position:fixed;inset:60px 0 0;z-index:100;background:#e9eef0;padding:32px}button,input{padding:10px}</style></head>
      <body><header>LOCAL TEST FIXTURE · SIMULATED CIRCUITS EDITOR</header><main>
      <h1>OHMI interaction test</h1><p>This page tests extension behavior. It is not the real Tinkercad editor.</p>
      <button id="host-button" onclick="this.textContent='Host click works'">Test host click</button>
      <input aria-label="Host keyboard test" placeholder="Test host keyboard" /></main>
      <script>window.hostKeys=0;document.addEventListener('keydown',()=>window.hostKeys++);</script></body></html>`,
  }));

  const page = context.pages()[0] ?? await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('https://www.tinkercad.com/things/ohmi-test/editel');
  await page.waitForLoadState('networkidle');
  const mascot = page.locator('.ohmi-mascot');
  await mascot.waitFor();
  assert.equal(await mascot.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button.getRootNode().host;
  }), true, 'Mascot is above the positioned editor workspace');
  assert.equal(await page.locator('.ohmi-mascot img').evaluate((image) => image.complete && image.naturalWidth > 0), true, 'Approved image loads');
  await page.getByRole('button', { name: 'Test host click' }).click();
  await page.getByRole('textbox', { name: 'Host keyboard test' }).fill('Circuit editing still works');
  await page.getByRole('textbox', { name: 'Host keyboard test' }).press('End');
  assert.ok(await page.evaluate(() => window.hostKeys) > 0, 'Closed OHMI leaves host keyboard events available');
  assert.equal(await page.getByRole('textbox').inputValue(), 'Circuit editing still works');

  await mascot.click();
  await page.getByRole('dialog', { name: 'OHMI', exact: true }).waitFor();
  assert.equal(await page.locator('.ohmi-feature').count(), 4);
  await page.getByRole('button', { name: 'Ask OHMI', exact: true }).waitFor({ timeout: 1000 });
  const isolatedFont = await page.locator('.ohmi-brand h2').evaluate((element) => getComputedStyle(element).fontSize);
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'host-style-test';
    style.textContent = 'button,h2{font-size:72px!important;color:magenta!important}';
    document.head.append(style);
  });
  assert.equal(await page.locator('.ohmi-brand h2').evaluate((element) => getComputedStyle(element).fontSize), isolatedFont, 'Host styles do not enter Shadow DOM');
  await page.evaluate(() => document.getElementById('host-style-test').remove());
  assert.equal(await page.getByRole('button', { name: 'Minimize OHMI', exact: true }).evaluate((button) => button.getRootNode().activeElement === button), true, 'Open focuses minimize');
  const hostKeys = await page.evaluate(() => window.hostKeys);
  await page.keyboard.press('Escape');
  assert.equal(await mascot.getAttribute('aria-expanded'), 'false');
  assert.equal(await mascot.evaluate((button) => button.getRootNode().activeElement === button), true, 'Close returns focus');
  assert.equal(await page.evaluate(() => window.hostKeys), hostKeys, 'Panel keyboard events stay isolated');
  const keyboardStart = await mascot.boundingBox();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((x) => Number.parseFloat(document.querySelector('ohmi-companion').shadowRoot.querySelector('.ohmi-mascot').style.left) === x + 10, keyboardStart.x);

  const before = await mascot.boundingBox();
  await page.mouse.move(before.x + 44, before.y + 44);
  await page.mouse.down();
  await page.mouse.move(900, 720, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => Number.parseFloat(document.querySelector('ohmi-companion').shadowRoot.querySelector('.ohmi-mascot').style.left) > 800);
  assert.equal(await mascot.getAttribute('aria-expanded'), 'false', 'Drag does not open panel');
  const dragged = await mascot.boundingBox();
  assert.ok(dragged.x > 800, 'Mascot moves');
  await page.reload();
  await mascot.waitFor();
  const restored = await mascot.boundingBox();
  assert.equal(restored.x, dragged.x, 'Position survives reload');
  assert.equal(restored.y, dragged.y, 'Position survives reload');
  await mascot.click();
  await page.reload();
  await page.getByRole('dialog', { name: 'OHMI', exact: true }).waitFor();
  assert.equal(await mascot.getAttribute('aria-expanded'), 'true', 'Panel state survives reload');
  await page.screenshot({ path: join(screenshots, 'phase-1-desktop.png') });

  await page.setViewportSize({ width: 320, height: 400 });
  await page.waitForFunction(() => {
    const panel = document.querySelector('ohmi-companion')?.shadowRoot?.querySelector('.ohmi-panel');
    return panel && panel.getBoundingClientRect().right <= 320;
  });
  const panel = page.locator('.ohmi-panel');
  const small = await panel.boundingBox();
  assert.ok(small.x >= 0 && small.y >= 0 && small.x + small.width <= 320 && small.y + small.height <= 400, 'Small panel stays in viewport');
  assert.equal(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth), true, 'No horizontal panel overflow');
  assert.equal(await mascot.evaluate((button) => getComputedStyle(button.querySelector('img')).animationName), 'none', 'Reduced motion applies');
  const smallMascot = await mascot.boundingBox();
  assert.ok(small.y + small.height <= smallMascot.y || smallMascot.y + smallMascot.height <= small.y || small.x + small.width <= smallMascot.x || smallMascot.x + smallMascot.width <= small.x, 'Panel does not cover mascot');
  await page.locator('.ohmi-panel-content').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  assert.equal(await page.getByRole('button', { name: 'Minimize OHMI', exact: true }).isVisible(), true, 'Minimize stays available while scrolling');
  await page.locator('.ohmi-panel-content').evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: join(screenshots, 'phase-1-small.png') });

  await page.evaluate(() => history.pushState({}, '', '/circuits'));
  await mascot.waitFor({ state: 'detached' });
  await page.evaluate(() => history.pushState({}, '', '/things/ohmi-test/edit'));
  assert.equal(await mascot.count(), 0, 'No mascot on 3D editor');
  await page.evaluate(() => history.pushState({}, '', '/things/ohmi-test/editel'));
  await mascot.waitFor();
  assert.equal(await mascot.count(), 1, 'SPA return mounts one mascot');
  await page.getByRole('button', { name: 'Minimize OHMI', exact: true }).click();
  const touchStart = await mascot.boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchStart.x + 44, y: touchStart.y + 44 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 90 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => Number.parseFloat(document.querySelector('ohmi-companion').shadowRoot.querySelector('.ohmi-mascot').style.top) < 100);
  assert.equal(await mascot.getAttribute('aria-expanded'), 'false', 'Touch drag does not open panel');
  await mascot.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'OHMI', exact: true }).waitFor({ timeout: 1000 });
  await page.keyboard.press('Escape');
  const cancelStart = await mascot.boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cancelStart.x + 44, y: cancelStart.y + 44 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 120 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await mascot.click();
  await page.getByRole('dialog', { name: 'OHMI', exact: true }).waitFor();
  await testPhase2(page, screenshots);
  await testPhase3(context, page, screenshots);
  await testAccountPrivacy(context);
  assert.deepEqual(errors, [], 'No browser page errors');
  console.log('PASS: image, host pointer/keyboard and style isolation, open/close/focus/Escape, keyboard movement, mouse/touch drag and cancellation, reload persistence, responsive bounds and no overlap, reduced motion, SPA leave/return, browser errors.');
  console.log('Screenshots are from a simulated editor URL, not a logged-in Tinkercad session.');
} finally {
  await context.close();
  assert.equal(dirname(profile), resolve(tmpdir()));
  assert.ok(basename(profile).startsWith('ohmi-browser-'));
  await rm(profile, { recursive: true, force: true });
}
