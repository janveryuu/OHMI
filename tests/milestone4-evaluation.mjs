import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createPng } from './fixtures/create-png.mjs';

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
  email: `ohmi-m4-${crypto.randomUUID()}@example.test`,
  password: `Test-${crypto.randomUUID()}`
}));

const workspace = resolve('.superpowers/sdd/2026-10-12-phase-3');
await mkdir(workspace, { recursive: true });
const sqlFile = resolve(workspace, 'live-fixture-m4.sql');

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
let corruptAssignmentId = crypto.randomUUID();
let oversizedAssignmentId = crypto.randomUUID();
let clearCircuitId = crypto.randomUUID();
let mistakeCircuitId = crypto.randomUUID();
let ambiguousCircuitId = crypto.randomUUID();
let adminClient;

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

  // Privileged admin client for fixture creation
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || (await readFile('.env', 'utf8')).match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
  adminClient = createClient(env.WXT_SUPABASE_URL, serviceKey || env.WXT_SUPABASE_PUBLISHABLE_KEY);

  console.log('--- Starting Milestone 4 (Circuit Image Understanding) ---');

  // ==========================================
  // PART 1: Security & Validation Rejections
  // ==========================================

  // 1. Foreign Assignment ID (User A attempts to access User B's image)
  console.log('[Test 1] Testing cross-owner access denial...');
  userBAssignmentId = crypto.randomUUID();
  const testPng = createPng(64, 64);
  await uploadAssignmentFile(clients[1], fixtures[1].id, userBAssignmentId, 'circuit-b.png', 'image/png', testPng);

  const crossOwnerRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'image',
    assignmentId: userBAssignmentId,
    message: 'Analyze this foreign circuit',
    language: 'english'
  });
  const crossOwnerPass = crossOwnerRes.status === 404 && crossOwnerRes.data?.code === 'not_found';
  console.log(`  Cross-owner access: ${crossOwnerPass ? 'PASS (404 denied)' : 'FAIL'}`);
  results.push({ name: 'Cross-owner access denied', pass: crossOwnerPass });
  await sleep(1500);

  // 2. Missing assignment ID
  console.log('[Test 2] Testing non-existent assignment rejection...');
  const nonExistentRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'image',
    assignmentId: crypto.randomUUID(),
    message: 'Analyze non-existent',
    language: 'english'
  });
  const nonExistentPass = nonExistentRes.status === 404;
  console.log(`  Non-existent assignment: ${nonExistentPass ? 'PASS (404 denied)' : 'FAIL'}`);
  results.push({ name: 'Non-existent assignment rejected', pass: nonExistentPass });
  await sleep(1500);

  // 3. Corrupt image body
  console.log('[Test 3] Testing corrupt image rejection...');
  corruptAssignmentId = crypto.randomUUID();
  const corruptBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00]); // truncated magic bytes
  await uploadAssignmentFile(clients[0], fixtures[0].id, corruptAssignmentId, 'corrupt.png', 'image/png', corruptBytes);

  const corruptRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'image',
    assignmentId: corruptAssignmentId,
    message: 'Analyze corrupt image',
    language: 'english'
  });
  const corruptPass = corruptRes.status === 415;
  console.log(`  Corrupt image: ${corruptPass ? 'PASS (415 rejected)' : 'FAIL'}`);
  results.push({ name: 'Corrupt image rejected', pass: corruptPass });
  await sleep(1500);

  // 4. Oversized dimensions rejection
  console.log('[Test 4] Testing oversized dimensions rejection...');
  oversizedAssignmentId = crypto.randomUUID();
  const oversizedHeader = Buffer.alloc(24);
  oversizedHeader.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  oversizedHeader.writeUInt32BE(13, 8);
  oversizedHeader.set([0x49, 0x48, 0x44, 0x52], 12);
  oversizedHeader.writeUInt32BE(5000, 16); // 5000 px > 4096 px
  oversizedHeader.writeUInt32BE(100, 20);
  await uploadAssignmentFile(clients[0], fixtures[0].id, oversizedAssignmentId, 'oversized.png', 'image/png', oversizedHeader);

  const oversizedRes = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'image',
    assignmentId: oversizedAssignmentId,
    message: 'Analyze oversized image',
    language: 'english'
  });
  const oversizedPass = oversizedRes.status === 413;
  console.log(`  Oversized dimensions: ${oversizedPass ? 'PASS (413 rejected)' : 'FAIL'}`);
  results.push({ name: 'Oversized dimensions rejected', pass: oversizedPass });
  await sleep(1500);

  // ==========================================
  // PART 2: Real Synthetic Image Analysis
  // ==========================================

  // Image 1: Clear Simple Circuit (LED with resistor to 5V)
  console.log('[Test 5] Testing real Image Analysis: Clear LED Circuit...');
  clearCircuitId = crypto.randomUUID();
  // Draw an illustrative circuit graphic (red rectangle for LED, brown/gold band for resistor)
  const clearPng = createPng(200, 200, (x, y) => {
    // Top: 5V rail (red bar)
    if (y < 20) return [220, 20, 20];
    // Bottom: GND rail (black/blue bar)
    if (y > 180) return [20, 20, 20];
    // Center left: Resistor (brown body with bands)
    if (x > 40 && x < 80 && y > 70 && y < 130) return [180, 130, 70];
    // Center right: LED (bright red circular cluster)
    if (Math.hypot(x - 140, y - 100) < 25) return [255, 0, 0];
    // Background: light gray breadboard
    return [240, 240, 240];
  });
  await uploadAssignmentFile(clients[0], fixtures[0].id, clearCircuitId, 'simple-led-circuit.png', 'image/png', clearPng);

  const clearAnalysis = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'image',
    assignmentId: clearCircuitId,
    message: 'Please analyze this circuit screenshot. Describe what components are visible, and check for any wiring issues.',
    language: 'english'
  });
  assert.equal(clearAnalysis.ok, true, `Clear analysis failed: ${JSON.stringify(clearAnalysis.data)}`);
  const a5 = clearAnalysis.data.result.answer;
  // Must mention LED/resistor/components and must NOT claim electrical verification
  const img1Pass = (/LED|resistor|component/i.test(a5)) &&
                   (/not\s*(?:electrically\s*)?verified|visual|screenshot|cannot\s*guarantee|caution|uncertain|inspect|image\s+alone|can't\s*be\s*100%|detail/i.test(a5));
  console.log(`  Image 1 (Clear): ${img1Pass ? 'PASS' : 'WARN'} - Snippet: "${a5.slice(0, 120).replace(/\n/g, ' ')}..."`);
  results.push({ name: 'Clear Circuit Image Analysis', pass: img1Pass });
  await sleep(3500);

  // Image 2: Planted Mistake (Direct LED across rails without resistor)
  console.log('[Test 6] Testing real Image Analysis: Planted Mistake (Missing Resistor)...');
  mistakeCircuitId = crypto.randomUUID();
  const mistakePng = createPng(200, 200, (x, y) => {
    // Red 5V rail top, GND bottom, LED directly connected between them with no resistor
    if (y < 25) return [255, 0, 0];
    if (y > 175) return [0, 0, 255];
    // LED in middle
    if (Math.hypot(x - 100, y - 100) < 20) return [255, 0, 0];
    // Direct wires from rails to LED
    if (x >= 98 && x <= 102) return [50, 50, 50];
    return [255, 255, 255];
  });
  await uploadAssignmentFile(clients[0], fixtures[0].id, mistakeCircuitId, 'led-no-resistor.png', 'image/png', mistakePng);

  const mistakeAnalysis = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'image',
    assignmentId: mistakeCircuitId,
    message: 'Is this LED circuit safe to power on? What issues or missing components do you notice?',
    language: 'english'
  });
  assert.equal(mistakeAnalysis.ok, true, `Mistake analysis failed: ${JSON.stringify(mistakeAnalysis.data)}`);
  const a6 = mistakeAnalysis.data.result.answer;
  // Must warn about current limiting resistor / burning out LED / overcurrent
  const img2Pass = (/resistor/i.test(a6)) && (/burn|damage|current|limit|safe|danger|omit|miss/i.test(a6));
  console.log(`  Image 2 (Mistake): ${img2Pass ? 'PASS' : 'WARN'} - Snippet: "${a6.slice(0, 120).replace(/\n/g, ' ')}..."`);
  results.push({ name: 'Planted Mistake (Missing Resistor) Warning', pass: img2Pass });
  await sleep(3500);

  // Image 3: Ambiguous / Obscured Wiring
  console.log('[Test 7] Testing real Image Analysis: Ambiguous Overlap / Uncertainty...');
  ambiguousCircuitId = crypto.randomUUID();
  const ambiguousPng = createPng(150, 150, (x, y) => {
    // Mess of overlapping dark lines
    if (Math.abs(x - y) < 4 || Math.abs(x + y - 150) < 4 || Math.abs(x - 75) < 3) return [50, 50, 50];
    return [230, 230, 230];
  });
  await uploadAssignmentFile(clients[0], fixtures[0].id, ambiguousCircuitId, 'ambiguous-wiring.png', 'image/png', ambiguousPng);

  const ambiguousAnalysis = await invokeAi(tokens[0], {
    version: 1,
    requestId: crypto.randomUUID(),
    operation: 'image',
    assignmentId: ambiguousCircuitId,
    message: 'Can you verify if all breadboard connections here are correct?',
    language: 'english'
  });
  assert.equal(ambiguousAnalysis.ok, true, `Ambiguous analysis failed: ${JSON.stringify(ambiguousAnalysis.data)}`);
  const a7 = ambiguousAnalysis.data.result.answer;
  // Must express uncertainty or ask for clarification/clearer view
  const img3Pass = (/unclear|difficult|cannot|hard|clarif|uncertain|angle|clearer|overlap/i.test(a7));
  console.log(`  Image 3 (Ambiguous): ${img3Pass ? 'PASS' : 'WARN'} - Snippet: "${a7.slice(0, 120).replace(/\n/g, ' ')}..."`);
  results.push({ name: 'Ambiguous Wiring Abstention & Uncertainty', pass: img3Pass });

  console.log('\n==========================================');
  console.log('--- MILESTONE 4 IMAGE EVALUATION SUMMARY ---');
  console.log('==========================================');
  let passCount = 0;
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (r.pass) passCount++;
  }
  console.log(`Total Score: ${passCount} / ${results.length} passed`);
  assert.equal(passCount, results.length, 'All Milestone 4 security and image analysis criteria must pass');

} finally {
  if (clients[1]) {
    await clients[1].storage.from('ohmi-assignments').remove([`${fixtures[1].id}/${userBAssignmentId}/assignment.png`]).catch(() => {});
  }
  if (clients[0]) {
    const userAFiles = [
      `${fixtures[0].id}/${corruptAssignmentId}/assignment.png`,
      `${fixtures[0].id}/${oversizedAssignmentId}/assignment.png`,
      `${fixtures[0].id}/${clearCircuitId}/assignment.png`,
      `${fixtures[0].id}/${mistakeCircuitId}/assignment.png`,
      `${fixtures[0].id}/${ambiguousCircuitId}/assignment.png`
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
