import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { testPrivacy } from './privacy.mjs';
import { testExtensionBackend } from './extension-backend.mjs';
import { testAiLive } from './ai-live.mjs';

const target = 'vhmdgfydvoljzqztuxmu';
assert.equal((await readFile('supabase/.temp/project-ref', 'utf8')).trim(), target, 'Refuse any other linked project');
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
assert.equal(env.WXT_SUPABASE_URL, `https://${target}.supabase.co`);
assert.match(env.WXT_SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/);
const fixtures = [0, 1].map(() => ({ id: crypto.randomUUID(), email: `ohmi-phase3-${crypto.randomUUID()}@example.test`, password: `Test-${crypto.randomUUID()}` }));
const workspace = resolve('.superpowers/sdd/2026-10-12-phase-3');
await mkdir(workspace, { recursive: true });
const sqlFile = resolve(workspace, 'live-fixture.sql');
const fixtureFile = resolve(workspace, `live-fixture-${fixtures[0].id}.json`);
await writeFile(fixtureFile, JSON.stringify(fixtures));
const query = async sql => {
  await writeFile(sqlFile, sql);
  const output = execFileSync('cmd.exe', ['/d', '/c', 'npx', '--yes', 'supabase@2.120.0', 'db', 'query', '--linked', '--file', sqlFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const result = JSON.parse(output);
  if (result.error) throw new Error(result.error.message);
  return result.rows;
};
const rows = fixtures.map(user => `('${user.id}'::uuid,'${user.email}','${user.password}')`).join(',');
const ids = fixtures.map(user => `'${user.id}'::uuid`).join(',');
let verified = false;
try {
  const inserted = await query(`with input(id,email,password) as (values ${rows}), created as (
    insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,reauthentication_token,raw_app_meta_data,raw_user_meta_data)
    select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,extensions.crypt(password,extensions.gen_salt('bf')),now(),now(),now(),'','','','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('ohmi_phase3_test',true) from input returning id,email
  ), identities as (
    insert into auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at)
    select gen_random_uuid(),id,id::text,'email',jsonb_build_object('sub',id::text,'email',email,'email_verified',true),now(),now() from created returning user_id
  ) select count(*) as created from identities;`);
  assert.equal(inserted[0].created, 2);
  const clients = [];
  for (const user of fixtures) {
    const client = createClient(env.WXT_SUPABASE_URL, env.WXT_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
    assert.equal(result.error, null, result.error?.message); assert.equal(result.data.user.id, user.id);
    clients.push(client);
  }
  if (process.env.OHMI_AI_TEST === '1') await testAiLive(env, clients, fixtures);
  else { await testPrivacy(env.WXT_SUPABASE_URL, env.WXT_SUPABASE_PUBLISHABLE_KEY, clients, fixtures.map(user => user.id)); await testExtensionBackend(fixtures); }
  verified = true;
  console.log('PASS LIVE two-user isolation and owner CRUD: profiles, preferences, assignment rows/files, signed URLs, steps, cross-owner/anonymous read-write-delete denial.');
} finally {
  if (verified) {
    const removed = await query(`with removed as (delete from auth.users where id in (${ids}) and raw_user_meta_data->>'ohmi_phase3_test'='true' and email like 'ohmi-phase3-%@example.test' returning id) select count(*) as removed from removed;`);
    assert.equal(removed[0].removed, 2);
    await unlink(fixtureFile); await unlink(sqlFile);
    console.log('PASS live fixture cleanup: only the two generated test accounts removed; file/metadata already cleaned through owner APIs.');
  } else console.error('Live check failed. Generated test fixtures retained in ignored local workspace for diagnosis and safe cleanup.');
}
