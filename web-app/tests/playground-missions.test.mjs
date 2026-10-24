import test from "node:test";
import assert from "node:assert/strict";
import {
  startMission,
  missionProgress,
  observeCheck,
  missions,
} from "../src/lib/playground/missions.ts";
import { evaluate } from "../src/lib/playground/engine.ts";
test("three missions have objectives, three progressive hints, and no initial success", () => {
  assert.equal(missions.length, 3);
  for (const m of missions) {
    assert.equal(m.hints.length, 3);
    assert.ok(m.objective);
    const p = startMission(m.id);
    assert.equal(missionProgress(p).complete, false);
  }
});
test("repair mission contains known unsafe low resistor; changing resistor fixes it", () => {
  let p = startMission("repair");
  assert.equal(evaluate(p).status, "unsafe");
  p.parts.find((c) => c.kind === "resistor").value = 330;
  assert.equal(missionProgress(p).complete, true);
  assert.ok(observeCheck(p).completed.includes("repair"));
});
test("switch mission requires checking both open and closed on the same circuit", () => {
  let p = startMission("switch");
  assert.equal(missionProgress(p).complete, false);
  p = observeCheck(p);
  assert.deepEqual(p.switchSeen, ["open"]);
  p.parts.find((c) => c.kind === "switch").closed = true;
  p = observeCheck(p);
  assert.equal(missionProgress(p).complete, true);
  assert.ok(p.completed.includes("switch"));
  p.parts.find((c) => c.kind === "resistor").value = 10;
  p = observeCheck(p);
  assert.equal(missionProgress(p).complete, false);
  assert.deepEqual(p.switchSeen, []);
});
test("basic LED mission requires a validated lit series circuit, not component count", () => {
  let p = startMission("led");
  assert.equal(p.wires.length, 0);
  assert.equal(missionProgress(p).complete, false);
  const ids = Object.fromEntries(p.parts.map((c) => [c.kind, c.id]));
  p.wires = [
    {
      id: "w1",
      from: { part: ids.battery, pin: "p" },
      to: { part: ids.resistor, pin: "a" },
    },
    {
      id: "w2",
      from: { part: ids.resistor, pin: "b" },
      to: { part: ids.led, pin: "a" },
    },
    {
      id: "w3",
      from: { part: ids.led, pin: "k" },
      to: { part: ids.battery, pin: "n" },
    },
  ];
  assert.equal(missionProgress(p).complete, true);
});
