import test from 'node:test';
import assert from 'node:assert/strict';
import { askBackend } from '../src/lib/backend/ai.ts';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const payload = { requestId, operation: 'pdf', assignmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const saved = { ok: true, requestId, accountId: 'owner', status: 'completed', result: { answer: 'Original answer' } };
const json = (value, status = 200) => Response.json(value, { status });
function mock(t, replies) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([url, init]);
    const reply = replies.shift();
    assert.ok(reply, 'Unexpected additional request');
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return calls;
}
test('completed PDF recovery does not re-upload or call generation', async t => {
  const calls = mock(t, [json(saved)]);
  assert.deepEqual(await askBackend(payload), saved);
  assert.equal(calls.length, 1); assert.match(calls[0][0], /requests\/aaaaaaaa/);
});
test('unknown UUID posts once, retaining original owned material and identity', async t => {
  const calls = mock(t, [json({},404), json(saved)]);
  await askBackend(payload);
  assert.equal(calls.length,2); assert.equal(calls[1][1].method,'POST');
  assert.deepEqual(JSON.parse(calls[1][1].body),payload);
});
test('a newly created UUID skips read preflight and still posts only once', async t => {
  const calls = mock(t, [json(saved)]);
  assert.deepEqual(await askBackend(payload, undefined, { fresh: true }), saved);
  assert.equal(calls.length, 1); assert.equal(calls[0][1].method, 'POST');
});
test('an ambiguous fresh POST still recovers by UUID without regeneration', async t => {
  const calls = mock(t, [new TypeError('Network lost'), json(saved)]);
  assert.deepEqual(await askBackend(payload, undefined, { fresh: true }), saved);
  assert.equal(calls.filter(call => call[1]?.method === 'POST').length, 1);
  assert.match(calls[1][0], /requests/);
});
test('lost POST acknowledgement recovers exact result without another generation', async t => {
  const calls = mock(t,[json({},404),new TypeError('Network lost'),json(saved)]);
  assert.deepEqual(await askBackend(payload),saved);
  assert.equal(calls.filter(c=>c[1]?.method === 'POST').length,1);
});
test('pending request retains UUID and never posts', async t => {
  const calls = mock(t,[json({ok:true,requestId,status:'pending'})]);
  await assert.rejects(()=>askBackend(payload),e=>e.code==='in_progress' && e.terminal===false);
  assert.equal(calls.length,1);
});
test('unknown proxy failure remains ambiguous after a missing recovery row', async t => {
  const calls = mock(t,[json({},404),json({error:'Gateway failed'},502),json({},404)]);
  await assert.rejects(()=>askBackend(payload),e=>e.terminal===false);
  assert.equal(calls.filter(c=>c[1]?.method === 'POST').length,1);
});
test('failed existing request requires a deliberate new UUID without generation', async t => {
  const calls = mock(t,[json({ok:true,requestId,status:'failed'})]);
  await assert.rejects(()=>askBackend(payload),e=>e.code==='failed' && e.terminal===true);
  assert.equal(calls.length,1);
});
test('unavailable recovery/account verification never falls through to POST', async t => {
  const calls = mock(t,[json({error:'Sign in again'},401)]);
  await assert.rejects(()=>askBackend(payload)); assert.equal(calls.length,1);
});
test('a mismatched recovered request is rejected without generation', async t => {
  const calls = mock(t,[json({...saved,requestId:'different'})]);
  await assert.rejects(()=>askBackend(payload)); assert.equal(calls.length,1);
});

test('expired lease allows a deliberate fresh attempt without another POST during recovery', async t => {
  const calls=mock(t,[json({ok:true,requestId,status:'expired'})]);
  await assert.rejects(()=>askBackend(payload),e=>e.terminal===true && /lease expired/.test(e.message));assert.equal(calls.length,1);
});
