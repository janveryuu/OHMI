import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const css = await readFile(resolve(root, 'styles.css'), 'utf8');
for (const [, asset] of [...html.matchAll(/(?:src|href)="([^"#]+)"/g), ...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)]) {
  if (/^https?:/.test(asset)) continue;
  const path = resolve(root, asset);
  assert.ok(path.startsWith(root + sep), `Asset must stay in website: ${asset}`);
  assert.ok((await readFile(path)).length, `Asset must exist: ${asset}`);
}
for (const name of await readdir(root)) assert.ok(!/^(?:\.env|\.git|node_modules|supabase|entrypoints)/.test(name), `Unexpected deployment file: ${name}`);
assert.equal(createHash('sha256').update(await readFile(resolve(root, 'assets/ohmi.png'))).digest('hex').toUpperCase(), '815AD3DFF06433ED9081EF1A73FAC2F97D7943D760E95A9AC11660D11AD39382');
assert.match(html, /aria-label="Download extension — Coming Soon" disabled>Coming Soon<\/button>/);
assert.match(html, /name="description"/);
assert.match(html, /rel="canonical" href="https:\/\/meetohmi\.vercel\.app\/"/);
console.log('Production static build verified: local assets, original mascot, SEO and Coming Soon control. Output: dist/; no dependencies or environment variables.');
