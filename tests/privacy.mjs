import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

export async function testPrivacy(url, key, clients, users) {
  const [a, b] = clients;
  const bucket = 'ohmi-assignments';
  const check = (result) => { assert.equal(result.error, null, result.error?.message); return result.data; };
  const id = crypto.randomUUID();
  const path = `${users[0]}/${id}/assignment.pdf`;
  const pdf = new TextEncoder().encode('%PDF-1.7\nOHMI private test\n%%EOF');
  try {
    check(await a.from('ohmi_profiles').insert({ id: users[0], display_name: 'Student A', language: 'filipino' }));
    check(await b.from('ohmi_profiles').insert({ id: users[1], display_name: 'Student B', language: 'english' }));
    assert.deepEqual(check(await a.from('ohmi_profiles').select('id')).map(row => row.id), [users[0]]);
    assert.deepEqual(check(await b.from('ohmi_profiles').select('id')).map(row => row.id), [users[1]]);
    assert.ok((await b.from('ohmi_profiles').insert({ id: crypto.randomUUID() })).error);
    assert.equal(check(await b.from('ohmi_profiles').update({ language: 'taglish' }).eq('id', users[0]).select()).length, 0);
    const anonymous = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.ok((await anonymous.from('ohmi_profiles').select('*')).error, 'Anonymous table access denied');
    check(await a.from('ohmi_assignments').insert({ id, user_id: users[0], original_name: 'lab.pdf', object_path: path, mime_type: 'application/pdf', size_bytes: pdf.length }));
    assert.equal(check(await b.from('ohmi_assignments').select('*')).length, 0, 'Other user cannot list assignment');
    assert.ok((await b.from('ohmi_assignments').insert({ user_id: users[0], original_name: 'bad.pdf', object_path: path, mime_type: 'application/pdf', size_bytes: 5 })).error);
    assert.ok((await a.from('ohmi_assignments').update({ user_id: users[1] }).eq('id', id)).error, 'Owner field immutable');
    assert.ok((await a.from('ohmi_assignments').insert({ user_id: users[0], original_name: 'bad.pdf', object_path: '../escape', mime_type: 'application/pdf', size_bytes: 5 })).error, 'Object path constrained');
    check(await a.storage.from(bucket).upload(path, pdf, { contentType: 'application/pdf' }));
    assert.ok((await b.storage.from(bucket).download(path)).error, 'Other user cannot download');
    assert.ok((await b.storage.from(bucket).createSignedUrl(path, 60)).error, 'Other user cannot sign URL');
    assert.ok((await anonymous.storage.from(bucket).download(path)).error, 'Anonymous storage access denied');
    assert.equal(check(await a.storage.from(bucket).download(path)).size, pdf.length);
    const signed = check(await a.storage.from(bucket).createSignedUrl(path, 60));
    const retrieved = await fetch(signed.signedUrl);
    assert.equal(retrieved.status, 200, 'Owner signed URL retrieves private file');
    assert.deepEqual(new Uint8Array(await retrieved.arrayBuffer()), pdf);
    const failedDelete = await b.storage.from(bucket).remove([path]);
    assert.ok(failedDelete.error || failedDelete.data.length === 0, 'Other user cannot delete file');
    assert.equal(check(await a.storage.from(bucket).download(path)).size, pdf.length);
    assert.ok((await b.storage.from(bucket).upload(path, pdf, { contentType: 'application/pdf', upsert: true })).error, 'Other user cannot overwrite');
    check(await a.from('ohmi_assignments').update({ status: 'ready' }).eq('id', id));
    const step = check(await a.from('ohmi_assignment_steps').insert({ assignment_id: id, user_id: users[0], title: 'Read my assignment' }).select().single());
    assert.equal(check(await b.from('ohmi_assignment_steps').select('*')).length, 0);
    assert.ok((await b.from('ohmi_assignment_steps').insert({ assignment_id: id, user_id: users[1], title: 'Cross-owner step' })).error, 'Composite FK denies other assignment');
    assert.equal(check(await b.from('ohmi_assignment_steps').update({ completed: true }).eq('id', step.id).select()).length, 0);
    check(await a.from('ohmi_assignment_steps').update({ completed: true }).eq('id', step.id));
    assert.equal(check(await a.from('ohmi_assignment_steps').select('completed').eq('id', step.id).single()).completed, true);
    assert.equal(check(await b.from('ohmi_assignments').delete().eq('id', id).select()).length, 0);
    check(await a.storage.from(bucket).remove([path]));
    check(await a.from('ohmi_assignments').delete().eq('id', id));
    assert.equal(check(await a.from('ohmi_assignment_steps').select('*')).length, 0, 'Steps cascade only after assignment deletion');
  } finally {
    check(await a.storage.from(bucket).remove([path]));
    check(await a.from('ohmi_assignments').delete().eq('id', id));
  }
}
