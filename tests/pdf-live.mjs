import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {chromium} from 'playwright';

export async function testPdfLive(env,clients,fixtures){
  const source=process.env.OHMI_PDF_ASSIGNMENT_PATH;assert.ok(source,'Choose the owner-supplied LED lab PDF');
  assert.equal(env.WXT_SUPABASE_URL,'https://vhmdgfydvoljzqztuxmu.supabase.co');
  const [a,b]=clients;const check=result=>{assert.equal(result.error,null,result.error?.message);return result.data;};
  for(let index=0;index<2;index++)check(await clients[index].from('ohmi_profiles').insert({id:fixtures[index].id,language:'english'}));
  const profile=await mkdtemp(join(tmpdir(),'ohmi-pdf-live-'));const output=resolve('.local-tests/phase4-pdf');await mkdir(output,{recursive:true});let context;
  try{
    context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.OHMI_CHROMIUM_PATH,args:[`--disable-extensions-except=${resolve('.output/chrome-mv3')}`,`--load-extension=${resolve('.output/chrome-mv3')}`],viewport:{width:1280,height:900},reducedMotion:'reduce'});
    await context.route('https://www.tinkercad.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><h1>SIMULATED EDITOR · REAL PDF BACKEND TEST</h1>'}));
    const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const extensionId=new URL(worker.url()).hostname;
    const account=await context.newPage();await account.goto(`chrome-extension://${extensionId}/account.html`);
    await account.getByLabel('Email',{exact:true}).fill(fixtures[0].email);await account.getByLabel('Password',{exact:true}).fill(fixtures[0].password);await account.getByRole('button',{name:'Sign in',exact:true}).click();
    await account.getByRole('heading',{name:'Your private workspace',exact:true}).waitFor();
    await account.waitForFunction(()=>document.querySelector('#ohmi-assignment-file')?.disabled===false);
    await account.getByLabel('Assignment file',{exact:true}).setInputFiles(source);await account.getByRole('button',{name:'Save private assignment',exact:true}).click();
    await account.getByText('Assignment saved privately. No AI analysis was performed.',{exact:true}).waitFor({timeout:120000});
    const assignment=check(await a.from('ohmi_assignments').select('*').eq('original_name',basename(source)).single());assert.equal(assignment.mime_type,'application/pdf');assert.equal(assignment.status,'ready');
    assert.equal(check(await b.from('ohmi_assignments').select('id').eq('id',assignment.id)).length,0);
    console.log('PASS actual OHMI PDF upload, private original storage and second-account denial.');
    await account.getByRole('button',{name:'Analyze PDF with OHMI',exact:true}).click();
    const guide=account.getByRole('region',{name:'AI assignment tutor',exact:true});
    await Promise.race([guide.waitFor({timeout:175000}),account.getByRole('button',{name:'Retry assignment analysis',exact:true}).waitFor({timeout:175000}).then(async()=>{throw new Error(await account.getByRole('region',{name:'Private assignments'}).getByRole('alert').innerText());})]);
    const analysis=check(await a.from('ohmi_analyses').select('*').eq('assignment_id',assignment.id).single());
    await writeFile(join(output,'pdf-analysis.json'),JSON.stringify(analysis,null,2));
    assert.equal(analysis.model,'qwen/qwen3.8-27b');assert.equal(analysis.payload.status,'ready');
    assert.equal(analysis.payload.components.length,5,'Only the five actual table rows are components');
    assert.doesNotMatch(JSON.stringify(analysis.payload),/D[0-8]\b|D1[0-9]\b/,'Do not invent additional pin/node labels');
    assert.ok(analysis.payload.steps.every(step=>!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(step.instruction)));
    const expected=[[/arduino|uno/i,'1'],[/\bled\b/i,'1'],[/resistor/i,'1'],[/breadboard/i,'1'],[/jumper|wire/i,'2']];
    for(const [name,quantity] of expected){const component=analysis.payload.components.find(component=>name.test(component.name));assert.ok(component,`Missing ${name}`);assert.equal(component.quantity,quantity,`Wrong ${name} count`);assert.match(component.details,/page\s+[12]/i);}
    assert.match(JSON.stringify(analysis.payload),/13[.,]6\d*\s*mA|0[.,]0136\d*\s*A/i);
    assert.doesNotMatch(JSON.stringify(analysis.payload),/(?<![\d.])1\s*Hz|\b9\s*mA|\b16[.,]8\s*mA|\bmA\s+mA\b|external battery is required|600.pin/i);
    assert.ok(analysis.payload.steps.length>=3);assert.ok(analysis.payload.steps.every(step=>step.instruction&&step.why&&step.check));
    const code=analysis.payload.steps.map(step=>step.code).join('\n');assert.match(code,/void\s+setup\s*\(/);assert.match(code,/void\s+loop\s*\(/);assert.match(code,/pinMode\s*\([^,]+,\s*OUTPUT/);assert.match(code,/digitalWrite\s*\([^,]+,\s*HIGH/);assert.match(code,/digitalWrite\s*\([^,]+,\s*LOW/);assert.match(code,/delay\s*\(\s*1000\s*\)/);
    await guide.getByRole('button',{name:'Complete AI step',exact:true}).click();await guide.getByRole('button',{name:'Undo AI step',exact:true}).waitFor();
    const editor=await context.newPage();await editor.goto('https://www.tinkercad.com/things/pdf-lab-test/editel');await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).click();await editor.getByRole('button',{name:'Guide section',exact:true}).click();
    await editor.getByLabel('Saved AI tutorial',{exact:true}).selectOption(analysis.id);const tutor=editor.getByRole('region',{name:'AI assignment tutor',exact:true});await tutor.getByRole('button',{name:'Undo AI step',exact:true}).waitFor();
    await editor.reload();await editor.getByRole('button',{name:/^(Open|Minimize) OHMI assistant$/}).waitFor();if(await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).count())await editor.getByRole('button',{name:'Open OHMI assistant',exact:true}).click();
    await editor.getByRole('button',{name:'Guide section',exact:true}).click();await editor.getByLabel('Saved AI tutorial',{exact:true}).selectOption(analysis.id);await tutor.getByRole('button',{name:'Undo AI step',exact:true}).waitFor();
    assert.deepEqual(check(await a.from('ohmi_tutorial_progress').select('completed').eq('analysis_id',analysis.id).single()).completed,[0]);
    console.log('PASS Groq PDF checklist (including two wires), D9 code, source references, tutorial and progress after editor refresh.');
    const before=check(await a.from('ohmi_ai_requests').select('id')).length;
    const cached=check(await a.functions.invoke('ohmi-ai',{body:{kind:'analyze',accountId:fixtures[0].id,requestId:crypto.randomUUID(),assignmentId:assignment.id}}));assert.equal(cached.ok,true,cached.error);assert.equal(cached.cached,true);assert.equal(check(await a.from('ohmi_ai_requests').select('id')).length,before);
    console.log('Respecting Groq free TPM: waiting one minute before the follow-up.');await new Promise(resolve=>setTimeout(resolve,60000));
    await tutor.getByRole('button',{name:'Ask about this step',exact:true}).click();
    await editor.getByRole('button',{name:'Send to OHMI',exact:true}).click();
    const chat=editor.getByRole('log',{name:'AI conversation',exact:true});
    await Promise.race([chat.getByText(/13[.,]6|resistor|LED/i).waitFor({timeout:120000}),editor.getByRole('button',{name:'Retry AI request',exact:true}).waitFor({timeout:120000}).then(async()=>{throw new Error('Live follow-up failed; no retry attempted. '+await editor.getByRole('alert').innerText());})]);
    await editor.getByText('OHMI is working…',{exact:true}).waitFor({state:'hidden',timeout:120000});
    const conversations=check(await a.from('ohmi_conversations').select('id').eq('analysis_id',analysis.id));assert.equal(conversations.length,1);
    const messages=check(await a.from('ohmi_messages').select('*').eq('conversation_id',conversations[0].id));assert.equal(messages.length,2);
    const answer=messages.find(message=>message.role==='assistant');assert.match(answer.content,/LED|resistor|polarity|anode|cathode/i);
    await writeFile(join(output,'pdf-followup.json'),JSON.stringify({answer:answer.content},null,2));
    assert.equal(check(await b.from('ohmi_messages').select('id').eq('conversation_id',conversations[0].id)).length,0);
    const usage=check(await a.from('ohmi_ai_requests').select('model,status,input_tokens,output_tokens').eq('status','completed'));assert.equal(usage.length,2);assert.ok(usage.every(row=>row.model==='qwen/qwen3.8-27b'&&row.input_tokens>0&&row.output_tokens>0));
    await editor.screenshot({path:join(output,'pdf-tutor-followup.png')});
    console.log('PASS live PDF current-step follow-up, actual token accounting, private cache/history and saved progress.');
  }catch(error){
    if(error instanceof assert.AssertionError)throw new Error('Live tutorial acceptance failed; response retained privately when available. No response content logged.');
    throw error;
  }finally{
    await context?.close();const rows=check(await a.from('ohmi_assignments').select('id,object_path'));
    for(const row of rows){check(await a.storage.from('ohmi-assignments').remove([row.object_path]));check(await a.from('ohmi_assignments').delete().eq('id',row.id));}
    check(await a.from('ohmi_conversations').delete().eq('user_id',fixtures[0].id));
    assert.equal(dirname(profile),resolve(tmpdir()));assert.ok(basename(profile).startsWith('ohmi-pdf-live-'));await rm(profile,{recursive:true,force:true});
  }
}
