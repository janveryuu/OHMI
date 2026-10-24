import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { inspectMedia } from "../src/lib/backend/media.ts";

test("server inspects real image bytes and rejects spoofed MIME and corrupt files", async () => {
  const bytes = await sharp({
    create: { width: 4, height: 3, channels: 3, background: "#08776b" },
  })
    .png()
    .toBuffer();
  const result = await inspectMedia(bytes, "image/png");
  assert.equal(result.type, "image/png");
  assert.equal(result.width, 4);
  await assert.rejects(() => inspectMedia(bytes, "image/jpeg"));
  await assert.rejects(() =>
    inspectMedia(Buffer.from("<html>fake</html>"), "image/png"),
  );
  await assert.rejects(() =>
    inspectMedia(Buffer.from("%PDF-fake"), "application/pdf"),
  );
});
