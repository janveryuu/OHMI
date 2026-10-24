import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const entries = JSON.parse(await readFile(new URL("../src/lib/library.json", import.meta.url), "utf8"));
test("20 distinct component guides have sourced references and valid related links", () => {
  assert.equal(entries.length, 20);
  const ids = new Set(entries.map((item) => item.id));
  assert.equal(ids.size, entries.length);
  for (const item of entries) {
    for (const field of ["name", "category", "description", "purpose", "useCase", "usage", "mistake", "activity", "referenceLabel"]) assert.ok(item[field]?.trim(), item.id + ": " + field);
    for (const field of ["source", "wiringSource"]) {
      const url = new URL(item[field]);
      assert.equal(url.protocol, "https:");
      assert.match(url.hostname, /^(learn\.(adafruit|sparkfun)\.com|www\.(adafruit|analog|vishay)\.com|docs\.arduino\.cc|data\.energizer\.com)$/);
    }
    assert.ok(item.related.length >= 2);
    item.related.forEach((id) => assert.ok(ids.has(id) && id !== item.id));
    assert.equal(item.illustration, "/app/library/" + item.id + ".webp");
  }
});
test("every published illustration decodes, is 4:3, unique and within delivery budget", async () => {
  let total = 0;
  const hashes = new Set();
  for (const item of entries) {
    const file = new URL("../public/library/" + item.id + ".webp", import.meta.url);
    const bytes = await readFile(file);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 1200, item.id);
    assert.equal(metadata.height, 900, item.id);
    assert.equal(metadata.format, "webp");
    total += bytes.length;
    assert.ok((await stat(file)).size < 160 * 1024, item.id + " exceeds 160 KiB");
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, entries.length);
  assert.ok(total < 2 * 1024 * 1024, "Library images exceed 2 MiB");
});
test("artwork rollout retains all three approved PNG masters unchanged", async () => {
  const approval = JSON.parse(await readFile(new URL("../design/library-soft-voxel/manifest.json", import.meta.url), "utf8"));
  for (const asset of approval.assets.filter((item) => item.path.endsWith(".png"))) {
    const bytes = await readFile(new URL("../design/library-soft-voxel/" + asset.path, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  }
});
