import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("loading design system components are exported and intact", async () => {
  const indexSource = await readFile(
    new URL("../src/components/ui/index.ts", import.meta.url),
    "utf8",
  );
  assert.ok(indexSource.includes("./loading-spinner"), "LoadingSpinner exported");
  assert.ok(indexSource.includes("./loading-skeleton"), "LoadingSkeleton exported");
  assert.ok(indexSource.includes("./typing-indicator"), "OhmiTypingIndicator exported");
  assert.ok(indexSource.includes("./loading-status"), "LoadingStatus exported");
  assert.ok(indexSource.includes("./upload-progress"), "UploadProgress exported");
  assert.ok(indexSource.includes("./async-status-card"), "AsyncStatusCard exported");
});

test("circuit checker defines all four honest verification stages without fake progress", async () => {
  const checkerSource = await readFile(
    new URL("../src/components/circuit-checker.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(checkerSource.includes("preparing_image"), "Stage 1: preparing_image");
  assert.ok(checkerSource.includes("validating_evidence"), "Stage 2: validating_evidence");
  assert.ok(checkerSource.includes("analyzing_circuit"), "Stage 3: analyzing_circuit");
  assert.ok(checkerSource.includes("preparing_feedback"), "Stage 4: preparing_feedback");
  assert.ok(
    checkerSource.includes("<AsyncStatusCard"),
    "AsyncStatusCard rendered in findings panel",
  );
});

test("upload progress communicates truthful storage and metadata stages", async () => {
  const uploadSource = await readFile(
    new URL("../src/components/ui/upload-progress.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(uploadSource.includes("preparing"), "Supports preparing stage");
  assert.ok(uploadSource.includes("uploading"), "Supports uploading stage");
  assert.ok(uploadSource.includes("processing"), "Supports processing stage");
  assert.ok(uploadSource.includes("saving"), "Supports saving stage");
  assert.ok(uploadSource.includes("complete"), "Supports complete stage");
  assert.ok(uploadSource.includes("indeterminate-progress-bar"), "Uses indeterminate animation when % unknown");
});

test("ask OHMI chat implements optimistic bubble, typing indicator, and recoverable drafts", async () => {
  const chatSource = await readFile(
    new URL("../src/components/chat.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(chatSource.includes("optimisticUser"), "Optimistic message state present");
  assert.ok(chatSource.includes("pending-message"), "Right-aligned pending bubble styling present");
  assert.ok(chatSource.includes('aria-label="OHMI is thinking"'), "Minimal accessible typing status present");
  assert.ok(!chatSource.includes("LoadingSkeleton"), "Chat no longer renders skeleton cards");
  assert.ok(chatSource.includes("Restore question"), "Draft recovery present on failure");
  assert.ok(chatSource.includes("isNearBottomRef"), "Near-bottom scroll check protects user reading position");
});

test("globals.css defines reduced-motion overrides for all loading animations", async () => {
  const css = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );
  assert.ok(css.includes("@keyframes typingDotBounce"), "typingDotBounce keyframes defined");
  assert.ok(css.includes("@keyframes skeletonShimmerGradient"), "skeletonShimmerGradient keyframes defined");
  assert.ok(css.includes("@keyframes indeterminateProgress"), "indeterminateProgress keyframes defined");
  assert.ok(css.includes("@keyframes scanBeam"), "scanBeam keyframes defined");
  assert.ok(css.includes("prefers-reduced-motion: reduce"), "prefers-reduced-motion: reduce rules defined");
});
