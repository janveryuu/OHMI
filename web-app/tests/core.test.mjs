import test from "node:test";
import assert from "node:assert/strict";
import { validateFile, cropRect, lessonProgress } from "../src/lib/demo.mjs";

test("file boundary accepts only declared PDF, PNG or JPEG up to 10 MiB", () => {
  assert.equal(
    validateFile({ name: "lab.pdf", type: "application/pdf", size: 1024 }),
    null,
  );
  assert.match(
    validateFile({ name: "lab.svg", type: "image/svg+xml", size: 4 }),
    /PDF/,
  );
  assert.match(
    validateFile({
      name: "lab.png",
      type: "image/png",
      size: 11 * 1024 * 1024,
    }),
    /10 MB/,
  );
  assert.match(
    validateFile({ name: "empty.png", type: "image/png", size: 0 }),
    /empty/,
  );
  assert.match(
    validateFile({ name: "lab.html", type: "image/png", size: 5 }),
    /extension/,
  );
});
test("crop stays centered and bounded at extremes", () => {
  assert.deepEqual(cropRect(1000, 500, 100), {
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
  });
  assert.deepEqual(cropRect(1000, 500, 50), {
    x: 250,
    y: 125,
    width: 500,
    height: 250,
  });
  assert.deepEqual(cropRect(1000, 500, 200), {
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
  });
});
test("lesson progress derives from completed steps and handles empty guide", () => {
  assert.equal(lessonProgress([true, false, true]), 67);
  assert.equal(lessonProgress([]), 0);
});
