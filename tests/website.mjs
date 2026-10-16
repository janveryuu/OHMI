import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.OHMI_WEBSITE_URL || 'http://127.0.0.1:4173';
const shots = resolve('website/.impeccable/review');
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const external = new Set();
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => { if (new URL(request.url()).origin !== new URL(base).origin) external.add(request.url()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

try {
  await page.goto(base);
  await page.getByRole('heading', { name: 'A little buddy. A brighter build.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.title(), 'OHMI — Your Circuit Buddy');
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.getByRole('button', { name:'Download extension — Coming Soon' }).isDisabled(), true, 'No fake extension download');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://meetohmi.vercel.app/');
  const source = await readFile('assets/mascot/ohmi-pixel-front.png');
  const deployed = await readFile('website/dist/assets/ohmi.png');
  assert.equal(createHash('sha256').update(deployed).digest('hex'), createHash('sha256').update(source).digest('hex'), 'Exact original mascot');

  for (const [name, width, height] of [['desktop',1505,1045],['laptop',1366,768],['tablet',768,1024],['mobile',390,844],['small-mobile',320,700]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    const layout = await page.evaluate(() => {
      const h1 = document.querySelector('h1').getBoundingClientRect();
      const mascot = document.querySelector('.hero-mascot').getBoundingClientRect();
      const action = document.querySelector('.hero-actions .button').getBoundingClientRect();
      return { scroll:document.documentElement.scrollWidth, width:innerWidth, titleRight:h1.right, actionBottom:action.bottom, mascotWidth:mascot.width, animation:getComputedStyle(document.querySelector('.hero-mascot')).animationName, images:[...document.images].every((img)=>img.complete && img.naturalWidth > 0) };
    });
    assert.ok(layout.scroll <= width, `${name}: no horizontal overflow (${layout.scroll})`);
    assert.ok(layout.titleRight <= width, `${name}: title fits`);
    assert.ok(layout.actionBottom < height, `${name}: primary action above fold`);
    assert.ok(layout.mascotWidth >= 200, `${name}: mascot visible`);
    assert.equal(layout.animation, 'none', `${name}: reduced motion`);
    await page.locator('.companion-section').scrollIntoViewIfNeeded();
    await page.locator('img:visible').evaluateAll((imgs)=>Promise.all(imgs.map((img)=>img.decode())));
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.locator('img:visible').evaluateAll((imgs)=>imgs.every((img)=>img.complete && img.naturalWidth > 0)), true, `${name}: images load`);
    if (['desktop','mobile','laptop'].includes(name)) await page.screenshot({ path:resolve(shots, `${name}.png`), fullPage:true });
    if (name === 'desktop') await page.screenshot({ path:resolve(shots, 'hero-repro.png') });
  }

  await page.setViewportSize({ width:1366,height:768 });
  await page.getByRole('tab', { name:'Arduino',exact:true }).click();
  assert.equal(await page.getByRole('tab', { name:'Arduino',exact:true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#panel-arduino').isVisible(), true);
  assert.match(await page.locator('#panel-arduino pre').innerText(), /void setup\(\)[\s\S]*void loop\(\)[\s\S]*delay\(1000\)/);
  assert.equal(new URL(page.url()).searchParams.get('preview'), 'arduino');
  await page.reload();
  assert.equal(await page.locator('#panel-arduino').isVisible(), true, 'Deep link survives refresh');
  await page.getByRole('tab', { name:'Arduino',exact:true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#panel-steps').isVisible(), true, 'Arrow keys switch tabs');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#panel-components').isVisible(), true);
  assert.match(await page.locator('figcaption').innerText(), /≈ 9 mA/);
  assert.ok(Math.abs((5 - 2) / 330 * 1000 - 9.09) < .01, 'Illustrative current is approximately 9 mA');
  await page.keyboard.press('End');
  assert.equal(await page.locator('#panel-steps').isVisible(), true);

  const question = page.locator('summary').filter({ hasText:'Does this website send my data to AI?' });
  await question.focus();
  await page.keyboard.press('Enter');
  assert.equal(await question.locator('..').getAttribute('open'), '', 'Native FAQ opens with keyboard');
  await page.keyboard.press('Enter');
  assert.equal(await question.locator('..').getAttribute('open'), null);
  for (const href of await page.locator('a[href^="#"]').evaluateAll((links)=>links.map((link)=>link.getAttribute('href')))) {
    assert.equal(await page.locator(href).count(), 1, `Anchor ${href} resolves`);
  }
  await page.goto(base);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-link').evaluate((el)=>el===document.activeElement), true, 'Skip link first');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('main').evaluate((el)=>el===document.activeElement), true, 'Skip link focuses main');
  const buttonStyle = await page.locator('.hero-actions .button').first().evaluate((el)=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
  function lum(css) {const rgb=css.match(/\d+/g).slice(0,3).map(Number).map((n)=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  const l1=lum(buttonStyle.color),l2=lum(buttonStyle.bg);
  assert.ok((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)>=4.5,'CTA text contrast');
  const noJs = await browser.newContext({ javaScriptEnabled:false });
  const staticPage = await noJs.newPage();
  await staticPage.goto(base);
  assert.equal(await staticPage.locator('#panel-components').isVisible(), true, 'Default preview works without JS');
  assert.equal(await staticPage.locator('noscript').isVisible(), true);
  await staticPage.close();await noJs.close();
  assert.equal(await page.locator('.hero-mascot').evaluate((el)=>el.classList.contains('gaze-ready')), false, 'Gaze disabled under reduced motion');
  const gazeContext = await browser.newContext({ reducedMotion:'no-preference',viewport:{width:1366,height:768} });
  const gazePage = await gazeContext.newPage();
  await gazePage.goto(base);
  await gazePage.waitForFunction(()=>document.querySelector('.hero-mascot').classList.contains('gaze-ready'));
  await gazePage.mouse.move(100,300);
  await gazePage.waitForFunction(()=>parseFloat(document.querySelector('.hero-mascot').style.getPropertyValue('--look-x'))<0);
  await gazePage.mouse.move(1350,300);
  await gazePage.waitForFunction(()=>parseFloat(document.querySelector('.hero-mascot').style.getPropertyValue('--look-x'))>0);
  await gazePage.locator('.hero-mascot').evaluate((el)=>Promise.all(el.getAnimations().map((animation)=>animation.finished)));
  await gazePage.screenshot({path:resolve(shots,'gaze-desktop.png')});
  await gazePage.emulateMedia({reducedMotion:'reduce'});
  await gazePage.waitForFunction(()=>!document.querySelector('.hero-mascot').classList.contains('gaze-ready'));
  await gazePage.close();await gazeContext.close();
  assert.deepEqual([...external], [], 'No external runtime requests');
  assert.deepEqual(errors, [], 'No browser or HTTP errors');
  console.log('Website checks passed: 5 viewports; exact mascot; keyboard tabs/FAQ/skip link; deep links; reduced motion; static fallback; CTA contrast; local-only runtime.');
} finally {await context.close();await browser.close();}
