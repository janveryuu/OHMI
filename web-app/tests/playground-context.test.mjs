import test from "node:test";
import assert from "node:assert/strict";
import { helpMessage } from "../src/lib/playground/context.ts";
import { startMission } from "../src/lib/playground/missions.ts";
test("context carries deterministic validation, component settings and terminal netlist without student identity", () => {
  const text = helpMessage(startMission("repair"), "Why is this unsafe?");
  assert.ok(text.length <= 2000);
  assert.match(text, /unsafe/);
  assert.match(text, /10/);
  assert.match(text, /wires/);
  assert.match(text, /Never override/);
  assert.doesNotMatch(text, /user_id|email/);
});
