import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { testAiExtension } from './ai-extension.mjs';
export async function testAiLive(env, clients, fixtures) {
  const [a,b] = clients; const check=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
  for (let i=0;i<2;i++) check(await clients[i].from('ohmi_profiles').insert({id:fixtures[i].id,language:'english'}));
  const conversation=check(await a.from('ohmi_conversations').insert({user_id:fixtures[0].id}).select().single());
  const body={kind:'chat',accountId:fixtures[0].id,requestId:crypto.randomUUID(),conversationId:conversation.id,message:'Explain why an LED needs a series resistor without assuming ratings. Give complete untested Arduino Uno setup()/loop() code blinking pin 9 for 1 second on and 1 second off. Keep concise.'};
  const unauth=await fetch(`${env.WXT_SUPABASE_URL}/functions/v1/ohmi-ai`,{method:'POST',headers:{apikey:env.WXT_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(unauth.status,401,'Gateway requires JWT');
  const denied=check(await b.functions.invoke('ohmi-ai',{body:{...body,accountId:fixtures[1].id}}));
  assert.equal(denied.ok,false,'Other user cannot send conversation context to provider');
  const result=check(await a.functions.invoke('ohmi-ai',{body}));
  assert.equal(result.ok,true,result.error);
  assert.match(result.data.content,/current|resistor/i);
  assert.match(result.data.content,/setup\s*\(/);assert.match(result.data.content,/loop\s*\(/);assert.match(result.data.content,/untested|not.*test/i);
  const replay=check(await a.functions.invoke('ohmi-ai',{body})); assert.equal(replay.ok,true,replay.error);assert.equal(replay.data.id,result.data.id);
  assert.equal(check(await a.from('ohmi_messages').select('id').eq('conversation_id',conversation.id)).length,2,'Replay saves only one turn');
  const usage=check(await a.from('ohmi_ai_requests').select('model,status,input_tokens,output_tokens').eq('id',body.requestId).single());
  assert.ok(['gemini-3.8-flash','gemini-3.6-flash','qwen/qwen3.8-27b'].includes(usage.model));assert.equal(usage.status,'completed');assert.ok(usage.input_tokens>0&&usage.output_tokens>0);
  assert.equal(check(await b.from('ohmi_messages').select('id').eq('conversation_id',conversation.id)).length,0);
  console.log(`PASS LIVE ${usage.model}: electronics/Arduino chat, saved turn, actual usage, replay and cross-owner/unauthorized denial.`);
  const results=[{case:'electronics/Arduino chat',model:usage.model,answer:result.data.content}];
  const uploads=[];
  try {
    let pdfAnalysis;
    for(const [ext,mime] of [['pdf','application/pdf'],['png','image/png'],['jpg','image/jpeg']]) {
      const bytes=await readFile(`tests/fixtures/phase-4/led-lab.${ext}`);const id=crypto.randomUUID();const path=`${fixtures[0].id}/${id}/assignment.${ext}`;
      check(await a.from('ohmi_assignments').insert({id,user_id:fixtures[0].id,original_name:`led-lab.${ext}`,object_path:path,mime_type:mime,size_bytes:bytes.length}));uploads.push({id,path});
      check(await a.storage.from('ohmi-assignments').upload(path,bytes,{contentType:mime}));check(await a.from('ohmi_assignments').update({status:'ready'}).eq('id',id));
      const request={kind:'analyze',accountId:fixtures[0].id,requestId:crypto.randomUUID(),assignmentId:id};
      assert.equal(check(await b.functions.invoke('ohmi-ai',{body:{...request,accountId:fixtures[1].id}})).ok,false);
      const analyzed=check(await a.functions.invoke('ohmi-ai',{body:request}));assert.equal(analyzed.ok,true,analyzed.error);
      const payload=analyzed.data.payload;assert.equal(payload.status,'ready');assert.ok(payload.steps.length>0&&payload.steps.length<=24);assert.match(JSON.stringify(payload),/220/);assert.match(JSON.stringify(payload),/Arduino|Uno/i);
      const before=check(await a.from('ohmi_ai_requests').select('id')).length;
      const cached=check(await a.functions.invoke('ohmi-ai',{body:{...request,requestId:crypto.randomUUID()}}));assert.equal(cached.ok,true,cached.error);assert.equal(cached.data.id,analyzed.data.id);assert.equal(cached.cached,true);assert.equal(check(await a.from('ohmi_ai_requests').select('id')).length,before,'Cached analysis costs no new request');
      assert.equal(check(await b.from('ohmi_analyses').select('id').eq('id',analyzed.data.id)).length,0);
      check(await a.rpc('ohmi_save_tutorial_progress',{p_analysis_id:analyzed.data.id,p_current_step:Math.min(1,payload.steps.length-1),p_completed:[0]}));
      assert.deepEqual(check(await a.from('ohmi_tutorial_progress').select('completed').eq('analysis_id',analyzed.data.id).single()).completed,[0]);
      if(ext==='pdf')pdfAnalysis=analyzed.data;
      results.push({case:`${ext.toUpperCase()} assignment`,model:analyzed.data.model,analysis:payload});
      console.log(`PASS LIVE ${analyzed.data.model}: actual private ${ext.toUpperCase()} analysis, strict guide, free cache, progress and isolation.`);
    }
    check(await a.from('ohmi_profiles').update({language:'taglish'}).eq('id',fixtures[0].id));
    const contextual=check(await a.from('ohmi_conversations').insert({user_id:fixtures[0].id,analysis_id:pdfAnalysis.id}).select().single());
    const answer=check(await a.functions.invoke('ohmi-ai',{body:{kind:'chat',accountId:fixtures[0].id,conversationId:contextual.id,requestId:crypto.randomUUID(),stepIndex:0,message:'Ipaliwanag ang current step sa natural Taglish. Bakit mahalaga ito? Give a small hint; do not complete the assignment for me.'}}));assert.equal(answer.ok,true,answer.error);assert.match(answer.data.content,/kuryente|natin|para|ito|ang|yung|mo|kung/i);
    results.push({case:'contextual Taglish hint',answer:answer.data.content});console.log('PASS LIVE owned assignment/current-step context and Taglish hint.');
    check(await a.from('ohmi_profiles').update({language:'filipino'}).eq('id',fixtures[0].id));
    const filipino=check(await a.functions.invoke('ohmi-ai',{body:{kind:'chat',accountId:fixtures[0].id,conversationId:conversation.id,requestId:crypto.randomUUID(),message:'Ipaliwanag sa Filipino: bakit kailangan ng resistor ang LED? Dalawang pangungusap lamang.'}}));assert.equal(filipino.ok,true,filipino.error);assert.match(filipino.data.content,/kuryente|upang|ang|ng|para/i);results.push({case:'Filipino electronics',answer:filipino.data.content});
    console.log('PASS LIVE Filipino preference.');
    await writeFile('.superpowers/sdd/2026-10-14-phase-4/edge-results.json',JSON.stringify(results,null,2));
    await testAiExtension(fixtures,{analysisId:pdfAnalysis.id,conversationId:conversation.id,assignmentName:'led-lab.pdf'});
  } finally {
    for(const upload of uploads){check(await a.storage.from('ohmi-assignments').remove([upload.path]));check(await a.from('ohmi_assignments').delete().eq('id',upload.id));}
    check(await a.from('ohmi_conversations').delete().eq('user_id',fixtures[0].id));
    assert.equal(check(await a.from('ohmi_analyses').select('id')).length,0,'Assignment deletion cascades analyses');assert.equal(check(await a.from('ohmi_tutorial_progress').select('analysis_id')).length,0,'Assignment deletion cascades progress');assert.equal(check(await a.from('ohmi_messages').select('id')).length,0,'Conversation deletion cascades messages');
  }
}
