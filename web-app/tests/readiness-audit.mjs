import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out='test-results/backend-readiness';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const report={url:'https://meetohmi.vercel.app/app/',checkedAt:new Date().toISOString(),viewports:[],errors:[]};
try{
 for(const width of [1440,768,390,320]){
  const context=await browser.newContext({viewport:{width,height:width<768?844:1000},colorScheme:'dark',isMobile:width<768,hasTouch:width<768});
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  const response=await page.goto(report.url);assert.equal(response.status(),200);await page.locator('html[data-theme]').waitFor();await page.waitForTimeout(700);
  const item={width,theme:await page.locator('html').getAttribute('data-theme'),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),title:await page.title()};
  await page.screenshot({path:`${out}/dashboard-${width}.png`,fullPage:true});
  if(width<768){
   await page.getByRole('button',{name:'More navigation',exact:true}).click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(500);
   item.panel=await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight,left:s.left,translate:s.translate,transform:s.transform,position:s.position,fullyVisible:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
   await page.screenshot({path:`${out}/more-${width}.png`,fullPage:true});
   await page.keyboard.press('Escape');item.escapeDismisses=await page.getByRole('dialog').count()===0;
  }
  report.viewports.push(item);await context.close();
 }
 assert.equal(report.viewports.length,4);assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify(report,null,2));await writeFile(`${out}/ui.json`,JSON.stringify(report,null,2));
}finally{await browser.close();}
