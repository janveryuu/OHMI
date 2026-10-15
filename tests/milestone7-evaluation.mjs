import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createPdf } from './fixtures/create-pdf.mjs';

const target = 'vhmdgfydvoljzqztuxmu';
assert.equal((await readFile('supabase/.temp/project-ref', 'utf8')).trim(), target, 'Refuse any other linked project');
const env = Object.fromEntries(
  (await readFile('.env', 'utf8'))
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

// Create 2 test users (User A and User B) for strict isolation testing
const fixtures = [0, 1].map(i => ({
  id: crypto.randomUUID(),
  email: `ohmi-m7-u${i}-${crypto.randomUUID()}@example.test`,
  password: `Test-${crypto.randomUUID()}`
}));

const workspace = resolve('.superpowers/sdd/2026-10-12-phase-3');
await mkdir(workspace, { recursive: true });
const sqlFile = resolve(workspace, 'live-fixture-m7.sql');

const query = async sql => {
  await writeFile(sqlFile, sql);
  const output = execFileSync(
    'cmd.exe',
    ['/d', '/c', 'npx', '--yes', 'supabase@2.120.0', 'db', 'query', '--linked', '--file', sqlFile],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const result = JSON.parse(output);
  if (result.error) throw new Error(result.error.message);
  return result.rows;
};

const rows = fixtures.map(user => `('${user.id}'::uuid,'${user.email}','${user.password}')`).join(',');
const ids = fixtures.map(user => `'${user.id}'::uuid`).join(',');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const requestIds = [];

async function invokeAi(token, payload) {
  requestIds.push(payload.requestId);
  const edgeUrl = `${env.WXT_SUPABASE_URL}/functions/v1/ohmi-ai`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Connection': 'close'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok && res.status === 429 && attempt === 0 && payload.operation !== undefined) {
        const waitTime = Math.min((data.retryAfterSeconds || 15), 60) * 1000;
        console.log(`  [Rate limited / cooldown] Waiting ${waitTime / 1000}s before retry...`);
        await sleep(waitTime + 2000);
        continue;
      }
      return { status: res.status, ok: res.ok && data.ok, data };
    } catch (err) {
      if (attempt === 0 && (err.cause?.code === 'ECONNRESET' || err.code === 'ECONNRESET')) {
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
}

async function uploadAssignmentFile(userClient, userId, assignmentId, filename, mime, bytes) {
  const ext = mime === 'application/pdf' ? 'pdf' : (mime === 'image/png' ? 'png' : 'jpg');
  const objectPath = `${userId}/${assignmentId}/assignment.${ext}`;
  const insertRes = await userClient.from('ohmi_assignments').insert({
    id: assignmentId,
    user_id: userId,
    original_name: filename,
    mime_type: mime,
    size_bytes: bytes.length,
    object_path: objectPath
  });
  if (insertRes.error) throw new Error(`Assignment record failed: ${insertRes.error.message}`);

  const uploadRes = await userClient.storage
    .from('ohmi-assignments')
    .upload(objectPath, bytes, { contentType: mime, upsert: false });
  if (uploadRes.error) throw new Error(`Upload failed: ${uploadRes.error.message}`);

  const updateRes = await userClient.from('ohmi_assignments').update({ status: 'ready' }).eq('id', assignmentId);
  if (updateRes.error) throw new Error(`Status update failed: ${updateRes.error.message}`);

  return { id: assignmentId, objectPath };
}

const results = [];
const clients = [];
const tokens = [];

const convAId = crypto.randomUUID();
const assignAId = crypto.randomUUID();
let tutorialAnalysisId = null;

try {
  // 1. Create 2 disposable test accounts
  const inserted = await query(`with input(id,email,password) as (values ${rows}), created as (
    insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,reauthentication_token,raw_app_meta_data,raw_user_meta_data)
    select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,extensions.crypt(password,extensions.gen_salt('bf')),now(),now(),now(),'','','','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('ohmi_phase4_test',true) from input returning id,email
  ), identities as (
    insert into auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at)
    select gen_random_uuid(),id,id::text,'email',jsonb_build_object('sub',id::text,'email',email,'email_verified',true),now(),now() from created returning user_id
  ) select count(*) as created from identities;`);
  assert.equal(inserted[0].created, 2, 'Two test accounts created');

  for (let i = 0; i < 2; i++) {
    const client = createClient(env.WXT_SUPABASE_URL, env.WXT_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const authRes = await client.auth.signInWithPassword({ email: fixtures[i].email, password: fixtures[i].password });
    assert.equal(authRes.error, null);
    clients.push(client);
    tokens.push(authRes.data.session.access_token);
  }

  console.log('--- Starting Milestone 7 (Durable History & Persistence) ---');

  // ==========================================
  // Test 1: Conversation Creation & Message Pair Persistence
  // ==========================================
  console.log('[Test 1] Testing Conversation & Message Pair Persistence for User A...');
  const createConvRes = await clients[0].from('ohmi_conversations').insert({
    id: convAId,
    user_id: fixtures[0].id,
    title: 'Initial conversation title'
  });
  assert.equal(createConvRes.error, null, 'User A conversation created');

  const req1Id = crypto.randomUUID();
  const chat1Res = await invokeAi(tokens[0], {
    version: 1,
    requestId: req1Id,
    operation: 'chat',
    conversationId: convAId,
    message: 'What is the function of a pull-up resistor on Arduino Pin 2?',
    language: 'english'
  });
  assert.equal(chat1Res.ok, true, `Chat failed: ${JSON.stringify(chat1Res.data)}`);

  // Verify messages persisted
  const msgsRes = await clients[0].from('ohmi_messages')
    .select('id, role, content, position, request_id, structured_result')
    .eq('conversation_id', convAId)
    .order('position', { ascending: true });
  assert.equal(msgsRes.error, null);
  const msgs = msgsRes.data;
  const t1HasPair = msgs.length === 2 && msgs[0].role === 'user' && msgs[1].role === 'assistant';
  const t1Sequential = msgs[0].position === 1 && msgs[1].position === 2;
  const t1HasStructured = Boolean(msgs[1].structured_result);
  const t1Pass = t1HasPair && t1Sequential && t1HasStructured;
  console.log(`  Test 1 (Conversation & Message Pair): ${t1Pass ? 'PASS' : 'FAIL'} [Pair=${t1HasPair}, Sequential=${t1Sequential}, Structured=${t1HasStructured}]`);
  results.push({ name: 'Conversation Message Pair Persistence', pass: t1Pass });
  await sleep(10000);

  // ==========================================
  // Test 2: Tutorial Artifact Persistence & Conversation Link
  // ==========================================
  console.log('[Test 2] Testing Tutorial Artifact Persistence & Conversation Link...');
  const pdfBytes = createPdf([
    [
      'Lab 3: Active Buzzer with Transistor',
      'Bill of Materials: 1x 5V Active Buzzer, 1x 2N2222 NPN Transistor, 1x 1k Ohm resistor, 1x Arduino Uno',
      'Wiring: Arduino Pin 8 to 1k resistor, resistor to transistor base, emitter to GND, collector to buzzer (-) pin, buzzer (+) to 5V.'
    ]
  ]);
  await uploadAssignmentFile(clients[0], fixtures[0].id, assignAId, 'buzzer-lab.pdf', 'application/pdf', pdfBytes);

  const req2Id = crypto.randomUUID();
  const tutRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: req2Id,
    operation: 'tutorial',
    assignmentId: assignAId,
    conversationId: convAId,
    message: 'Give me a step-by-step tutorial to assemble this buzzer circuit.',
    language: 'english'
  });
  assert.equal(tutRes.ok, true, `Tutorial failed: ${JSON.stringify(tutRes.data)}`);

  // Verify analysis artifact persisted in ohmi_analyses
  const analysesRes = await clients[0].from('ohmi_analyses')
    .select('id, assignment_id, language, payload, artifact_kind, schema_version, fingerprint')
    .eq('assignment_id', assignAId);
  assert.equal(analysesRes.error, null);
  const analyses = analysesRes.data;
  const t2HasAnalysis = analyses.length >= 1;
  const analysisRow = analyses[0];
  tutorialAnalysisId = analysisRow?.id;
  const t2IsTutorial = analysisRow?.artifact_kind === 'tutorial';
  const t2HasFingerprint = Boolean(analysisRow?.fingerprint);
  const t2HasSteps = (analysisRow?.payload?.steps?.length ?? 0) >= 3;

  // Verify conversation updated with analysis_id
  const updatedConv = await clients[0].from('ohmi_conversations')
    .select('id, analysis_id')
    .eq('id', convAId)
    .single();
  const t2ConvLinked = updatedConv.data?.analysis_id === tutorialAnalysisId;
  const t2Pass = t2HasAnalysis && t2IsTutorial && t2HasFingerprint && t2HasSteps && t2ConvLinked;
  console.log(`  Test 2 (Artifact Persistence & Link): ${t2Pass ? 'PASS' : 'FAIL'} [Analysis=${t2HasAnalysis}, Tutorial=${t2IsTutorial}, Fingerprint=${t2HasFingerprint}, Steps=${t2HasSteps}, Linked=${t2ConvLinked}]`);
  results.push({ name: 'Tutorial Artifact Persistence & Conversation Link', pass: t2Pass });
  await sleep(10000);

  // ==========================================
  // Test 3: Idempotent Replay (Zero Double-Insertion)
  // ==========================================
  console.log('[Test 3] Testing Idempotent Replay (Re-submitting exact same requestId)...');
  const replayRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: req2Id,
    operation: 'tutorial',
    assignmentId: assignAId,
    conversationId: convAId,
    message: 'Give me a step-by-step tutorial to assemble this buzzer circuit.',
    language: 'english'
  });
  assert.equal(replayRes.ok, true, 'Replay returned ok');

  // Verify analyses and messages count has NOT increased
  const afterAnalyses = await clients[0].from('ohmi_analyses').select('id').eq('assignment_id', assignAId);
  const afterMsgs = await clients[0].from('ohmi_messages').select('id').eq('conversation_id', convAId);
  const t3ZeroDoubleAnalysis = afterAnalyses.data?.length === 1;
  const t3ZeroDoubleMessages = afterMsgs.data?.length === 4; // 2 from chat + 2 from tutorial
  const t3Pass = t3ZeroDoubleAnalysis && t3ZeroDoubleMessages;
  console.log(`  Test 3 (Idempotent Replay): ${t3Pass ? 'PASS' : 'FAIL'} [AnalysesCount=${afterAnalyses.data?.length}, MessagesCount=${afterMsgs.data?.length}]`);
  results.push({ name: 'Idempotent Replay Without Duplication', pass: t3Pass });

  // ==========================================
  // Test 4: Tutorial Progress Lifecycle & Bounds Checking
  // ==========================================
  console.log('[Test 4] Testing Tutorial Progress Saving & Strict Bounds...');
  assert.ok(tutorialAnalysisId, 'Need valid tutorialAnalysisId');

  // Valid progress save: step 1, completed [0, 1]
  const save1 = await clients[0].rpc('ohmi_save_tutorial_progress', {
    p_analysis_id: tutorialAnalysisId,
    p_current_step: 1,
    p_completed: [0, 1]
  });
  assert.equal(save1.error, null, 'Progress save step 1 succeeded');

  const prog1 = await clients[0].from('ohmi_tutorial_progress')
    .select('current_step, completed')
    .eq('analysis_id', tutorialAnalysisId)
    .single();
  const t4ProgMatches = prog1.data?.current_step === 1 && prog1.data?.completed?.length === 2;

  // Invalid progress save: step 99 (out of bounds)
  const saveInvalid = await clients[0].rpc('ohmi_save_tutorial_progress', {
    p_analysis_id: tutorialAnalysisId,
    p_current_step: 99,
    p_completed: [0, 1]
  });
  const t4RejectsOOB = Boolean(saveInvalid.error);

  const t4Pass = t4ProgMatches && t4RejectsOOB;
  console.log(`  Test 4 (Tutorial Progress Bounds): ${t4Pass ? 'PASS' : 'FAIL'} [Matches=${t4ProgMatches}, RejectsOOB=${t4RejectsOOB}]`);
  results.push({ name: 'Tutorial Progress Saving & Bounds Checking', pass: t4Pass });

  // ==========================================
  // Test 5: Strict Two-User Isolation (User B cannot read/write User A data)
  // ==========================================
  console.log('[Test 5] Testing Strict Two-User Isolation (User B accessing User A)...');

  // User B tries to read User A's conversation
  const bReadConv = await clients[1].from('ohmi_conversations').select('*').eq('id', convAId);
  const t5ConvBlocked = (bReadConv.data?.length ?? 0) === 0;

  // User B tries to read User A's messages
  const bReadMsgs = await clients[1].from('ohmi_messages').select('*').eq('conversation_id', convAId);
  const t5MsgsBlocked = (bReadMsgs.data?.length ?? 0) === 0;

  // User B tries to read User A's analysis
  const bReadAnalysis = await clients[1].from('ohmi_analyses').select('*').eq('id', tutorialAnalysisId);
  const t5AnalysisBlocked = (bReadAnalysis.data?.length ?? 0) === 0;

  // User B tries to read User A's tutorial progress
  const bReadProg = await clients[1].from('ohmi_tutorial_progress').select('*').eq('analysis_id', tutorialAnalysisId);
  const t5ProgBlocked = (bReadProg.data?.length ?? 0) === 0;

  // User B tries to overwrite User A's tutorial progress via RPC
  const bWriteProg = await clients[1].rpc('ohmi_save_tutorial_progress', {
    p_analysis_id: tutorialAnalysisId,
    p_current_step: 0,
    p_completed: []
  });
  const t5WriteProgBlocked = Boolean(bWriteProg.error);

  // User B tries to invoke AI with User A's conversationId or assignmentId
  const bInvokeAi = await invokeAi(tokens[1], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'chat',
    conversationId: convAId,
    message: 'Can I see User A conversation?',
    language: 'english'
  });
  const t5EdgeBlocked = !bInvokeAi.ok; // Must reject unowned target

  const t5Pass = t5ConvBlocked && t5MsgsBlocked && t5AnalysisBlocked && t5ProgBlocked && t5WriteProgBlocked && t5EdgeBlocked;
  console.log(`  Test 5 (Two-User Isolation): ${t5Pass ? 'PASS' : 'FAIL'} [Conv=${t5ConvBlocked}, Msgs=${t5MsgsBlocked}, Analysis=${t5AnalysisBlocked}, Prog=${t5ProgBlocked}, WriteRPC=${t5WriteProgBlocked}, Edge=${t5EdgeBlocked}]`);
  results.push({ name: 'Strict Two-User Isolation (RLS & RPCs)', pass: t5Pass });

  // ==========================================
  // Test 6: Deletion Cascades
  // ==========================================
  console.log('[Test 6] Testing Deletion Cascades...');

  // 1. Delete conversation convAId -> messages should cascade delete
  const delConv = await clients[0].from('ohmi_conversations').delete().eq('id', convAId);
  assert.equal(delConv.error, null);
  const msgsAfterDel = await clients[0].from('ohmi_messages').select('id').eq('conversation_id', convAId);
  const t6MsgsCascaded = (msgsAfterDel.data?.length ?? 0) === 0;

  // The analysis artifact should still exist (it belongs to the assignment)
  const analysisAfterConvDel = await clients[0].from('ohmi_analyses').select('id').eq('id', tutorialAnalysisId);
  const t6AnalysisPreserved = (analysisAfterConvDel.data?.length ?? 0) === 1;

  // 2. Delete assignment assignAId -> analysis and tutorial progress should cascade delete
  const delAssign = await clients[0].from('ohmi_assignments').delete().eq('id', assignAId);
  assert.equal(delAssign.error, null);
  const analysisAfterAssignDel = await clients[0].from('ohmi_analyses').select('id').eq('id', tutorialAnalysisId);
  const t6AnalysisCascaded = (analysisAfterAssignDel.data?.length ?? 0) === 0;
  const progAfterAssignDel = await clients[0].from('ohmi_tutorial_progress').select('analysis_id').eq('analysis_id', tutorialAnalysisId);
  const t6ProgCascaded = (progAfterAssignDel.data?.length ?? 0) === 0;

  const t6Pass = t6MsgsCascaded && t6AnalysisPreserved && t6AnalysisCascaded && t6ProgCascaded;
  console.log(`  Test 6 (Deletion Cascades): ${t6Pass ? 'PASS' : 'FAIL'} [MsgsCascaded=${t6MsgsCascaded}, AnalysisPreserved=${t6AnalysisPreserved}, AnalysisCascaded=${t6AnalysisCascaded}, ProgCascaded=${t6ProgCascaded}]`);
  results.push({ name: 'Deletion Cascades (Conversations & Assignments)', pass: t6Pass });

  console.log('\n==========================================');
  console.log('--- MILESTONE 7 DURABLE HISTORY EVALUATION SUMMARY ---');
  console.log('==========================================');
  let passCount = 0;
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (r.pass) passCount++;
  }
  console.log(`Total Score: ${passCount} / ${results.length} passed`);
  assert.equal(passCount, results.length, 'All Milestone 7 criteria must pass');

} finally {
  if (clients[0]) {
    await clients[0].storage.from('ohmi-assignments').remove([`${fixtures[0].id}/${assignAId}/assignment.pdf`]).catch(() => {});
  }

  // Clean up database users & request records
  const removed = await query(
    `with removed as (delete from auth.users where id in (${ids}) and raw_user_meta_data->>'ohmi_phase4_test'='true' returning id) select count(*) as removed from removed;`
  );
  if (requestIds.length > 0) {
    const reqList = requestIds.map(id => `'${id}'::uuid`).join(',');
    await query(`delete from public.ohmi_ai_requests where id in (${reqList});`);
  }
  console.log(`Cleaned up ${removed[0]?.removed ?? 0} test accounts and ${requestIds.length} request records.`);
  await unlink(sqlFile).catch(() => {});
}
