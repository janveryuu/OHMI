import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { startAuthFixture, seedSession, testUser } from './auth-fixture.mjs';
const fixture = await startAuthFixture(), browser = await chromium.launch();
fixture.state.delayMs = 40;
fixture.state.ai = { conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', delayMs: 250, posts: [], jobs: [], messages: [
  { id:'user',user_id:testUser.id,role:'user',content:'What is a resistor?',position:1 },
  { id:'reply',user_id:testUser.id,role:'assistant',content:'A resistor limits current. Start with your circuit’s supply voltage and target current.',position:2,structured_result:{mode:'ai'} },
], result: {status:'answer',mode:'ai',answer:'Use Ohm’s law: $I = V/R$. With 5 V across 1 kΩ, the current is **5 mA**. Check the resistor’s actual power rating before powering hardware.'} };
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await seedSession(context);
 const page=await context.newPage();page.setDefaultTimeout(30000);
 // Controlled network RTT on browser requests; never inserted into application code.
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:10e6,uploadThroughput:10e6});
 await page.goto('http://127.0.0.1:3115/app/ask/',{timeout:60000});await page.getByText('A resistor limits current.',{exact:false}).waitFor();
 const runs=[];
 for(let i=0;i<4;i++) {
  const question=`Explain current through my resistor, run ${i}.`, textbox=page.getByRole('textbox');await textbox.fill(question);
  fixture.state.requests=[];const calls=[];const listener=request=>{if(request.url().includes('/app/api/'))calls.push(new URL(request.url()).pathname)};page.on('request',listener);
  const started=Date.now();await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.locator('.message.user').filter({hasText:question}).waitFor();const visible=Date.now()-started;
  await page.getByRole('button',{name:'Stop waiting for OHMI',exact:true}).waitFor({state:'hidden'});
  const total=Date.now()-started;page.off('request',listener);
  assert.equal(fixture.state.ai.posts.length,i+1);
  if(i)runs.push({visibleMs:visible,completionMs:total,browserApiRequests:calls.length,fixtureRequests:fixture.state.requests.length,paths:calls});
 }
 await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
 await mkdir('test-results/ask-polish',{recursive:true});await page.screenshot({path:`test-results/ask-polish/${process.env.ASK_STAGE||'before'}-desktop.png`,fullPage:true});
 const report={stage:process.env.ASK_STAGE||'before',conditions:{browserLatencyMs:60,fixtureLatencyMs:40,syntheticProviderMs:250,warmedRuns:3},runs};
 await writeFile(`test-results/ask-polish/${report.stage}-performance.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();await fixture.close()}
