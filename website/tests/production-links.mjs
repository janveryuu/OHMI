import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const landing=process.env.OHMI_WEBSITE_URL||'https://meetohmi.vercel.app';
const app=process.env.OHMI_APP_URL||landing+'/app';
const output=fileURLToPath(new URL('../.impeccable/review/production/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
try{
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:width<768?844:900});
    for(const [selector,path,title]of [
      ['.launch','/','Hey Alex, let’s get curious.'],
      ['.hero-actions .primary','/','Hey Alex, let’s get curious.'],
      ['.feature-card:nth-child(1)','/ask','Ask OHMI'],
      ['.feature-card:nth-child(2)','/checker','Let’s look a little closer.'],
      ['.feature-card:nth-child(3)','/guide','A little light. A big first step.'],
    ]){
      await page.goto(landing);
      await page.locator(selector).click();
      await page.waitForURL(app+path.replace(/\/$/, '')+'/');
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      await page.reload();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
    }
    checks.push(`Launch, Meet, Ask, Checker and Guide links plus refresh pass at ${width}px`);
  }
  for(const path of ['/app/','/app/ask/','/app/assignments/','/app/checker/','/app/guide/','/app/progress/','/app/settings/']){
    const response=await page.request.get(landing+path,{maxRedirects:0});
    assert.equal(response.status(),200);
    assert.equal(response.headers().location,undefined);
  }
  checks.push('All seven /app/ routes return 200 without leaving the official origin');
  for(const path of ['/','/ask','/assignments','/checker','/guide','/progress','/settings']){
    const response=await page.request.get('https://ohmi-workspace.vercel.app'+path);
    assert.equal(response.status(),200,path);
    assert.equal(response.url(),'https://ohmi-workspace.vercel.app/app'+(path==='/'?'/':path+'/'));
  }
  const legacy=await page.request.get('https://ohmi-workspace.vercel.app/sw.js');
  assert.equal(legacy.status(),200);
  assert.match(await legacy.text(),/registration.unregister/);
  assert.match(legacy.headers()['cache-control'],/no-store/);
  const legacyContext=await browser.newContext();
  try{
    const legacyPage=await legacyContext.newPage();
    await legacyPage.goto('https://ohmi-workspace.vercel.app/app/');
    await legacyPage.evaluate(async()=>{
      await navigator.serviceWorker.ready;
      await caches.open('ohmi-public-shell-v1');
      await caches.open('unrelated-verification-cache');
      await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    });
    await legacyPage.waitForFunction(async()=> !(await navigator.serviceWorker.getRegistrations()).some(registration=>new URL(registration.scope).pathname==='/'));
    const names=await legacyPage.evaluate(()=>caches.keys());
    assert.ok(!names.includes('ohmi-public-shell-v1'));
    assert.ok(names.includes('ohmi-app-public-shell-v2'));
    assert.ok(names.includes('unrelated-verification-cache'));
    assert.equal(legacyPage.url(),'https://ohmi-workspace.vercel.app/app/');
    checks.push('Legacy root worker retires without navigating; new app and unrelated caches remain intact');
  }finally{await legacyContext.close();}
  const query=await page.request.get(landing+'/app/ask/?source=landing');
  assert.equal(query.status(),200);
  assert.equal(query.url(),landing+'/app/ask/?source=landing');
  const worker=await page.request.get(landing+'/app/sw.js');
  assert.equal(worker.status(),200);
  assert.match(worker.headers()['content-type'],/javascript/);
  assert.match(worker.headers()['cache-control'],/no-store/);
  checks.push('Legacy entry URLs redirect correctly; retirement worker, query strings and uncached same-origin app worker pass');
  const entry=await page.request.get(landing+'/app',{maxRedirects:0});
  assert.equal(entry.status(),308);
  assert.equal(new URL(entry.headers().location,landing).href,app+'/');
  await page.goto(app+'/');
  const scope=await page.evaluate(async()=> (await navigator.serviceWorker.ready).scope);
  assert.equal(scope,app+'/');
  for(const selector of ['link[rel="manifest"]','link[rel="icon"]','link[rel="apple-touch-icon"]']){
    assert.ok(new URL(await page.locator(selector).first().getAttribute('href'),page.url()).pathname.startsWith('/app/'));
  }
  const session=await page.context().newCDPSession(page);
  await page.waitForTimeout(1500);
  const installability=await session.send('Page.getInstallabilityErrors');
  assert.deepEqual(installability.installabilityErrors,[]);
  checks.push('Chromium reports no PWA installability errors on the official origin');
  await page.goto(landing);
  assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller),null);
  checks.push('Canonical /app redirect stays same-origin; manifest/icons and worker use /app/; landing stays outside worker scope');
  for(const name of ['styles.css','app.js','scene.js']){
    const response=await page.request.get(landing+'/'+name);
    assert.equal(response.status(),200);
    const digest=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
    assert.equal(digest(await response.text()),digest(await readFile(new URL('../src/'+name,import.meta.url),'utf8')),`${name} must match the approved source`);
  }
  checks.push('Live CSS, interaction code and cinematic scene match approved source after Git line-ending normalization');
  await page.setViewportSize({width:1440,height:900});
  await page.goto(landing);await page.waitForTimeout(2500);
  await page.screenshot({path:output+'/landing-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.goto(landing);await page.waitForTimeout(2500);
  await page.screenshot({path:output+'/landing-mobile.png',fullPage:true});
  await page.goto(app);await page.screenshot({path:output+'/app-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(output+'/links.json',JSON.stringify({landing,app,verifiedAt:new Date().toISOString(),checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
