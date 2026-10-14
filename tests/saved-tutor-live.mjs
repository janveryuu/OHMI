import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { testAiExtension } from './ai-extension.mjs';

export function verifyTutorFixture(payload) {
  assert.equal(payload.status,'ready');
  assert.match(payload.expectedResults.join(' '),/13[.,]6\d{0,4}\s*mA|0[.,]0136\d{0,4}\s*A/i,'The fixture current must be (5V-2V)/220ohm, approximately 13.6mA');
  assert.doesNotMatch(payload.expectedResults.join(' '),/\b9\s*mA\b/i,'Reject the recorded wrong current');
  const distinct=new Set();
  for(const name of [/arduino|uno/i,/breadboard/i,/\bled\b/i,/resistor/i]){
    const component=payload.components.find(component=>name.test(component.name));assert.ok(component);assert.match(component.quantity,/^(1|one)(\b|$)/i);distinct.add(component);
  }
  assert.equal(distinct.size,4,'List the four required components separately');
  assert.ok(payload.steps.length>0&&payload.steps.length<=24);
  assert.ok(payload.steps.every(step=>step.instruction&&step.why&&step.check));
  assert.doesNotMatch(JSON.stringify(payload),/7\s*V|600.pin/i);
  return payload;
}

if(process.env.OHMI_AI_SAVED_TUTOR_CHECK==='1') {
  const payload=JSON.parse(await readFile('tests/fixtures/phase-4/tutorial.json','utf8'));
  verifyTutorFixture(payload);
  assert.throws(()=>verifyTutorFixture({...payload,expectedResults:['LED current is approximately 9mA.']}),'The acceptance check must reject the recorded wrong-current guide');
  console.log('PASS deterministic fixture quality self-check: 13.6mA accepted, known 9mA error rejected.');
}

export async function testSavedTutorLive(env,clients,fixtures,query) {
  assert.equal(env.WXT_SUPABASE_URL,'https://vhmdgfydvoljzqztuxmu.supabase.co');
  const payload=verifyTutorFixture(JSON.parse(await readFile('tests/fixtures/phase-4/tutorial.json','utf8')));
  const check=result=>{assert.equal(result.error,null,result.error?.message);return result.data;};
  const [a,b]=clients;const owner=fixtures[0].id;const assignmentId=crypto.randomUUID();const analysisId=crypto.randomUUID();
  for(const id of [owner,assignmentId,analysisId])assert.match(id,/^[\da-f-]{36}$/);
  for(let index=0;index<2;index++)check(await clients[index].from('ohmi_profiles').insert({id:fixtures[index].id,language:'english'}));
  const path=`${owner}/${assignmentId}/assignment.png`;const bytes=await readFile('tests/fixtures/phase-4/led-lab.png');
  const before=check(await a.from('ohmi_ai_requests').select('id')).length;
  try {
    check(await a.from('ohmi_assignments').insert({id:assignmentId,user_id:owner,original_name:'DETERMINISTIC-TEST.png',object_path:path,mime_type:'image/png',size_bytes:bytes.length}));
    check(await a.storage.from('ohmi-assignments').upload(path,bytes,{contentType:'image/png'}));
    check(await a.from('ohmi_assignments').update({status:'ready'}).eq('id',assignmentId));
    const encoded=JSON.stringify(payload).replaceAll("'","''");
    const inserted=await query(`insert into public.ohmi_analyses(id,user_id,assignment_id,language,payload,model)
      select '${analysisId}'::uuid,'${owner}'::uuid,'${assignmentId}'::uuid,'english','${encoded}'::jsonb,'offline-test-fixture'
      where exists(select 1 from auth.users where id='${owner}'::uuid and raw_user_meta_data->>'ohmi_phase3_test'='true' and email like 'ohmi-phase3-%@example.test') returning id;`);
    assert.equal(inserted.length,1,'Only the explicitly guarded fixture account receives a deterministic test analysis');
    const saved=check(await a.from('ohmi_analyses').select('payload,model').eq('id',analysisId).single());
    assert.equal(saved.model,'offline-test-fixture');verifyTutorFixture(saved.payload);
    assert.equal(check(await b.from('ohmi_analyses').select('id').eq('id',analysisId)).length,0);
    check(await a.rpc('ohmi_save_tutorial_progress',{p_analysis_id:analysisId,p_current_step:1,p_completed:[0]}));
    assert.deepEqual(check(await a.from('ohmi_tutorial_progress').select('completed').eq('analysis_id',analysisId).single()).completed,[0]);
    assert.ok((await b.rpc('ohmi_save_tutorial_progress',{p_analysis_id:analysisId,p_current_step:0,p_completed:[]})).error);
    const conversation=check(await a.from('ohmi_conversations').insert({user_id:owner}).select().single());
    await testAiExtension(fixtures,{analysisId,conversationId:conversation.id,assignmentName:'DETERMINISTIC-TEST.png',hasCode:false});
    const progress=check(await a.from('ohmi_tutorial_progress').select('current_step,completed').eq('analysis_id',analysisId).single());
    assert.equal(progress.current_step,1);assert.deepEqual(progress.completed,[0,1]);
    assert.equal(check(await a.from('ohmi_ai_requests').select('id')).length,before,'Saved tutor UI must not consume model quota or create fake usage');
    console.log('PASS live Supabase fixture-backed tutor: save/resume/completion, step context, responsive UI and two-user isolation; no AI generation claimed.');
  } finally {
    check(await a.storage.from('ohmi-assignments').remove([path]));check(await a.from('ohmi_assignments').delete().eq('id',assignmentId));check(await a.from('ohmi_conversations').delete().eq('user_id',owner));
    assert.equal(check(await a.from('ohmi_analyses').select('id').eq('id',analysisId)).length,0,'Owner deletion removes its analysis');
  }
}
