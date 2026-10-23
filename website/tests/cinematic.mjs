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
const hash = data => createHash('sha256').update(data).digest('hex');
assert.equal(hash(await readFile(new URL('../src/assets/ohmi.png', import.meta.url))), hash(await readFile(new URL('../../assets/mascot/ohmi-pixel-front.png', import.meta.url))));
console.log('Cinematic source and canonical artwork checks passed.');
