import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startAuthFixture, seedSession, testUser, otherUser } from './auth-fixture.mjs';
const fixture=await startAuthFixture(), browser=await chromium.launch();
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const rich='Use **Ohm’s law**: $I = V/R$.\n\n$$I = \\frac{5}{1000} = 0.005\\,A = 5\\,mA$$\n\n```cpp\nvoid setup() { pinMode(LED_BUILTIN, OUTPUT); }\nvoid loop() { digitalWrite(LED_BUILTIN, HIGH); }\n// '+ 'long_line_'.repeat(35)+'\n```\n\n| Supply | Resistance | Current |\n| --- | --- | --- |\n| 5 V | 1 kΩ | 5 mA |\n\nCompare the calculated power with your component’s actual rating. This is a calculation, not electrical verification.';
const seed=(count=4)=>({conversationId:id,delayMs:800,posts:[],jobs:[],result:{status:'answer',mode:'ai',answer:rich},messages:Array.from({length:count},(_,i)=>({id:'m'+i,user_id:testUser.id,role:i%2?'assistant':'user',content:i%2?rich:'How do I calculate current?',position:i+1,structured_result:i%2?{mode:'ai'}:null}))});
const results=[],errors=[];
await mkdir('test-results/ask-polish',{recursive:true});
try {
 for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark'],[320,'light'],[320,'dark']]) {
  fixture.state.ai=seed();
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await seedSession(context);
  await context.addInitScript(theme=>localStorage.setItem('ohmi-preferences',JSON.stringify({theme,reduceMotion:true})),theme);
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3115/app/ask/');await page.locator('.message.assistant').first().waitFor();
  await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
  await page.getByRole('textbox').fill('Explain my LED circuit.');
  const started=Date.now();await page.locator('.chat-compose form').evaluate(form=>{form.requestSubmit();form.requestSubmit()});
  await page.locator('.pending-message').waitFor();assert.ok(Date.now()-started<350,'User message waited for backend');
  await page.getByRole('status',{name:'OHMI is thinking',exact:true}).waitFor();
  assert.equal(await page.locator('.chat-messages .skeleton,.chat-messages [class*=skeleton]').count(),0);
  assert.equal(await page.getByText('AI reply',{exact:true}).count(),0);
  assert.equal(await page.locator('.pending-message').evaluate(el=>getComputedStyle(el).borderStyle),'none');
  assert.equal(await page.locator('.chat-typing-dots i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  if(width===390&&theme==='dark') await page.screenshot({path:'test-results/ask-polish/pending-mobile-dark.png',fullPage:true});
  await page.getByRole('button',{name:'Stop waiting for OHMI',exact:true}).waitFor({state:'hidden'});
  assert.equal(fixture.state.ai.posts.length,1,'Duplicate form event generated twice');
  assert.equal(await page.locator('.pending-message,.chat-typing').count(),0);
  assert.equal(await page.locator('.message.user').filter({hasText:'Explain my LED circuit.'}).count(),1);
  assert.ok(await page.locator('.katex').count());assert.ok(await page.locator('.rich-text pre code').count());assert.ok(await page.locator('.rich-text table').count());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}/${theme} page overflow`);
  const axe=await new AxeBuilder({page}).include('.chat-workspace').analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);
  await page.screenshot({path:`test-results/ask-polish/${width}-${theme}.png`,fullPage:true});
  results.push(`${width}/${theme}: instant, single POST, minimal loading, Markdown/math/code, no overflow, axe0`);
  await context.close();
 }
 // Previously loaded history stays loaded and the viewport stays put while a reply arrives.
 fixture.state.ai=seed(60);
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await seedSession(context);const page=await context.newPage();
 await page.goto('http://127.0.0.1:3115/app/ask/');await page.locator('.message').first().waitFor();
 await page.locator('.chat-messages').evaluate(el=>el.scrollTop=0);await page.getByRole('button',{name:'Load earlier messages',exact:true}).click();
 await page.getByRole('button',{name:'Load earlier messages',exact:true}).waitFor({state:'hidden'});assert.equal(await page.locator('.message').count(),60);
 await page.getByRole('textbox').fill('Keep my earlier history.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.locator('.chat-messages').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'))});
 await page.getByRole('button',{name:'Stop waiting for OHMI',exact:true}).waitFor({state:'hidden'});
 assert.equal(await page.locator('.message').count(),62);assert.ok(await page.locator('.chat-messages').evaluate(el=>el.scrollTop)<5,'Reading position jumped to bottom');
 results.push('60-message paged history retained on send; reading position stable');
 // A second device can add more than one page while this device is open.
 const last=fixture.state.ai.messages.at(-1).position;
 for(let i=1;i<=80;i++) fixture.state.ai.messages.push({id:'remote'+i,user_id:testUser.id,role:i%2?'user':'assistant',content:'Remote-device context '+i,position:last+i});
 await page.getByRole('textbox').fill('Refresh after a remote conversation.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('button',{name:'Stop waiting for OHMI',exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Load earlier messages',exact:true}).waitFor();
 for(let i=0;i<3 && await page.getByRole('button',{name:'Load earlier messages',exact:true}).count();i++) {
  await page.locator('.chat-messages').evaluate(el=>el.scrollTop=0);
  const count=await page.locator('.message').count();await page.getByRole('button',{name:'Load earlier messages',exact:true}).click();
  await page.waitForFunction(count=>document.querySelectorAll('.message').length>count,count);
 }
 assert.equal(await page.locator('.message').count(),144);
 results.push('remote-device history gap remains recoverable through contiguous pagination');
 // Lost acknowledgement uses the same UUID and recovers, without generation retry.
 const postsBefore=fixture.state.ai.posts.length;
 await page.route('**/app/api/ai/',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort('failed')}else await route.continue()});
 await page.getByRole('textbox').fill('Recover this exact question.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('button',{name:'Stop waiting for OHMI',exact:true}).waitFor({state:'hidden'});
 assert.equal(fixture.state.ai.posts.length,postsBefore+1);assert.equal(await page.locator('.failed-message').count(),0);await page.unroute('**/app/api/ai/');
 results.push('lost acknowledgement recovered by UUID with one inference POST');
 // Definite failure keeps question and draft recoverable.
 await page.route('**/app/api/ai/',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{ok:false,code:'unavailable',error:'Synthetic outage'}}):route.continue());
 await page.getByRole('textbox').fill('Preserve my failed question.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.locator('.failed-message').waitFor();
 await page.getByRole('textbox').fill('Keep this separate draft during retry.');await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.failed-message').waitFor();
 assert.equal(await page.getByRole('textbox').inputValue(),'Keep this separate draft during retry.');
 await page.getByRole('button',{name:'Restore question',exact:true}).click();assert.equal(await page.getByRole('textbox').inputValue(),'Preserve my failed question.');
 await seedSession(context,otherUser);await page.reload();assert.equal(await page.getByText('Preserve my failed question.',{exact:true}).count(),0);
 results.push('failure restores original draft; account switch clears private messages');
 assert.deepEqual(errors,[]);await context.close();await writeFile('test-results/ask-polish/browser-report.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
} finally {await browser.close();await fixture.close()}
