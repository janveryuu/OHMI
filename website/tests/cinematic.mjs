import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
assert.match(html, /YOUR CIRCUIT BUDDY/);
assert.match(html, /id="scene-motion"/);
assert.match(html, /aria-pressed="false"/);
assert.match(html, /class="pill launch" href="\/app"/);
assert.match(html, /class="pill primary enter" href="\/app"/);
for (const route of ['ask', 'checker', 'guide']) assert.ok(html.includes(`class="feature-card enter" href="/app/${route}"`));
assert.ok(!html.includes('cloudfront.net'), 'No original dog plate');
for (const asset of ['ask-workshop.webp', 'check-workshop.webp', 'build-workshop.webp']) {
  assert.ok(html.includes(`src="assets/${asset}"`), `Approved Explore artwork must be retained: ${asset}`);
  assert.ok((await readFile(new URL(`../src/assets/${asset}`, import.meta.url))).length > 0);
}
assert.match(html, /class="pill primary" href="\/app\/">Open the PWA/);
assert.match(html, /class="pill repository" href="https:\/\/github.com\/janveryuu\/OHMI#-quickstart" target="_blank" rel="noopener noreferrer">View on GitHub/);
assert.equal((html.match(/id="get-started"/g) || []).length, 1);
assert.match(html, /id="meet-dance"[^>]*data-src="assets\/ohmi-breakdance.webm"/, 'Preserve the latest approved animation');
const hash = data => createHash('sha256').update(data).digest('hex');
assert.equal(hash(await readFile(new URL('../src/assets/ohmi.png', import.meta.url))), hash(await readFile(new URL('../../assets/mascot/ohmi-pixel-front.png', import.meta.url))));
console.log('Cinematic source and canonical artwork checks passed.');
