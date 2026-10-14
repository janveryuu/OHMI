import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const env = JSON.parse(execFileSync('cmd.exe', ['/d', '/c', 'npx', '--yes', 'supabase@2.120.0', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(new URL(env.API_URL).hostname, '127.0.0.1');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const key = env.PUBLISHABLE_KEY || env.ANON_KEY;
const admin = createClient(env.API_URL, env.SECRET_KEY || env.SERVICE_ROLE_KEY, options);
const check = r => { assert.equal(r.error, null, r.error?.message); return r.data; };
const fixtures = [];
const requestIds = [];
try {
  for (let i = 0; i < 2; i++) {
    const email = `ohmi-ai-${crypto.randomUUID()}@example.test`; const password = `Test-${crypto.randomUUID()}`;
    const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
    const client = createClient(env.API_URL, key, options); check(await client.auth.signInWithPassword({ email, password })); fixtures.push({ user, client });
  }
  const [a, b] = fixtures;
  const backoffBefore=check(await admin.from('ohmi_ai_provider_backoffs').select('*').eq('model','gemini-3.8-flash'));
  try {
    const quotaArgs={p_model:'gemini-3.8-flash',p_retry_after:120};
    assert.ok((await a.client.from('ohmi_ai_provider_backoffs').select('*')).error,'Students cannot read global provider quota state');
    assert.ok((await a.client.from('ohmi_ai_provider_backoffs').upsert({model:'gemini-3.8-flash',blocked_until:new Date().toISOString()})).error,'Students cannot clear or extend provider backoff');
    assert.ok((await b.client.rpc('ohmi_defer_ai_provider',quotaArgs)).error,'Provider backoff RPC is service-only');
    check(await admin.rpc('ohmi_defer_ai_provider',quotaArgs));
    const original=check(await admin.from('ohmi_ai_provider_backoffs').select('blocked_until').eq('model',quotaArgs.p_model).single()).blocked_until;
    check(await admin.rpc('ohmi_defer_ai_provider',{...quotaArgs,p_retry_after:1}));
    assert.equal(check(await admin.from('ohmi_ai_provider_backoffs').select('blocked_until').eq('model',quotaArgs.p_model).single()).blocked_until,original,'A later shorter delay cannot shorten a provider reset');
    for(const args of [{...quotaArgs,p_model:'unapproved-provider'},{...quotaArgs,p_retry_after:0},{...quotaArgs,p_retry_after:172801}])assert.ok((await admin.rpc('ohmi_defer_ai_provider',args)).error,'Invalid model/delay denied');
  } finally {
    check(await admin.from('ohmi_ai_provider_backoffs').delete().eq('model','gemini-3.8-flash'));
    if(backoffBefore.length)check(await admin.from('ohmi_ai_provider_backoffs').insert(backoffBefore));
  }

  check(await a.client.from('ohmi_analyses').select('id'));
  const conv = check(await a.client.from('ohmi_conversations').insert({ user_id: a.user.id }).select().single());
  assert.equal(check(await b.client.from('ohmi_conversations').select('*')).length, 0);
  assert.ok((await b.client.from('ohmi_conversations').insert({ user_id: a.user.id })).error);
  assert.ok((await a.client.from('ohmi_messages').insert({ user_id: a.user.id, conversation_id: conv.id, role: 'assistant', content: 'Forged AI', position: 1 })).error);
  const requestId = crypto.randomUUID();
  const args = { p_user_id: a.user.id, p_request_id: requestId, p_kind: 'chat', p_target: conv.id, p_hash: 'a'.repeat(64), p_language: 'english', p_estimated_tokens: 64 };
  assert.ok((await a.client.rpc('ohmi_reserve_ai', args)).error, 'Public clients cannot reserve/reset usage');
  const reserved = check(await admin.rpc('ohmi_reserve_ai', args)); assert.equal(reserved.status, 'pending');
  requestIds.push(requestId);
  const duplicate = check(await admin.rpc('ohmi_reserve_ai', args)); assert.equal(duplicate.fresh, false);
  assert.ok((await admin.rpc('ohmi_reserve_ai', { ...args, p_hash: 'b'.repeat(64) })).error, 'Changed replay rejected');
  const concurrent = await Promise.all([0, 1].map(() => admin.rpc('ohmi_reserve_ai', { ...args, p_request_id: crypto.randomUUID() })));
  assert.ok(concurrent.every(r => r.error), 'One active request per user');
  check(await admin.rpc('ohmi_complete_ai', { p_request_id: requestId, p_output: { message: 'Explain a resistor.', answer: 'A resistor limits current.' }, p_input_tokens: 100, p_output_tokens: 30 }));
  assert.equal(check(await a.client.from('ohmi_messages').select('id')).length, 2);
  assert.equal(check(await b.client.from('ohmi_messages').select('id')).length, 0);
  assert.equal(check(await b.client.from('ohmi_ai_requests').select('id')).length, 0);
  assert.equal(check(await admin.rpc('ohmi_reserve_ai', args)).status, 'completed');
  const assignmentId = crypto.randomUUID(); const path = `${a.user.id}/${assignmentId}/assignment.pdf`;
  check(await a.client.from('ohmi_assignments').insert({ id: assignmentId, user_id: a.user.id, object_path: path, original_name: 'test.pdf', mime_type: 'application/pdf', size_bytes: 20, status: 'ready' }));
  const payload = { title: 'LED lab', status: 'ready', summary: 'Learn LEDs', objectives: ['Explain polarity'], components: [], expectedResults: [], assumptions: [], uncertainties: [], steps: [{ title: 'Read ratings', instruction: 'Read the datasheet', why: 'Use safe current', check: 'Know the rating?', code: '' }] };
  const analysis = check(await admin.from('ohmi_analyses').insert({ user_id: a.user.id, assignment_id: assignmentId, language: 'english', payload, model: 'gemini-3.8-flash' }).select().single());
  assert.ok((await b.client.from('ohmi_conversations').insert({ user_id: b.user.id, analysis_id: analysis.id })).error, 'Cross-owner context FK denied');
  assert.ok((await b.client.rpc('ohmi_save_tutorial_progress', { p_analysis_id: analysis.id, p_current_step: 0, p_completed: [0] })).error);
  check(await a.client.rpc('ohmi_save_tutorial_progress', { p_analysis_id: analysis.id, p_current_step: 0, p_completed: [0] }));
  assert.deepEqual(check(await a.client.from('ohmi_tutorial_progress').select('completed').single()).completed, [0]);
  assert.ok((await a.client.rpc('ohmi_save_tutorial_progress', { p_analysis_id: analysis.id, p_current_step: 2, p_completed: [0] })).error, 'Progress bounded by actual analysis');
  assert.ok((await a.client.from('ohmi_tutorial_progress').update({ current_step: 2 }).eq('analysis_id', analysis.id)).error, 'Direct API cannot bypass actual step bounds');
  assert.equal(check(await b.client.from('ohmi_tutorial_progress').select('*')).length, 0);
  assert.ok((await a.client.from('ohmi_analyses').update({ payload: {} }).eq('id', analysis.id)).error);
  assert.ok((await a.client.from('ohmi_ai_requests').delete().eq('user_id', a.user.id)).error, 'Cannot erase quota history');
  const abandonedConversation=check(await b.client.from('ohmi_conversations').insert({user_id:b.user.id}).select().single());
  const abandoned={...args,p_user_id:b.user.id,p_target:abandonedConversation.id,p_request_id:crypto.randomUUID()};
  check(await admin.rpc('ohmi_reserve_ai',abandoned));requestIds.push(abandoned.p_request_id);
  check(await admin.from('ohmi_ai_requests').update({created_at:'2020-01-01T00:00:00Z'}).eq('id',abandoned.p_request_id));
  assert.equal(check(await admin.rpc('ohmi_reserve_ai',abandoned)).status,'failed','Same request ID expires safely before a new attempt is allowed');
  assert.ok((await admin.rpc('ohmi_complete_ai',{p_request_id:abandoned.p_request_id,p_output:{message:'Old',answer:'Old'},p_input_tokens:1,p_output_tokens:1})).error,'Expired calls cannot save a late answer');
  for (let i = 0; i < 5; i++) {
    const next = { ...args, p_request_id: crypto.randomUUID() };
    check(await admin.rpc('ohmi_reserve_ai', next));
    requestIds.push(next.p_request_id);
    check(await admin.from('ohmi_ai_requests').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', next.p_request_id));
  }
  assert.ok((await admin.rpc('ohmi_reserve_ai', { ...args, p_request_id: crypto.randomUUID() })).error, 'Failed requests count toward minute limit');
  check(await admin.from('ohmi_ai_requests').update({created_at:'2020-01-01T00:00:00Z'}).in('id',requestIds));
  const seeded=[];
  const seed=async(count,user_id,accounted_tokens=0)=>{
    const created_at=new Date().toISOString().slice(0,10)+'T00:00:00Z';
    const rows=Array.from({length:count},()=>({id:crypto.randomUUID(),user_id,kind:'chat',input_hash:'f'.repeat(64),language:'english',status:'completed',reserved_tokens:500000,input_tokens:0,output_tokens:0,accounted_tokens,created_at}));
    check(await admin.from('ohmi_ai_requests').insert(rows));seeded.push(...rows.map(row=>row.id));
  };
  const clear=async()=>{if(seeded.length)check(await admin.from('ohmi_ai_requests').delete().in('id',seeded.splice(0)));};
  try{
    await seed(30,b.user.id);await seed(100,null);await seed(1,null,500000);
    const next={...abandoned,p_request_id:crypto.randomUUID()};
    check(await admin.rpc('ohmi_reserve_ai',next));requestIds.push(next.p_request_id);
    assert.ok((await admin.rpc('ohmi_complete_ai',{p_request_id:next.p_request_id,p_output:{message:'Question',answer:'Answer'},p_input_tokens:100001,p_output_tokens:0})).error,'Actual usage still bounded per request');
    check(await admin.rpc('ohmi_complete_ai',{p_request_id:next.p_request_id,p_output:{message:'Question',answer:'Answer'},p_input_tokens:100,p_output_tokens:30}));
    assert.equal(check(await admin.from('ohmi_ai_requests').select('id').in('id',seeded)).length,131,'Old daily usage remains unchanged and cannot block admission');
    assert.ok((await admin.rpc('ohmi_reserve_ai',{...args,p_request_id:crypto.randomUUID(),p_estimated_tokens:64001})).error,'Oversized per-request estimate rejected');
  }finally{await clear();}
  console.log('PASS local AI RLS, server-only writes/RPCs, replay/concurrency/failed-request limits, atomic chat save and owner-bounded tutorial progress.');
} finally { for (const fixture of fixtures) check(await admin.auth.admin.deleteUser(fixture.user.id)); }
try {
  const retained = check(await admin.from('ohmi_ai_requests').select('id,user_id').in('id',requestIds));
  assert.equal(retained.length,requestIds.length,'Deleting an account must not erase project cost accounting');
  assert.ok(retained.every(row=>row.user_id===null));
} finally { if (requestIds.length) check(await admin.from('ohmi_ai_requests').delete().in('id',requestIds)); }
