import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.OHMI_WEBSITE_URL || 'http://127.0.0.1:4174';
const shots = resolve('website/.impeccable/review/motion');
await mkdir(shots, { recursive:true });
const browser = await chromium.launch({channel:'chrome'});
const context = await browser.newContext({ viewport:{ width:1366, height:900 } });
await context.addInitScript(() => {
  window.motionProof = { pending:0, shifts:0, frames:0, longest:0 };
  const raf = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
  const pending = new Set();
  window.requestAnimationFrame = (callback) => {
    const id = raf.call(window, (time) => {
      pending.delete(id); window.motionProof.pending = pending.size;
      const start = performance.now(); callback(time);
      window.motionProof.longest = Math.max(window.motionProof.longest, performance.now()-start);
      window.motionProof.frames++;
    });
    pending.add(id); window.motionProof.pending = pending.size; return id;
  };
  window.cancelAnimationFrame = (id) => { pending.delete(id); window.motionProof.pending=pending.size; cancel.call(window,id); };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.motionProof.shifts += entry.value;
  }).observe({type:'layout-shift',buffered:true});
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => { if(response.status()>=400) errors.push(`${response.status()} ${response.url()}`); });
const values = () => page.locator('.gaze-eyes>span').evaluateAll((eyes) => eyes.map((eye) => ({
  x:parseFloat(eye.style.getPropertyValue('--look-x')) || 0,
  y:parseFloat(eye.style.getPropertyValue('--look-y')) || 0,
  mask:getComputedStyle(eye).maskImage,
  pupil:getComputedStyle(eye,'::after').backgroundImage,
})));
async function settle() {
  await page.waitForFunction(() => window.motionProof.pending === 0);
}
try {
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.hero-mascot').evaluate((el) => Promise.all(el.getAnimations().filter(animation=>animation.effect.getTiming().iterations!==Infinity).map((animation) => animation.finished)));
  const loops = await page.locator('.hero-mascot').evaluate(el=>el.getAnimations().filter(animation=>animation.effect.getTiming().iterations===Infinity).length);
  assert.equal(loops,1,'Mascot idle repeats');
  for(const selector of ['.horizon','.stars i']) {
    assert.equal(await page.locator(selector).first().evaluate(el=>el.getAnimations().some(animation=>animation.effect.getTiming().iterations===Infinity)),true,`${selector} repeats`);
  }
  // Freeze independent ambient drift for the assertion that pointer input never moves the body.
  await page.locator('.hero-mascot').evaluate(el=>Promise.all(el.getAnimations().map(animation=>{animation.pause();return animation.ready;})));
  const before = await page.locator('.hero-mascot').boundingBox();
  for (const [name,x,y,sx,sy] of [
    ['up-left',15,15,-1,-1], ['up-right',1350,15,1,-1],
    ['down-left',15,880,-1,1], ['down-right',1350,880,1,1],
  ]) {
    await page.mouse.move(x,y);
    await settle();
    for (const eye of await values()) {
      assert.equal(Math.sign(eye.x),sx,`${name}: horizontal gaze`);
      assert.equal(Math.sign(eye.y),sy,`${name}: vertical gaze`);
      assert.ok(Math.abs(eye.x)<=18/86*100+.01 && Math.abs(eye.y)<=14/130*100+.01,'Bounded pupil travel');
      assert.match(eye.mask,/eye-(left|right)-mask.png/);
      assert.match(eye.pupil,/eye-(left|right)-pupil.png/);
    }
    const after=await page.locator('.hero-mascot').boundingBox();
    // Chrome's paused compositor can round fractional coordinates differently by <0.01px.
    for(const key of ['x','y','width','height']) assert.ok(Math.abs(after[key]-before[key])<.1,'Pointer never moves head/body');
    await page.screenshot({path:resolve(shots,`${name}.png`)});
    if(name==='down-right') await page.locator('.hero-mascot').screenshot({path:resolve(shots,'eyes-active.png')});
  }
  // The easing must traverse intermediate values, not snap to the target on the first frame.
  const prior = (await values())[0].x;
  await page.mouse.move(10,20);
  const early = (await values())[0].x;
  await settle();
  const final = (await values())[0].x;
  assert.ok(early > final && early <= prior,'Smooth interruptible easing');
  await page.locator('.hero-mascot').screenshot({path:resolve(shots,'eyes-left.png')});
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout',{relatedTarget:null})));
  await settle();
  assert.equal(await page.locator('.hero-mascot').evaluate((el)=>el.classList.contains('gaze-engaged')),false,'Pointer leave returns original resting art');
  await page.locator('.hero-mascot').screenshot({path:resolve(shots,'eyes-rest.png')});

  await page.mouse.move(1100,500);
  await settle();
  const yBefore = (await values())[0].y;
  await page.evaluate(() => window.scrollTo({top:180,behavior:'instant'}));
  await page.waitForFunction((previous) => parseFloat(document.querySelector('.gaze-left').style.getPropertyValue('--look-y')) > previous, yBefore);
  await settle();
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.hero').classList.contains('motion-paused'));
  assert.equal(await page.locator('.hero-mascot').evaluate(el=>el.classList.contains('gaze-engaged')),false,'Offscreen gaze sleeps');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));

  const initialShifts = await page.evaluate(()=>window.motionProof.shifts);
  assert.ok(initialShifts<.1,`Initial layout shifts ${initialShifts}`);
  for(const [width,height] of [[1505,1045],[1366,768],[768,1024],[390,844],[320,700]]) {
    await page.setViewportSize({width,height});
    for(const zoom of [1,1.25,1.5,2]) {
      // CSS zoom exercises layout scaling; CDP below also covers visual viewport zoom.
      await page.evaluate(z=>{document.documentElement.style.zoom=z;window.scrollTo({top:0,behavior:'instant'});},zoom);
      await page.mouse.move(width-8,20);
      await settle();
      const geometry = await page.evaluate(()=>{
        const mascot=document.querySelector('.hero-mascot').getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
          expectedLeft:mascot.left+mascot.width*437/1254,
          actualLeft:document.querySelector('.gaze-left').getBoundingClientRect().left,
          ready:document.querySelector('.hero-mascot').classList.contains('gaze-ready')};
      });
      assert.ok(Math.abs(geometry.expectedLeft-geometry.actualLeft)<1,`Eye alignment ${width}px at ${zoom*100}%`);
      // Above 100% layout zoom, the incumbent non-wrapping title may require horizontal panning.
      if(zoom===1) assert.equal(geometry.overflow,false,`${width}: no overflow`);
      assert.equal(geometry.ready,true);
    }
  }
  await page.evaluate(()=>document.documentElement.style.zoom=1);
  await page.setViewportSize({width:1366,height:900});
  const cdp = await context.newCDPSession(page);
  for(const scale of [1,1.5,2]) {
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:scale});
    await page.mouse.move(300,250); await settle();
    assert.equal(await page.evaluate(()=>visualViewport.scale),scale);
  }
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
  // Deterministic hidden-tab event harness: no reliance on headless window-manager focus.
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('motion-hidden')),true);
  assert.equal(await page.locator('.hero-mascot').evaluate(el=>el.classList.contains('gaze-engaged')),false);
  assert.equal(await page.evaluate(()=>window.motionProof.pending),0,'Hidden tab cancels gaze frame');
  assert.match(await page.locator('.hero-mascot').evaluate(el=>getComputedStyle(el).animationPlayState),/paused/);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!document.querySelector('.hero-mascot').classList.contains('gaze-ready'));
  assert.equal(await page.locator('.gaze-eyes').isVisible(),false,'Reduced motion retains exact resting art');
  assert.equal(await page.locator('.hero-mascot').evaluate(el=>getComputedStyle(el).animationName),'none');
  const proof = await page.evaluate(()=>window.motionProof);
  assert.equal(proof.pending,0,'No permanent rAF loop');
  proof.initialShifts = initialShifts;
  assert.ok(proof.longest<50,`No gaze callback long task: ${proof.longest}ms`);
  const touch = await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  const mobile = await touch.newPage(); await mobile.goto(base);
  await mobile.touchscreen.tap(200,400);
  assert.equal(await mobile.locator('.gaze-eyes').isVisible(),false,'Touch keeps natural gaze');
  await mobile.screenshot({path:resolve(shots,'mobile.png')});
  await touch.close();
  const missing = await browser.newContext();
  await missing.route('**/eye-*.png',route=>route.abort());
  const fallback = await missing.newPage();await fallback.goto(base);
  await fallback.mouse.move(100,100);
  assert.equal(await fallback.locator('.gaze-eyes').isVisible(),false,'Missing derivatives retain original art');
  assert.ok(await fallback.locator('.hero-mascot>img').evaluate(img=>img.complete&&img.naturalWidth===1254));
  await missing.close();
  assert.deepEqual(errors,[]);
  console.log('Motion checks passed: four directions, easing/rest, fixed body, scroll/offscreen, 5 widths × 4 layout zooms, 3 visual zooms, touch/reduced motion.');
  console.log(JSON.stringify(proof));
} finally {await context.close();await browser.close();}
