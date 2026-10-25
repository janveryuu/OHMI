import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
assert.match(html, /YOUR CIRCUIT BUDDY/);
assert.match(html, /id="scene-motion"/);
assert.match(html, /aria-pressed="false"/);
assert.ok(!html.includes('cloudfront.net'), 'No original dog plate');
for (const asset of ['ask-workshop.webp', 'check-workshop.webp', 'build-workshop.webp']) {
  assert.ok(html.includes(`assets/${asset}`), `Approved Explore image is used: ${asset}`);
  assert.ok((await readFile(new URL(`../src/assets/${asset}`, import.meta.url))).length > 0);
}
assert.equal((html.match(/id="get-started"/g) || []).length, 1, 'One preserved setup destination');
assert.match(html, /class="pill primary" href="\/app\/">Open the PWA/);
assert.match(html, /class="pill repository" href="https:\/\/github.com\/janveryuu\/OHMI#-quickstart" target="_blank" rel="noopener noreferrer">View on GitHub/);
for (const route of ['/app/ask', '/app/checker', '/app/guide']) assert.ok(html.includes(`href="${route}"`));
const hash = data => createHash('sha256').update(data).digest('hex');
assert.equal(hash(await readFile(new URL('../src/assets/ohmi.png', import.meta.url))), hash(await readFile(new URL('../../assets/mascot/ohmi-pixel-front.png', import.meta.url))));
console.log('Cinematic source and canonical artwork checks passed.');
