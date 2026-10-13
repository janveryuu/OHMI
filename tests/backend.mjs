import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { testPrivacy } from './privacy.mjs';

const env = JSON.parse(execFileSync('cmd.exe', ['/d', '/c', 'npx', '--yes', 'supabase@2.120.0', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(new URL(env.API_URL).hostname, '127.0.0.1', 'Fixtures are local only');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const key = env.PUBLISHABLE_KEY || env.ANON_KEY;
const admin = createClient(env.API_URL, env.SECRET_KEY || env.SERVICE_ROLE_KEY, options);
const users = [];
const clients = [];
const check = result => { assert.equal(result.error, null, result.error?.message); return result.data; };
try {
  for (let index = 0; index < 2; index++) {
    const email = `ohmi-test-${crypto.randomUUID()}@example.test`;
    const password = `Test-${crypto.randomUUID()}`;
    const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
    users.push(user.id);
    const client = createClient(env.API_URL, key, options);
    check(await client.auth.signInWithPassword({ email, password })); clients.push(client);
  }
  await testPrivacy(env.API_URL, key, clients, users);
  console.log('PASS local two-user isolation and owner CRUD: profiles, preferences, assignments/files, steps, signed URLs, anonymous/cross-owner denial.');
} finally {
  for (const userId of users) {
    const files = check(await admin.from('ohmi_assignments').select('object_path').eq('user_id', userId));
    if (files.length) check(await admin.storage.from('ohmi-assignments').remove(files.map(file => file.object_path)));
    check(await admin.auth.admin.deleteUser(userId));
  }
}
