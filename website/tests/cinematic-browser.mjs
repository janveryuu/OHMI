import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.OHMI_WEBSITE_URL || 'http://127.0.0.1:4177';
const output = fileURLToPath(new URL('../.impeccable/review/cinematic', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const checks = [];
const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,recordVideo:{dir:resolve(output,'video'),size:{width:1440,height:900}}});
const page = await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
page.on('request',request=>{if(new URL(request.url()).origin!==new URL(base).origin)errors.push(`External request: ${request.url()}`);});
try {
  await page.goto(base);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(2400);
  assert.equal(await page.locator('h1').count(),1);
  assert.ok(await page.evaluate(()=>document.fonts.check('900 20px Grandstander')));
  assert.equal(await page.locator('#scene-motion').getAttribute('data-state'),'running');
  const before = await page.locator('#scene-motion').getAttribute('data-frames');
  const regions = await page.evaluate(async()=>{
    const canvas=document.querySelector('#scene-motion');
    const gl=canvas.getContext('webgl');
    const capture=()=>{const data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
    const first=capture();
    await new Promise(resolve=>setTimeout(resolve,1200));
    const second=capture();
    const boxes={grass:[.04,.82,.55,.97],hair:[.09,.45,.17,.57],clouds:[.05,.10,.28,.35],antennae:[.247,.510,.320,.558],face:[.292,.580,.315,.600]};
    return Object.fromEntries(Object.entries(boxes).map(([name,[x1,y1,x2,y2]])=>{
      let changed=0,total=0;
      for(let y=Math.floor(y1*canvas.height);y<y2*canvas.height;y++)for(let x=Math.floor(x1*canvas.width);x<x2*canvas.width;x++){
        const index=((canvas.height-y-1)*canvas.width+x)*4;
        if(Math.max(...[0,1,2].map(channel=>Math.abs(first[index+channel]-second[index+channel])))>3)changed++;
        total++;
      }
      return [name,{changed,total,ratio:changed/total}];
    }));
  });
  for(const name of ['grass','hair','clouds','antennae'])assert.ok(regions[name].ratio>.005,`${name} must visibly change`);
  assert.equal(regions.face.changed,0,'OHMI face pixels remain fixed');
  assert.notEqual(await page.locator('#scene-motion').getAttribute('data-frames'),before);
  checks.push({motionRegions:regions});
  await page.screenshot({path:resolve(output,'desktop.png')});
  await page.locator('#motion-toggle').click();
  await page.waitForTimeout(150);
  const paused=await page.locator('#scene-motion').getAttribute('data-frames');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#scene-motion').getAttribute('data-frames'),paused,'Pause stops GPU work');
  await page.locator('#motion-toggle').click();
  await page.waitForTimeout(180);
  assert.notEqual(await page.locator('#scene-motion').getAttribute('data-frames'),paused);
  const card=page.locator('.feature-card').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(650);
  const transform=await card.evaluate(el=>getComputedStyle(el).transform);
  assert.ok(transform.includes('-8'),'Card lift is 8px');
  await page.screenshot({path:resolve(output,'cards-hover.png')});
  await page.locator('a[href="#try"]').first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button',{name:'What does digitalWrite do?'}).click();
  assert.match(await page.locator('#preview-answer').innerText(),/pinMode/);
  assert.equal(await page.locator('#scene-motion').getAttribute('data-state'),'paused','Offscreen scene pauses');
  checks.push('Pause/resume, hover, local sample switching and offscreen pause pass');
  for(const [width,height,name] of [[1440,900,'desktop-full'],[1024,768,'laptop'],[768,1024,'tablet'],[390,844,'mobile'],[320,740,'small-mobile']]){
    await page.setViewportSize({width,height});
    await page.goto(base);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(2400);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow at ${width}`);
    const actions=await page.locator('.hero-actions').boundingBox();
    assert.ok(actions.y+actions.height<height,`Hero actions above fold at ${width}`);
    if(width<=820){
      await page.getByRole('button',{name:'Menu',exact:true}).click();
      await page.locator('#mobile-nav a').first().focus();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#mobile-nav').isHidden(),true);
      assert.equal(await page.locator('.menu-toggle').evaluate(el=>el===document.activeElement),true);
      const visible=await page.evaluate(()=>{
        const box=document.querySelector('.scene-frame').getBoundingClientRect();
        const boy=box.left+box.width*.15,robot=box.left+box.width*.31;
        return boy>=0&&robot<=innerWidth&&box.top+box.height*.64<document.querySelector('#features').getBoundingClientRect().top;
      });
      assert.ok(visible,`Boy and OHMI visible at ${width}`);
    }
    await page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});
    checks.push(`Layout and real scene landmarks pass at ${width}x${height}`);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
  await page.goto(base);
  assert.equal(await page.locator('#scene-motion').isVisible(),false);
  assert.equal(await page.locator('#motion-toggle').isDisabled(),true);
  assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).opacity),'1');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-link').evaluate(el=>el===document.activeElement),true);
  const badLinks=await page.evaluate(()=>Array.from(document.querySelectorAll('a[href^="#"]')).map(a=>a.getAttribute('href')).filter(href=>!document.querySelector(href)));
  assert.deepEqual(badLinks,[]);
  for(const target of ['top','get-started','faq'])assert.equal(await page.locator(`#${target}`).count(),1,'Preserve original public anchors');
  const faq=page.locator('#faq summary').first();
  await faq.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#faq details').first().getAttribute('open'),'');
  await page.screenshot({path:resolve(output,'reduced-motion-dark-system.png')});
  checks.push('Reduced motion, dark OS consistency, keyboard skip link and all anchor targets pass');
  const fallbackContext=await browser.newContext({viewport:{width:390,height:844}});
  await fallbackContext.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});
  const fallbackPage=await fallbackContext.newPage();
  await fallbackPage.goto(base);
  await fallbackPage.waitForTimeout(2500);
  assert.equal(await fallbackPage.locator('#scene-motion').getAttribute('data-state'),'static');
  assert.equal(await fallbackPage.locator('#scene-poster').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  await fallbackPage.screenshot({path:resolve(output,'webgl-fallback.png'),fullPage:true});
  await fallbackContext.close();
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:900}});
  const staticPage=await nojs.newPage();await staticPage.goto(base);
  assert.equal(await staticPage.locator('h1').isVisible(),true);
  assert.ok(await staticPage.locator('#scene-poster').evaluate(img=>img.complete));
  await nojs.close();
  checks.push('No WebGL and no JavaScript retain original scene and readable content');
  assert.deepEqual(errors,[]);
  checks.push('No console errors, failed responses or third-party runtime requests');
  await writeFile(resolve(output,'results.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally {
  await context.close();
  await browser.close();
}
