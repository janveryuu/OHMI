import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const landing=process.env.OHMI_WEBSITE_URL||'https://meetohmi.vercel.app';
const app=process.env.OHMI_APP_URL||'https://ohmi-workspace.vercel.app';
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
      await page.waitForURL(app+path);
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      await page.reload();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
    }
    checks.push(`Launch, Meet, Ask, Checker and Guide links plus refresh pass at ${width}px`);
  }
  for(const path of ['/app','/app/ask','/app/checker','/app/guide']){
    const response=await page.request.get(landing+path,{maxRedirects:0});
    assert.equal(response.status(),307);
    assert.equal(response.headers().location,app+(path.slice(4)||'/'));
  }
  checks.push('All /app entry points return correct 307 redirects');
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
  await writeFile(output+'/links.json',JSON.stringify({landing,app,checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
