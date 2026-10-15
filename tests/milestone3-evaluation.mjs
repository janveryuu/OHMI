import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

// We use 2 users (6 requests each) to stay well within 10 requests/user/day and 40/project/day
const fixtures = [0, 1].map(() => ({
  id: crypto.randomUUID(),
  email: `ohmi-m3-${crypto.randomUUID()}@example.test`,
  password: `Test-${crypto.randomUUID()}`
}));

const workspace = resolve('.superpowers/sdd/2026-10-12-phase-3');
await mkdir(workspace, { recursive: true });
const sqlFile = resolve(workspace, 'live-fixture-m3.sql');

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
  const res = await fetch(edgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok && data.ok, data };
}

const results = [];

async function runCase(token, payload, checker, name, id) {
  console.log(`[Case ${id}/12] Testing ${name}...`);
  try {
    const res = await invokeAi(token, payload);
    if (!res.ok) {
      console.log(`  Case ${id}: FAIL - ${res.data?.error || JSON.stringify(res.data)}`);
      results.push({ id, name, pass: false, error: res.data?.error });
      return;
    }
    const answer = res.data?.result?.answer || '';
    const pass = Boolean(checker(answer, res.data));
    console.log(`  Case ${id}: ${pass ? 'PASS' : 'WARN'} - Snippet: "${answer.slice(0, 100).replace(/\n/g, ' ')}..."`);
    results.push({ id, name, pass });
  } catch (err) {
    console.log(`  Case ${id}: ERROR - ${err.message}`);
    results.push({ id, name, pass: false, error: err.message });
  } finally {
    await sleep(2500);
  }
}

try {
  // Create disposable test accounts
  const inserted = await query(`with input(id,email,password) as (values ${rows}), created as (
    insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,reauthentication_token,raw_app_meta_data,raw_user_meta_data)
    select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,extensions.crypt(password,extensions.gen_salt('bf')),now(),now(),now(),'','','','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('ohmi_phase4_test',true) from input returning id,email
  ), identities as (
    insert into auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at)
    select gen_random_uuid(),id,id::text,'email',jsonb_build_object('sub',id::text,'email',email,'email_verified',true),now(),now() from created returning user_id
  ) select count(*) as created from identities;`);
  assert.equal(inserted[0].created, 2, 'Two test accounts created');

  const clients = [];
  const tokens = [];
  for (const user of fixtures) {
    const client = createClient(env.WXT_SUPABASE_URL, env.WXT_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
    assert.equal(result.error, null);
    clients.push(client);
    tokens.push(result.data.session.access_token);
  }

  console.log('--- Starting Milestone 3 (12 Rubric Cases Evaluation) ---');

  // Case 1: Ohm's Law (English)
  await runCase(
    tokens[0],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'What current flows through a 250 ohm resistor connected across a 5V supply?'
    },
    (a) => (/20(?:\s*|\\text\{\s*)mA/i.test(a) || /0\.02(?:\s*|\\text\{\s*)A/i.test(a) || /20\s*milliamperes/i.test(a)) &&
           (/ohm/i.test(a) || /V\s*=\s*I/i.test(a) || /I\s*=\s*V/i.test(a) || /I\s*=/i.test(a)),
    "Ohm's Law (English)",
    1
  );

  // Case 2: LED Series Resistor (English)
  await runCase(
    tokens[0],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'Calculate the current-limiting resistor for a Red LED with a 2.0V forward voltage connected to a 5V Arduino pin with a target current of 15mA.'
    },
    (a) => (/200|220/i.test(a)) && (/13|14|15/i.test(a)) && (/resistor|ohm|Ω/i.test(a)),
    'LED Resistor (English)',
    2
  );

  // Case 3: LED Series Resistor (Taglish)
  await runCase(
    tokens[0],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'taglish',
      message: 'Kuya OHMI, paano mag-calculate ng resistor para sa red LED sa 5V Arduino pin? Target current ko ay 15mA at 2.0V ang forward voltage.'
    },
    (a) => (/resistor|voltage|current/i.test(a)) && (/(?:kailangan|gamitin|natin|para)/i.test(a)) && (/200|220/i.test(a)),
    'LED Resistor (Taglish)',
    3
  );

  // Case 4: LED Series Resistor (Filipino)
  await runCase(
    tokens[0],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'filipino',
      message: 'Paano kalkulahin ang kaukulang resistor para sa pulang LED sa 5V supply kung ang forward voltage ay 2V at 15mA ang kailangan?'
    },
    (a) => (/(?:kalkulahin|boltahe|kuryente|resistor|sukat)/i.test(a)) && (/200|220/i.test(a)),
    'LED Resistor (Filipino)',
    4
  );

  // Case 5: Follow-up Context Memory
  await runCase(
    tokens[0],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'What if I use a 3.3V supply pin instead?',
      context: [
        { role: 'user', text: 'I am calculating a resistor for a Red LED with 2.0V forward voltage and 15mA target current on a 5V pin.' },
        { role: 'assistant', text: 'For 5V supply and 2.0V LED at 15mA: Voltage drop is 5V - 2V = 3V. R = 3V / 0.015A = 200 Ω. You can use a standard 220 Ω resistor.' }
      ]
    },
    (a) => (/86|87|100|82|91/i.test(a)) && (/3\.3/i.test(a)),
    'Follow-up Context Memory',
    5
  );

  // Case 6: Missing Values / Clarification Handling
  await runCase(
    tokens[0],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'What resistor should I use for my LED?'
    },
    (a) => (/supply\s*voltage|forward\s*voltage|color|current/i.test(a)) && (/need|depend|specify|what/i.test(a)),
    'Missing Values / Clarification',
    6
  );

  // ==========================================
  // BATCH 2: User 1 (Cases 7 - 12)
  // ==========================================

  // Case 7: Series & Parallel Resistors
  await runCase(
    tokens[1],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'If I have two 220 ohm resistors, what is their total resistance in series, and what is their total resistance in parallel?'
    },
    (a) => (/440/i.test(a)) && (/110/i.test(a)) && (/series/i.test(a)) && (/parallel/i.test(a)),
    'Series & Parallel Resistors',
    7
  );

  // Case 8: Resistor Power Dissipation
  await runCase(
    tokens[1],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'How much power is dissipated by a 220 ohm resistor when 5V is applied across it?'
    },
    (a) => (/113|114\s*mW/i.test(a) || /0\.11\d*\s*W/i.test(a)) && (/power|watt|dissipat/i.test(a)),
    'Resistor Power Dissipation',
    8
  );

  // Case 9: Arduino Blink Sketch Generation
  await runCase(
    tokens[1],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'Generate a complete Arduino sketch to blink an LED connected to digital pin 13 every 500 milliseconds.'
    },
    (a) => {
      const hasSetup = /void\s+setup\s*\(\s*\)/.test(a);
      const hasLoop = /void\s+loop\s*\(\s*\)/.test(a);
      const hasPin13 = /13/.test(a);
      const hasPinMode = /pinMode\s*\(\s*(?:13|[a-zA-Z0-9_]+)\s*,\s*OUTPUT\s*\)/i.test(a);
      const hasDigitalWrite = /digitalWrite\s*\(\s*(?:13|[a-zA-Z0-9_]+)\s*,\s*(?:HIGH|1)\s*\)/i.test(a);
      const hasDelay = /delay\s*\(\s*500\s*\)/i.test(a);
      return hasSetup && hasLoop && hasPin13 && hasPinMode && hasDigitalWrite && hasDelay;
    },
    'Arduino Blink Sketch',
    9
  );

  // Case 10: Arduino Serial Pin Warning (Code Review)
  await runCase(
    tokens[1],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'Please review my Arduino code for blinking an LED.',
      code: 'void setup() {\n  pinMode(0, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(0, HIGH);\n  delay(1000);\n  digitalWrite(0, LOW);\n  delay(1000);\n}'
    },
    (a) => (/pin\s*0/i.test(a)) && (/serial|rx|upload|communication|interfere/i.test(a)),
    'Arduino Pin 0 Serial Warning',
    10
  );

  // Case 11: Arduino Concepts in Taglish
  await runCase(
    tokens[1],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'taglish',
      message: 'Paliwanag mo naman sa akin kung para saan ang pinMode at delay sa Arduino.'
    },
    (a) => (/pinMode/i.test(a)) && (/delay/i.test(a)) && (/(?:output|input|millisecond|oras|pause|maghintay)/i.test(a)),
    'Arduino Concepts (Taglish)',
    11
  );

  // Case 12: Boundary / Impossible Circuit (Vs < Vf)
  await runCase(
    tokens[1],
    {
      version: 1,
      requestId: crypto.randomUUID(),
      operation: 'chat',
      language: 'english',
      message: 'Calculate the resistor needed for a 3.0V supply and an LED with a forward voltage of 3.5V.'
    },
    (a) => (/less|cannot|won't|impossible|lower|boost|step-up/i.test(a)) && !(/-\d+\s*(?:Ω|ohm)/i.test(a)),
    'Impossible Circuit (Vs < Vf)',
    12
  );

  console.log('\n==========================================');
  console.log('--- MILESTONE 3 RUBRIC EVALUATION SUMMARY ---');
  console.log('==========================================');
  let passCount = 0;
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] Case ${r.id}: ${r.name}`);
    if (r.pass) passCount++;
  }
  console.log(`Total Score: ${passCount} / 12 passed (Rubric threshold: >= 11/12)`);
  assert.ok(passCount >= 11, `Expected at least 11/12 rubric passes, got ${passCount}`);
} finally {
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
