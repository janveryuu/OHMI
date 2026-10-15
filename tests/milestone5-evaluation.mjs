import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createPdf } from './fixtures/create-pdf.mjs';
import { verifyPageCitation } from '../src/ai/pdf.ts';

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

const fixtures = [0, 1].map(() => ({
  id: crypto.randomUUID(),
  email: `ohmi-m5-${crypto.randomUUID()}@example.test`,
  password: `Test-${crypto.randomUUID()}`
}));

const workspace = resolve('.superpowers/sdd/2026-10-12-phase-3');
await mkdir(workspace, { recursive: true });
const sqlFile = resolve(workspace, 'live-fixture-m5.sql');

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

let userBAssignmentId = crypto.randomUUID();
let corruptPdfId = crypto.randomUUID();
let encryptedPdfId = crypto.randomUUID();
let oversizedPdfId = crypto.randomUUID();
let tooManyPagesPdfId = crypto.randomUUID();
let pdf1LabId = crypto.randomUUID();
let pdf2TableId = crypto.randomUUID();
let pdf3ContradictoryId = crypto.randomUUID();
let pdf4AmbiguousId = crypto.randomUUID();

const clients = [];
const tokens = [];

try {
  // 1. Create disposable test accounts
  const inserted = await query(`with input(id,email,password) as (values ${rows}), created as (
    insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,reauthentication_token,raw_app_meta_data,raw_user_meta_data)
    select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,extensions.crypt(password,extensions.gen_salt('bf')),now(),now(),now(),'','','','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('ohmi_phase4_test',true) from input returning id,email
  ), identities as (
    insert into auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at)
    select gen_random_uuid(),id,id::text,'email',jsonb_build_object('sub',id::text,'email',email,'email_verified',true),now(),now() from created returning user_id
  ) select count(*) as created from identities;`);
  assert.equal(inserted[0].created, 2, 'Two test accounts created');

  for (const user of fixtures) {
    const client = createClient(env.WXT_SUPABASE_URL, env.WXT_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
    assert.equal(result.error, null);
    clients.push(client);
    tokens.push(result.data.session.access_token);
  }

  console.log('--- Starting Milestone 5 (PDF Assignment Understanding) ---');

  // ==========================================
  // PART 1: Security & Negative Rejections
  // ==========================================

  // 1. Foreign Assignment ID (User A attempts to access User B's PDF)
  console.log('[Test 1] Testing cross-owner access denial...');
  userBAssignmentId = crypto.randomUUID();
  const dummyPdf = createPdf([['User B Secret Assignment']]);
  await uploadAssignmentFile(clients[1], fixtures[1].id, userBAssignmentId, 'user-b-lab.pdf', 'application/pdf', dummyPdf);

  const crossOwnerRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: userBAssignmentId,
    message: 'Analyze this foreign assignment',
    language: 'english'
  });
  const crossOwnerPass = crossOwnerRes.status === 404 && crossOwnerRes.data?.code === 'not_found';
  console.log(`  Cross-owner access: ${crossOwnerPass ? 'PASS (404 denied)' : 'FAIL'}`);
  results.push({ name: 'Cross-owner access denied', pass: crossOwnerPass });
  await sleep(1500);

  // 2. Corrupt PDF
  console.log('[Test 2] Testing corrupt PDF rejection...');
  corruptPdfId = crypto.randomUUID();
  const corruptBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x00, 0x99, 0x88]);
  await uploadAssignmentFile(clients[0], fixtures[0].id, corruptPdfId, 'corrupt.pdf', 'application/pdf', corruptBytes);

  const corruptRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: corruptPdfId,
    message: 'Analyze corrupt document',
    language: 'english'
  });
  const corruptPass = corruptRes.status === 415;
  console.log(`  Corrupt PDF: ${corruptPass ? 'PASS (415 rejected)' : 'FAIL'}`);
  results.push({ name: 'Corrupt PDF rejected', pass: corruptPass });
  await sleep(1500);

  // 3. Encrypted/Password-protected PDF
  console.log('[Test 3] Testing encrypted PDF rejection...');
  encryptedPdfId = crypto.randomUUID();
  const encBytes = createPdf([['Password-protected content']], { encrypted: true });
  await uploadAssignmentFile(clients[0], fixtures[0].id, encryptedPdfId, 'locked.pdf', 'application/pdf', encBytes);

  const encRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: encryptedPdfId,
    message: 'Analyze encrypted document',
    language: 'english'
  });
  const encPass = encRes.status === 415 && /encrypt|password/i.test(encRes.data?.error || '');
  console.log(`  Encrypted PDF: ${encPass ? 'PASS (415 rejected)' : 'FAIL'}`);
  results.push({ name: 'Encrypted PDF rejected', pass: encPass });
  await sleep(1500);

  // 4. Too many pages (> 6 pages)
  console.log('[Test 4] Testing > 6 pages rejection...');
  tooManyPagesPdfId = crypto.randomUUID();
  const sevenPages = createPdf([['P1'], ['P2'], ['P3'], ['P4'], ['P5'], ['P6'], ['P7']]);
  await uploadAssignmentFile(clients[0], fixtures[0].id, tooManyPagesPdfId, 'seven-pages.pdf', 'application/pdf', sevenPages);

  const pagesRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: tooManyPagesPdfId,
    message: 'Analyze oversized page document',
    language: 'english'
  });
  const pagesPass = pagesRes.status === 413;
  console.log(`  Too many pages: ${pagesPass ? 'PASS (413 rejected)' : 'FAIL'}`);
  results.push({ name: 'Pages limit exceeded rejected', pass: pagesPass });
  await sleep(2500);

  // ==========================================
  // PART 2: Real Synthetic PDF Analysis
  // ==========================================

  // PDF 1: Two-Page LED Lab (Title, Components, Pin 9, 330 Ohm resistor, 500ms delay)
  console.log('[Test 5] Testing real PDF Analysis: Two-Page LED Lab...');
  pdf1LabId = crypto.randomUUID();
  const labPage1 = [
    'ECE 101: Introduction to Circuits - Lab Experiment 1',
    'Objective: Learn basic digital output using an Arduino UNO.',
    'Required Components:',
    '  - 1x Standard Red LED (Forward Voltage: 2.0V, Current: 20mA)',
    '  - 1x Current-limiting Resistor: 330 Ohms (1/4 Watt)',
    '  - 1x Arduino UNO R3 development board and half-size breadboard'
  ];
  const labPage2 = [
    'Circuit Assembly and Pin Connections:',
    '1. Connect the LED anode to Arduino digital Pin 9.',
    '2. Connect the LED cathode to one leg of the 330 Ohm resistor.',
    '3. Connect the other resistor leg to Arduino GND.',
    'Arduino Timing Specification:',
    'Set LED state HIGH for 500ms, then LOW for 500ms repeatedly in loop().',
    'Deliverable: Document your observed blink rate and calculate circuit current.'
  ];
  const pdf1Bytes = createPdf([labPage1, labPage2]);
  await uploadAssignmentFile(clients[0], fixtures[0].id, pdf1LabId, 'led-lab-1.pdf', 'application/pdf', pdf1Bytes);

  const labAnalysis = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: pdf1LabId,
    message: 'Analyze this lab assignment PDF. What are the required components, which Arduino pin is used, what is the blink timing, and on which pages are they specified?',
    language: 'english'
  });
  assert.equal(labAnalysis.ok, true, `Lab analysis failed: ${JSON.stringify(labAnalysis.data)}`);
  const a5 = labAnalysis.data.result.answer;
  // Ground truth checks: 330 Ohm, Pin 9, 500ms, Red LED, Page citations
  const has330 = /330\s*(?:ohm|Ω)/i.test(a5);
  const hasPin9 = /pin\s*9|D9/i.test(a5);
  const hasTiming = /500\s*ms/i.test(a5);
  const hasLed = /red\s*LED/i.test(a5);
  const hasCitations = /page\s*[12]/i.test(a5);
  const pdf1Pass = has330 && hasPin9 && hasTiming && hasLed && hasCitations;
  console.log(`  PDF 1 (Two-Page Lab): ${pdf1Pass ? 'PASS' : 'WARN'} [330Ω=${has330}, Pin9=${hasPin9}, 500ms=${hasTiming}, LED=${hasLed}, Citations=${hasCitations}]`);
  console.log(`    Snippet: "${a5.slice(0, 140).replace(/\n/g, ' ')}..."`);
  results.push({ name: 'Two-Page Ground Truth & Citation Verification', pass: pdf1Pass });
  await sleep(6000);

  // PDF 2: Repeated / Table Quantities (3x 10k resistors, 2x Pushbuttons, 1x Green LED)
  console.log('[Test 6] Testing real PDF Analysis: Component Quantities & Table...');
  pdf2TableId = crypto.randomUUID();
  const tablePages = [
    [
      'Digital Input and Pull-down Resistor Lab',
      'Table of Materials:',
      '  - 3 units: 10k Ohm Resistors (Color code: Brown, Black, Orange)',
      '  - 2 units: 6mm Momentary Pushbuttons',
      '  - 1 unit: 5mm Green LED',
      '  - 1 unit: 220 Ohm Resistor for LED'
    ],
    [
      'Circuit Instructions:',
      'Wire Button 1 with a 10k pull-down resistor to digital Pin 2.',
      'Wire Button 2 with a 10k pull-down resistor to digital Pin 3.',
      'Wire Green LED with 220 ohm resistor to digital Pin 8.'
    ]
  ];
  const pdf2Bytes = createPdf(tablePages);
  await uploadAssignmentFile(clients[0], fixtures[0].id, pdf2TableId, 'button-table-lab.pdf', 'application/pdf', pdf2Bytes);

  const tableAnalysis = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: pdf2TableId,
    message: 'What components and exact quantities are listed in this assignment?',
    language: 'english'
  });
  assert.equal(tableAnalysis.ok, true, `Table analysis failed: ${JSON.stringify(tableAnalysis.data)}`);
  const a6 = tableAnalysis.data.result.answer;
  // Must capture multiple quantities: 3x 10k (or 10 kΩ) and 2x buttons
  const has10kQty = /3\s*(?:x|units?|resistors?)?.*10\s*k/i.test(a6) || /10\s*k.*(?:3|three)/i.test(a6);
  const hasBtnQty = /2\s*(?:x|units?|pushbuttons?|buttons?)/i.test(a6) || /(?:push)?buttons?.*(?:2|two)/i.test(a6);
  const pdf2Pass = has10kQty && hasBtnQty;
  console.log(`  PDF 2 (Quantities): ${pdf2Pass ? 'PASS' : 'WARN'} [10kQty=${has10kQty}, BtnQty=${hasBtnQty}]`);
  console.log(`    Snippet: "${a6.slice(0, 140).replace(/\n/g, ' ')}..."`);
  results.push({ name: 'Component Quantities Extraction', pass: pdf2Pass });
  await sleep(6000);

  // PDF 3: Contradictory Instructions (Page 1 says 5V supply, Page 2 says 3.3V supply without resistor)
  console.log('[Test 7] Testing real PDF Analysis: Contradictory Instructions Detection...');
  pdf3ContradictoryId = crypto.randomUUID();
  const contradictPages = [
    [
      'Experiment 3: Voltage Supply Comparison',
      'Section A: Connect the test LED circuit to the 5V power supply with a 220 Ohm resistor.'
    ],
    [
      'Section B: Connect the exact same test LED directly to the 3.3V power supply without any resistor at all.',
      'Warning: Follow all instructor guidelines.'
    ]
  ];
  const pdf3Bytes = createPdf(contradictPages);
  await uploadAssignmentFile(clients[0], fixtures[0].id, pdf3ContradictoryId, 'contradictory-lab.pdf', 'application/pdf', pdf3Bytes);

  const contradictAnalysis = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: pdf3ContradictoryId,
    message: 'Check this lab handout for any contradictions, safety issues, or conflicting wiring requirements.',
    language: 'english'
  });
  assert.equal(contradictAnalysis.ok, true, `Contradictory analysis failed: ${JSON.stringify(contradictAnalysis.data)}`);
  const a7 = contradictAnalysis.data.result.answer;
  // Must notice the danger or conflict of connecting LED directly without resistor
  const hasConflict = /contradict|conflict|differ|discrepanc|danger|without\s*(?:a\s*)?resistor|burn|safety/i.test(a7);
  console.log(`  PDF 3 (Contradiction): ${hasConflict ? 'PASS' : 'WARN'}`);
  console.log(`    Snippet: "${a7.slice(0, 140).replace(/\n/g, ' ')}..."`);
  results.push({ name: 'Contradictory Requirements Detection', pass: hasConflict });
  await sleep(6000);

  // PDF 4: Ambiguous / Missing Specs (Missing supply voltage and LED color)
  console.log('[Test 8] Testing real PDF Analysis: Ambiguous / Incomplete Requirements...');
  pdf4AmbiguousId = crypto.randomUUID();
  const ambiguousPages = [
    [
      'Workshop Challenge: Light an Indicator LED',
      'Instructions: Pick any LED from the bin. Calculate the needed resistor value and assemble.',
      'Question: What exact resistor did you select?'
    ]
  ];
  const pdf4Bytes = createPdf(ambiguousPages);
  await uploadAssignmentFile(clients[0], fixtures[0].id, pdf4AmbiguousId, 'ambiguous-challenge.pdf', 'application/pdf', pdf4Bytes);

  const ambiguousAnalysis = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'pdf',
    assignmentId: pdf4AmbiguousId,
    message: 'What exact resistor value should I use to build this circuit based on this handout?',
    language: 'english'
  });
  assert.equal(ambiguousAnalysis.ok, true, `Ambiguous analysis failed: ${JSON.stringify(ambiguousAnalysis.data)}`);
  const a8 = ambiguousAnalysis.data.result.answer;
  // Must NOT give a single dogmatic number without explaining missing voltage/color
  const hasUncertainty = /depend|need|supply\s*voltage|forward\s*voltage|color|current|miss|unclear|clarif|specif/i.test(a8);
  console.log(`  PDF 4 (Missing Specs): ${hasUncertainty ? 'PASS' : 'WARN'}`);
  console.log(`    Snippet: "${a8.slice(0, 140).replace(/\n/g, ' ')}..."`);
  results.push({ name: 'Missing Specs Clarification & Abstention', pass: hasUncertainty });

  console.log('\n==========================================');
  console.log('--- MILESTONE 5 PDF EVALUATION SUMMARY ---');
  console.log('==========================================');
  let passCount = 0;
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (r.pass) passCount++;
  }
  console.log(`Total Score: ${passCount} / ${results.length} passed`);
  assert.equal(passCount, results.length, 'All Milestone 5 security and PDF analysis criteria must pass');

} finally {
  if (clients[1]) {
    await clients[1].storage.from('ohmi-assignments').remove([`${fixtures[1].id}/${userBAssignmentId}/assignment.pdf`]).catch(() => {});
  }
  if (clients[0]) {
    const userAFiles = [
      `${fixtures[0].id}/${corruptPdfId}/assignment.pdf`,
      `${fixtures[0].id}/${encryptedPdfId}/assignment.pdf`,
      `${fixtures[0].id}/${oversizedPdfId}/assignment.pdf`,
      `${fixtures[0].id}/${tooManyPagesPdfId}/assignment.pdf`,
      `${fixtures[0].id}/${pdf1LabId}/assignment.pdf`,
      `${fixtures[0].id}/${pdf2TableId}/assignment.pdf`,
      `${fixtures[0].id}/${pdf3ContradictoryId}/assignment.pdf`,
      `${fixtures[0].id}/${pdf4AmbiguousId}/assignment.pdf`
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
