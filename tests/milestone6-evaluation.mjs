import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createPdf } from './fixtures/create-pdf.mjs';
import { validateTutorialResult } from '../src/ai/tutorial.ts';

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

const fixtures = [0].map(() => ({
  id: crypto.randomUUID(),
  email: `ohmi-m6-${crypto.randomUUID()}@example.test`,
  password: `Test-${crypto.randomUUID()}`
}));

const workspace = resolve('.superpowers/sdd/2026-10-12-phase-3');
await mkdir(workspace, { recursive: true });
const sqlFile = resolve(workspace, 'live-fixture-m6.sql');

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
let blinkLabId = crypto.randomUUID();
let buttonLabId = crypto.randomUUID();
const clients = [];
const tokens = [];

try {
  // 1. Create disposable test account
  const inserted = await query(`with input(id,email,password) as (values ${rows}), created as (
    insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,reauthentication_token,raw_app_meta_data,raw_user_meta_data)
    select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,extensions.crypt(password,extensions.gen_salt('bf')),now(),now(),now(),'','','','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('ohmi_phase4_test',true) from input returning id,email
  ), identities as (
    insert into auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at)
    select gen_random_uuid(),id,id::text,'email',jsonb_build_object('sub',id::text,'email',email,'email_verified',true),now(),now() from created returning user_id
  ) select count(*) as created from identities;`);
  assert.equal(inserted[0].created, 1, 'One test account created');

  const client = createClient(env.WXT_SUPABASE_URL, env.WXT_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const authRes = await client.auth.signInWithPassword({ email: fixtures[0].email, password: fixtures[0].password });
  assert.equal(authRes.error, null);
  clients.push(client);
  tokens.push(authRes.data.session.access_token);

  console.log('--- Starting Milestone 6 (Source-Grounded Step-by-Step Tutorial) ---');

  // ==========================================
  // Test 1: Full Arduino Blink Tutorial (File-backed PDF)
  // ==========================================
  console.log('[Test 1] Testing File-Backed Tutorial: Arduino Blink on Pin 9...');
  const blinkPdfBytes = createPdf([
    [
      'ECE Lab 1: Arduino Controlled LED Blink',
      'Required Parts: 1x Red LED (2V, 20mA), 1x 330 Ohm resistor (1/4W), Arduino UNO',
      'Wiring: Connect LED anode to Arduino digital pin 9, cathode to resistor, resistor to GND.'
    ],
    [
      'Code Requirement:',
      'In setup(), set pin 9 as OUTPUT.',
      'In loop(), alternate pin 9 HIGH and LOW with 500ms delay.'
    ]
  ]);
  await uploadAssignmentFile(clients[0], fixtures[0].id, blinkLabId, 'blink-lab.pdf', 'application/pdf', blinkPdfBytes);

  const tut1Res = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'tutorial',
    assignmentId: blinkLabId,
    message: 'Please generate a step-by-step beginner guide to build and code this circuit.',
    language: 'english'
  });
  assert.equal(tut1Res.ok, true, `Blink tutorial failed: ${JSON.stringify(tut1Res.data)}`);
  const r1 = tut1Res.data.result;
  const val1 = validateTutorialResult(r1);
  const t1HasSteps = val1.valid && (r1.steps?.length ?? 0) >= 3;
  const t1HasSequential = r1.steps?.every((s, idx) => s.step === idx + 1);
  const t1MentionsPin9 = JSON.stringify(r1).includes('9');
  const t1Mentions330 = JSON.stringify(r1).includes('330');
  const t1Pass = t1HasSteps && t1HasSequential && t1MentionsPin9 && t1Mentions330;
  console.log(`  Test 1 (Blink Tutorial): ${t1Pass ? 'PASS' : 'WARN'} [Steps=${r1.steps?.length}, Sequential=${t1HasSequential}, Pin9=${t1MentionsPin9}, 330Ω=${t1Mentions330}]`);
  results.push({ name: 'File-backed Arduino Blink Tutorial', pass: t1Pass });
  await sleep(6000);

  // ==========================================
  // Test 2: Repeated Component Quantities Tutorial (File-backed PDF)
  // ==========================================
  console.log('[Test 2] Testing File-Backed Tutorial: Multi-Button Digital Input...');
  const buttonPdfBytes = createPdf([
    [
      'Lab 2: Dual Pushbutton Control',
      'Bill of Materials:',
      '  - 3x 10k Ohm pull-down resistors',
      '  - 2x Momentary Pushbuttons',
      '  - 1x Green LED and 1x 220 Ohm resistor',
      'Connections: Button 1 to digital pin 2 with 10k pull-down; Button 2 to digital pin 3 with 10k pull-down.'
    ]
  ]);
  await uploadAssignmentFile(clients[0], fixtures[0].id, buttonLabId, 'button-lab.pdf', 'application/pdf', buttonPdfBytes);

  const tut2Res = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'tutorial',
    assignmentId: buttonLabId,
    message: 'Generate an ordered tutorial to wire these buttons and LED.',
    language: 'english'
  });
  assert.equal(tut2Res.ok, true, `Button tutorial failed: ${JSON.stringify(tut2Res.data)}`);
  const r2 = tut2Res.data.result;
  const val2 = validateTutorialResult(r2);
  const t2HasSteps = val2.valid && (r2.steps?.length ?? 0) >= 2;
  const t2HasButtons = /button/i.test(JSON.stringify(r2));
  const t2Has10k = /10\s*k/i.test(JSON.stringify(r2));
  const t2Pass = t2HasSteps && t2HasButtons && t2Has10k;
  console.log(`  Test 2 (Multi-Component Tutorial): ${t2Pass ? 'PASS' : 'WARN'} [Steps=${r2.steps?.length}, Buttons=${t2HasButtons}, 10k=${t2Has10k}]`);
  results.push({ name: 'Multi-Component Ordered Tutorial', pass: t2Pass });
  await sleep(6000);

  // ==========================================
  // Test 3: Standalone Tutorial Guide (No uploaded file)
  // ==========================================
  console.log('[Test 3] Testing Standalone Tutorial: Active Buzzer with NPN Transistor...');
  const tut3Res = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'tutorial',
    message: 'How do I wire an active 5V buzzer with a 2N2222 NPN transistor and an Arduino Uno? Give me a beginner step-by-step tutorial.',
    language: 'english'
  });
  assert.equal(tut3Res.ok, true, `Standalone tutorial failed: ${JSON.stringify(tut3Res.data)}`);
  const r3 = tut3Res.data.result;
  const val3 = validateTutorialResult(r3);
  const t3HasSteps = val3.valid && (r3.steps?.length ?? 0) >= 3;
  const t3HasSequential = r3.steps?.every((s, idx) => s.step === idx + 1);
  const t3HasTransistor = /transistor|2N2222|collector|base|emitter/i.test(JSON.stringify(r3));
  const t3Pass = t3HasSteps && t3HasSequential && t3HasTransistor;
  console.log(`  Test 3 (Standalone Tutorial): ${t3Pass ? 'PASS' : 'WARN'} [Steps=${r3.steps?.length}, Sequential=${t3HasSequential}, Transistor=${t3HasTransistor}]`);
  results.push({ name: 'Standalone Step-by-Step Guide', pass: t3Pass });
  await sleep(6000);

  // ==========================================
  // Test 4: Missing / Unsafe Input Handling & Clarification
  // ==========================================
  console.log('[Test 4] Testing Tutorial with Missing/Impossible Requirements...');
  const tut4Res = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'tutorial',
    message: 'Give me a tutorial to light a blue LED (forward voltage 3.3V) directly using a single 1.5V AAA battery with no other voltage boosters.',
    language: 'english'
  });
  assert.equal(tut4Res.ok, true, `Impossible tutorial failed: ${JSON.stringify(tut4Res.data)}`);
  const r4 = tut4Res.data.result;
  // Must either return needs_clarification or warn that 1.5V is less than 3.3V forward voltage
  const t4ExplainsImpossible = r4.status === 'needs_clarification' ||
    /cannot|can't|insufficient|less than|impossible|not enough|3\.3\s*V.*1\.5\s*V|forward voltage/i.test(JSON.stringify(r4));
  console.log(`  Test 4 (Impossible Circuit Abstention/Clarification): ${t4ExplainsImpossible ? 'PASS' : 'WARN'}`);
  results.push({ name: 'Impossible Circuit Clarification & Safety Abstention', pass: t4ExplainsImpossible });

  console.log('\n==========================================');
  console.log('--- MILESTONE 6 TUTORIAL EVALUATION SUMMARY ---');
  console.log('==========================================');
  let passCount = 0;
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (r.pass) passCount++;
  }
  console.log(`Total Score: ${passCount} / ${results.length} passed`);
  assert.equal(passCount, results.length, 'All Milestone 6 tutorial criteria must pass');

} finally {
  if (clients[0]) {
    const userAFiles = [
      `${fixtures[0].id}/${blinkLabId}/assignment.pdf`,
      `${fixtures[0].id}/${buttonLabId}/assignment.pdf`
    ];
    await clients[0].storage.from('ohmi-assignments').remove(userAFiles).catch(() => {});
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
