import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { startAuthFixture, seedSession, testUser } from './auth-fixture.mjs';
const fixture = await startAuthFixture(), browser = await chromium.launch();
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
fixture.state.ai = { conversationId: id, posts: [], jobs: [], messages: [
  { id: 'q1', user_id: testUser.id, role: 'user', content: 'Who are you?', position: 1 },
  { id: 'a1', user_id: testUser.id, role: 'assistant', content: 'I am OHMI.', structured_result: { mode: 'local' }, position: 2 },
  { id: 'q2', user_id: testUser.id, role: 'user', content: 'Explain resistance.', position: 3 },
  { id: 'a2', user_id: testUser.id, role: 'assistant', content: 'AI is temporarily unavailable.', structured_result: { mode: 'limited', provider: 'local', model: 'ohmi-local' }, position: 4 },
] };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); await seedSession(context);
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:3115/app/ask/');
  await page.getByText('Limited mode', { exact: true }).waitFor();
  assert.equal(await page.getByText('Local reply', { exact: true }).count(), 1);
  const draft = page.getByRole('textbox'); await draft.fill('Preserve this unrelated draft');
  await page.getByRole('button', { name: 'Retry question', exact: true }).click();
  await page.getByText('Continued explanation from the original PDF.', { exact: true }).waitFor();
  assert.equal(fixture.state.ai.posts.length, 1);
  assert.equal(fixture.state.ai.posts[0].message, 'Explain resistance.');
  assert.equal(fixture.state.ai.posts[0].operation, 'chat');
  assert.equal(await draft.inputValue(), 'Preserve this unrelated draft');
  assert.equal(await page.getByRole('button', { name: 'Retry question', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: saved local/limited labels, explicit retry uses original question, unrelated draft retained, no page errors');
} finally { await browser.close(); await fixture.close(); }
