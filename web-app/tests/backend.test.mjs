import test from "node:test";
import assert from "node:assert/strict";
import {
  accountEpoch,
  safeReturnPath,
  validateUploadMetadata,
  requireUuid,
  readBoundedBody,
} from "../src/lib/backend/guards.mjs";

test("account changes invalidate every captured private-data operation", () => {
  const epoch = accountEpoch();
  const first = epoch.capture();
  assert.ok(epoch.current(first));
  epoch.advance();
  assert.equal(epoch.current(first), false);
  assert.ok(epoch.current(epoch.capture()));
});
test("OAuth return paths stay within the app and reject encoded/open redirects", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/app/../admin",
    "/app/%2e%2e/admin",
    "/app/ask/?next=https://evil.test",
    "/app\\evil",
    "/app/auth/callback/",
  ])
    assert.equal(safeReturnPath(value), "/app/");
  assert.equal(safeReturnPath("/app/assignments/"), "/app/assignments/");
  assert.equal(safeReturnPath("/app/ask"), "/app/ask/");
  assert.equal(safeReturnPath("/app/library/resistor/"), "/app/library/resistor/");
  assert.equal(safeReturnPath("/app/login/"), "/app/");
  assert.equal(safeReturnPath("/app/library/../../admin/"), "/app/");
});
test("upload metadata bounds do not trust MIME alone or traversal filenames", () => {
  assert.equal(
    validateUploadMetadata({
      name: "assignment.pdf",
      type: "application/pdf",
      size: 100,
    }).extension,
    "pdf",
  );
  for (const f of [
    { name: "a.html", type: "image/png", size: 100 },
    { name: "../a.png", type: "image/png", size: 100 },
    { name: "a.png", type: "image/png", size: 0 },
    { name: "a.png", type: "image/png", size: 10485761 },
  ])
    assert.throws(() => validateUploadMetadata(f));
  assert.throws(() => requireUuid("other-user/path"));
  assert.equal(
    requireUuid("a38d2547-d2ca-4079-9ad4-4f46f25b29fe"),
    "a38d2547-d2ca-4079-9ad4-4f46f25b29fe",
  );
});

test("request bodies stop reading once their byte budget is exceeded", async () => {
  assert.equal(
    new TextDecoder().decode(
      await readBoundedBody(
        new Request("https://example.test", { method: "POST", body: "hello" }),
        10,
      ),
    ),
    "hello",
  );
  await assert.rejects(() =>
    readBoundedBody(
      new Request("https://example.test", { method: "POST", body: "too long" }),
      2,
    ),
  );
});

import {
  selectActiveConversation,
  isTerminalAiCode,
  completeSketchMarkdown,
} from "../src/lib/backend/guards.mjs";
test("workspace hydration selects a valid active conversation", () => {
  assert.equal(selectActiveConversation("", [{ id: "saved" }]), "saved");
  assert.equal(
    selectActiveConversation("saved", [{ id: "new" }, { id: "saved" }]),
    "saved",
  );
  assert.equal(selectActiveConversation("deleted", [{ id: "saved" }]), "saved");
  assert.equal(selectActiveConversation("saved", []), "");
});
test("AI retries renew terminal failures and preserve ambiguous or pending identity", () => {
  for (const code of [
    "unavailable",
    "provider_error",
    "timeout",
    "invalid_request",
  ])
    assert.equal(isTerminalAiCode(code), true, code);
  for (const code of [undefined, "server_error", "conflict", "request_pending"])
    assert.equal(isTerminalAiCode(code), false, String(code));
});
test("complete Arduino sketch is available separately from step snippets", () => {
  const sketch = "void setup() {}\nvoid loop() {}";
  assert.equal(
    completeSketchMarkdown({ code: sketch }),
    "```cpp\n" + sketch + "\n```",
  );
  assert.equal(completeSketchMarkdown({ steps: [{ code: "partial" }] }), "");
});

import { conversationMessages } from "../src/lib/backend/data.ts";
test("initial message load confirms readiness and filters both owner and conversation", async () => {
  const filters = [];
  const query = {
    select() {
      return this;
    },
    eq(k, v) {
      filters.push([k, v]);
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve) {
      return Promise.resolve({
        data: [
          {
            id: "m",
            role: "user",
            content: "synthetic",
            position: 1,
            structured_result: null,
          },
        ],
        error: null,
      }).then(resolve);
    },
  };
  const result = await conversationMessages(
    {
      from() {
        return query;
      },
    },
    "owner",
    "conversation",
  );
  assert.equal(result.loaded, true);
  assert.deepEqual(filters, [
    ["user_id", "owner"],
    ["conversation_id", "conversation"],
  ]);
  assert.equal(result.messages[0].text, "synthetic");
});

import { edgeFailure } from "../src/lib/backend/guards.mjs";
test("web proxy preserves the deployed Edge error string and code", () => {
  assert.deepEqual(
    edgeFailure({ ok: false, code: "failed", error: "Previously failed." }),
    { code: "failed", error: "Previously failed." },
  );
  assert.equal(isTerminalAiCode("failed"), true);
  assert.equal(isTerminalAiCode("in_progress"), false);
});

import { guideNeedsDetails } from "../src/lib/backend/guards.mjs";
test("tutorial clarification is shown without claiming a saved complete guide", () => {
  assert.equal(
    guideNeedsDetails({ status: "needs_clarification", steps: [] }),
    true,
  );
  assert.equal(guideNeedsDetails({ status: "unsupported" }), true);
  assert.equal(
    guideNeedsDetails({
      status: "tutorial",
      steps: [{ instruction: "Place component" }],
    }),
    false,
  );
});
