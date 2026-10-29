import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFixture,
  buildEnv,
  mockGroq,
  memoryLedger,
} from "./circuit-build-fixtures.mjs";
import { validateCircuitSpec } from "../src/lib/playground/circuit-spec.ts";
import { planCircuitBuild } from "../../supabase/functions/ohmi-ai/circuit-builder.ts";
const userId = "11111111-1111-4111-8111-111111111111";
const body = () => ({
  version: 1,
  operation: "circuit_build",
  requestId: crypto.randomUUID(),
  conversationId: crypto.randomUUID(),
  language: "english",
  message: "Build an LED blinker.",
  accountId: userId,
});
test("qualified A/B preserve complete sketches and reject unsafe or executable specifications", async () => {
  for (const name of ["uno-blink", "uno-traffic-light"]) {
    const spec = await buildFixture(name);
    assert.deepEqual(validateCircuitSpec(spec), spec);
  }
  const original = await buildFixture();
  for (const change of [
    (s) => (s.parts[0].type = "javascript"),
    (s) => (s.parts[0].url = "https://evil.test"),
    (s) => (s.connections[0].from.pin = "invalid"),
    (s) => (s.parts[1].properties[0].value = "1"),
    (s) =>
      s.connections.push({
        from: { part: s.parts[0].id, pin: "5V" },
        to: { part: s.parts[0].id, pin: "GND" },
      }),
    (s) => s.parts.push({ ...s.parts[1] }),
    (s) => (s.library = []),
    (s) => (s.parts[0].sketch = "x".repeat(8001)),
    (s) => (s.status = "unsupported"),
  ]) {
    const spec = structuredClone(original);
    change(spec);
    assert.throws(() => validateCircuitSpec(spec));
  }
});
test("planner fixed strict120B, one request, replay and account isolation", async () => {
  const spec = await buildFixture(),
    jobs = [],
    ledger = memoryLedger(jobs),
    request = body();
  let calls = 0;
  const fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    const sent = JSON.parse(init.body);
    assert.equal(sent.model, "openai/gpt-oss-120b");
    assert.equal(sent.response_format.json_schema.strict, true);
    return mockGroq(spec);
  };
  const options = { body: request, userId, ledger, env: buildEnv, fetch };
  assert.equal(
    (await planCircuitBuild(options)).result.circuitSpec.parts[0].sketch,
    spec.parts[0].sketch,
  );
  await planCircuitBuild(options);
  assert.equal(calls, 1);
  await assert.rejects(
    planCircuitBuild({ ...options, body: { ...request, message: "Changed" } }),
    /different inputs/,
  );
  await assert.rejects(
    planCircuitBuild({ ...options, userId: "other" }),
    /Invalid/,
  );
  await assert.rejects(
    planCircuitBuild({
      ...options,
      body: body(),
      env: { ...buildEnv, OHMI_CIRCUIT_BUILD_FREE_TIER_VERIFIED: "false" },
    }),
    /unverified/,
  );
  assert.equal(calls, 1);
});
test("malformed/truncated/model mismatch/secret leakage/unsupported results never invoke repair or fallback", async () => {
  const spec = await buildFixture();
  for (const override of [
    { content: "{bad" },
    { finish: "length" },
    { model: "another-model" },
    {
      content: JSON.stringify({ ...spec, explanation: buildEnv.GROQ_API_KEY }),
    },
  ]) {
    let calls = 0;
    const jobs = [];
    await assert.rejects(
      planCircuitBuild({
        body: body(),
        userId,
        ledger: memoryLedger(jobs),
        env: buildEnv,
        fetch: async () => {
          calls++;
          return mockGroq(spec, override);
        },
      }),
    );
    assert.equal(calls, 1);
    assert.equal(jobs[0].status, "failed");
  }
  const unsupported = {
    ...spec,
    status: "unsupported",
    parts: [],
    connections: [],
    explanation: "That component is not qualified.",
  };
  const result = await planCircuitBuild({
    body: body(),
    userId,
    ledger: memoryLedger(),
    env: buildEnv,
    fetch: async () => mockGroq(unsupported),
  });
  assert.equal(result.result.status, "unsupported");
  assert.equal(result.result.circuitSpec.parts.length, 0);
});
test("cancellation, timeout and pending replay do not start hidden second requests", async () => {
  const abort = new AbortController();
  abort.abort();
  let calls = 0;
  await assert.rejects(
    planCircuitBuild({
      body: body(),
      userId,
      ledger: memoryLedger(),
      env: buildEnv,
      signal: abort.signal,
      fetch: async () => {
        calls++;
        throw Error("Unexpected network");
      },
    }),
    /cancelled/,
  );
  assert.equal(calls, 0);
  const request = body(),
    jobs = [],
    ledger = memoryLedger(jobs);
  await assert.rejects(
    planCircuitBuild({
      body: request,
      userId,
      ledger,
      env: buildEnv,
      deadline: Date.now() + 2005,
      fetch: async () => {
        calls++;
        return new Promise(() => {});
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal(jobs[0].status, "failed");
  jobs[0].status = "pending";
  await assert.rejects(
    planCircuitBuild({
      body: request,
      userId,
      ledger,
      env: buildEnv,
      fetch: async () => {
        calls++;
        throw Error("Unexpected network");
      },
    }),
    /still processing/,
  );
  assert.equal(calls, 1);
});
