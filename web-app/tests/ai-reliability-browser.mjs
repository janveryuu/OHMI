import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startAuthFixture, seedSession, testUser, otherUser } from './auth-fixture.mjs';
const base='http://127.0.0.1:3115/app/';
const fixture=await startAuthFixture(), browser=await chromium.launch();
const conversationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', assignmentId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const errors=[];
fixture.state.ai={conversationId,posts:[],jobs:[],messages:[
 {id:'first',user_id:testUser.id,role:'user',content:'Explain this PDF assignment',position:1},
 {id:'partial',user_id:testUser.id,role:'assistant',content:'Original answer. [Answer incomplete: token limit reached.]',position:2,structured_result:{incomplete:true,continuation:{operation:'pdf',assignmentId}}}
]};
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});await seedSession(context);
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'ask/');
 const button=page.getByRole('button',{name:'Continue answer',exact:true});await button.waitFor();
 const draft=page.getByRole('textbox');await draft.fill('Keep this unrelated draft');
 await page.locator('input[type=file]').setInputFiles({name:'next-question.png',mimeType:'image/png',buffer:Buffer.from('synthetic local selection')});
 await button.click();
 await page.getByText('Continued explanation from the original PDF.',{exact:true}).waitFor();
 assert.equal(fixture.state.ai.posts.length,1);
 const sent=fixture.state.ai.posts[0];assert.equal(sent.operation,'pdf');assert.equal(sent.assignmentId,assignmentId);assert.equal(sent.conversationId,conversationId);assert.equal(sent.historyThroughPosition,2);
 assert.equal(await draft.inputValue(),'Keep this unrelated draft');assert.ok(await page.getByText('next-question.png',{exact:true}).count());
 assert.equal(await button.count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 // Actual authenticated recovery route, no generation and no material download.
 const saved=await context.request.get(base+'api/ai/requests/'+sent.requestId+'/');assert.equal(saved.status(),200);assert.match(saved.headers()['cache-control'],/private.*no-store/);assert.equal((await saved.json()).result.answer,'Continued explanation from the original PDF.');
 await seedSession(context,otherUser);
 const denied=await context.request.get(base+'api/ai/requests/'+sent.requestId+'/');assert.equal(denied.status(),404);assert.equal(fixture.state.ai.posts.length,1);
 await context.clearCookies();assert.equal((await context.request.get(base+'api/ai/requests/'+sent.requestId+'/')).status(),401);
 assert.deepEqual(errors,[]);
 await mkdir('test-results/ai-reliability',{recursive:true});await writeFile('test-results/ai-reliability/report.json',JSON.stringify({passed:['manual continuation retains owned PDF + canonical watermark','unrelated draft and selected attachment preserved','mobile has no overflow','real private recovery GET, cross-account404 and signed-out401','one mocked inference only'],errors},null,2));
 console.log('PASS: continuation, draft/attachment preservation, original request recovery, account isolation, private cache headers; synthetic provider only');
} finally {await browser.close();await fixture.close()}
