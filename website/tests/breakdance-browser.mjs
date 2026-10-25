import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = process.env.OHMI_WEBSITE_URL || 'http://127.0.0.1:4179';
const baseline = process.env.OHMI_DANCE_BASELINE === '1';
const output = new URL('../.impeccable/review/breakdance/', import.meta.url);
const reference = new URL('../design/breakdance/geometry.json', import.meta.url);
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true});
const errors = [];
const results = {};
try {
 const page = await browser.newPage();
 page.on('pageerror', error => errors.push(error.message));
 for (const width of [1440, 1024, 768, 390, 320]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#explore').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  results[width] = await page.evaluate(() => {
   const selectors=['#explore','.meet-art','.meet-art img','#explore > div:last-child','#meet-title','#explore p','#explore .text-link'];
   return { boxes:Object.fromEntries(selectors.map(selector => {
    const {x,y,width,height}=document.querySelector(selector).getBoundingClientRect();
    return [selector,{x,y:y+scrollY,width,height}];
   })), text:document.querySelector('#explore > div:last-child').textContent, images:[...document.images].map(image=>image.getAttribute('src')) };
  });
  if (!baseline) {
   await page.waitForFunction(() => document.querySelector('.meet-art').dataset.playing === 'true');
   const state = await page.locator('#meet-dance').evaluate(video => {
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=600;
    const ctx=canvas.getContext('2d'); ctx.drawImage(video,0,0);
    return {duration:video.duration,muted:video.muted,defaultMuted:video.defaultMuted,loop:video.loop,inline:video.playsInline,controls:video.controls,paused:video.paused,alpha:ctx.getImageData(0,0,1,1).data[3]};
   });
   assert.deepEqual(state,{duration:6,muted:true,defaultMuted:true,loop:true,inline:true,controls:false,paused:false,alpha:0});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const box=await page.locator('#meet-dance').boundingBox(), text=await page.locator('#explore > div:last-child').boundingBox();
   assert.ok(box.x+box.width<=text.x || box.y+box.height<=text.y, 'Animation must not overlap copy');
  }
  await page.locator('#explore').screenshot({path:fileURLToPath(new URL(`${baseline?'before':'after'}-${width}.png`,output))});
 }
 if (baseline) await writeFile(reference,JSON.stringify(results,null,2));
 else {
  const previous=JSON.parse(await readFile(reference,'utf8'));
  for(const width of Object.keys(previous)) {
   assert.equal(results[width].text,previous[width].text);
   assert.deepEqual(results[width].images,previous[width].images);
   for(const selector of Object.keys(previous[width].boxes)) for(const key of ['x','y','width','height']) assert.ok(Math.abs(previous[width].boxes[selector][key]-results[width].boxes[selector][key])<.2,`${width} ${selector} ${key} changed`);
  }
  await page.locator('#meet-dance').evaluate(video=>{window.__looped=false;video.addEventListener('timeupdate',()=>{if(video.currentTime<1)window.__looped=true});video.currentTime=5.8});
  await page.waitForFunction(()=>window.__looped);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#meet-dance').paused && document.querySelector('.meet-art').dataset.playing==='false');
  assert.equal(await page.locator('.meet-art img').evaluate(img=>getComputedStyle(img).visibility),'visible');
  await page.reload(); await page.locator('#explore').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#meet-dance').getAttribute('src'),null);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('.meet-art').dataset.playing==='true');
  await page.route('**/ohmi-breakdance.webm',route=>route.abort());
  await page.reload(); await page.locator('#explore').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#meet-dance').error!==null);
  assert.equal(await page.locator('.meet-art img').evaluate(img=>getComputedStyle(img).visibility),'visible');
  await page.unroute('**/ohmi-breakdance.webm');
  await page.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){const result=original.apply(this,args);if(args[2]===1&&args[3]===1)result.data[3]=255;return result}});
  await page.reload(); await page.locator('#explore').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.meet-art').getAttribute('data-playing'),'false');
  assert.equal(await page.locator('.meet-art img').evaluate(img=>getComputedStyle(img).visibility),'visible');
 }
 assert.deepEqual(errors,[]);
 await writeFile(new URL('results.json',output),JSON.stringify({baseline,results,errors},null,2));
 console.log(baseline?'Five-width baseline recorded.':'Five-width unchanged layout, alpha, autoplay, silence, looping, reduced motion, asset-failure and opaque-alpha fallbacks passed.');
} finally {await browser.close()}
