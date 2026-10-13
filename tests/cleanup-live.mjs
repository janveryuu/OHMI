import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const target = 'vhmdgfydvoljzqztuxmu';
assert.equal((await readFile('supabase/.temp/project-ref', 'utf8')).trim(), target);
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
assert.equal(env.WXT_SUPABASE_URL, `https://${target}.supabase.co`);
const workspace = resolve('.superpowers/sdd/2026-10-12-phase-3');
const sqlFile = resolve(workspace, 'cleanup-fixture.sql');
for (const name of await readdir(workspace)) {
  if (!/^live-fixture-[\da-f-]{36}\.json$/.test(name)) continue;
  const path = resolve(workspace, name); assert.equal(dirname(path), workspace);
  const users = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(users.length, 2);
  for (const user of users) {
    assert.match(user.id, /^[\da-f-]{36}$/); assert.match(user.email, /^ohmi-phase3-[\da-f-]{36}@example\.test$/);
    const client = createClient(env.WXT_SUPABASE_URL, env.WXT_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await client.auth.signInWithPassword({ email: user.email, password: user.password });
    assert.equal(signedIn.error, null, signedIn.error?.message); assert.equal(signedIn.data.user.id, user.id);
    const files = await client.from('ohmi_assignments').select('object_path').eq('user_id', user.id);
    assert.equal(files.error, null);
    if (files.data.length) assert.equal((await client.storage.from('ohmi-assignments').remove(files.data.map(file => file.object_path))).error, null);
    assert.equal((await client.from('ohmi_assignments').delete().eq('user_id', user.id)).error, null);
  }
  const ids = users.map(user => `'${user.id}'::uuid`).join(',');
  await writeFile(sqlFile, `with removed as (delete from auth.users where id in (${ids}) and raw_user_meta_data->>'ohmi_phase3_test'='true' and email like 'ohmi-phase3-%@example.test' returning id) select count(*) as removed from removed;`);
  const result = JSON.parse(execFileSync('cmd.exe', ['/d', '/c', 'npx', '--yes', 'supabase@2.120.0', 'db', 'query', '--linked', '--file', sqlFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  assert.equal(result.rows?.[0].removed, 2);
  await unlink(path); await unlink(sqlFile);
  console.log('Cleaned two recorded disposable Phase 3 test accounts and their files; other data unchanged.');
}
