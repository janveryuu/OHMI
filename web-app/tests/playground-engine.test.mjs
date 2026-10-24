import test from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../src/lib/playground/engine.ts";
import { emptyProject, newPart } from "../src/lib/playground/model.ts";
export function fixture(sw = false) {
  const p = emptyProject();
  p.parts = [
    newPart("battery", "b", 48, 48),
    newPart("resistor", "r", 288, 48),
    newPart("led", "l", 528, 48),
  ];
  const w = (id, a, ap, b, bp) => ({
    id,
    from: { part: a, pin: ap },
    to: { part: b, pin: bp },
  });
  p.wires = [
    w("w1", "b", "p", "r", "a"),
    w("w2", "r", "b", "l", "a"),
    w("w3", "l", "k", "b", "n"),
  ];
  if (sw) {
    p.parts.push(newPart("switch", "s", 288, 288));
    p.wires[2] = w("w3", "l", "k", "s", "a");
    p.wires.push(w("w4", "s", "b", "b", "n"));
  }
  return p;
}
test("5V 330 ohm LED estimate is 9.09 mA, not general simulation", () => {
  const r = evaluate(fixture());
  assert.equal(r.status, "lit");
  assert.ok(Math.abs(r.currentMa - 9.0909) < 0.001);
  assert.match(r.scope, /series/i);
});
test("reversed LED stays off and reports polarity", () => {
  const p = fixture();
  p.wires[1].to.pin = "k";
  p.wires[2].from.pin = "a";
  assert.equal(evaluate(p).status, "unsafe");
  assert.match(evaluate(p).message, /polarity/i);
});
test("missing current limiting and excessive current cannot light", () => {
  const p = fixture();
  p.parts[1].value = 0;
  assert.equal(evaluate(p).status, "unsafe");
  p.parts[1].value = 10;
  assert.equal(evaluate(p).status, "unsafe");
});
test("open and missing wires never light", () => {
  const p = fixture();
  p.wires.pop();
  assert.equal(evaluate(p).status, "incomplete");
  assert.equal(evaluate(emptyProject()).status, "incomplete");
});
test("ideal switch opens and closes supported circuit", () => {
  const p = fixture(true);
  assert.equal(evaluate(p).status, "open");
  p.parts[3].closed = true;
  assert.equal(evaluate(p).status, "lit");
});
test("invalid voltage, resistor power, below forward drop and dim current", () => {
  const p = fixture();
  p.parts[0].value = 24;
  assert.equal(evaluate(p).status, "unsafe");
  p.parts[0].value = 12;
  p.parts[1].value = 100;
  assert.equal(evaluate(p).status, "unsafe");
  p.parts[0].value = 1.5;
  p.parts[1].value = 330;
  assert.equal(evaluate(p).status, "off");
  p.parts[0].value = 5;
  p.parts[1].value = 1000000;
  assert.equal(evaluate(p).status, "off");
});
test("branches, spare components, multiple supplies and multiple LEDs are rejected honestly", () => {
  for (const kind of ["led", "battery", "resistor"]) {
    const p = fixture();
    p.parts.push(newPart(kind, "extra", 0, 288));
    assert.notEqual(evaluate(p).status, "lit");
  }
  const p = fixture();
  p.wires.push({
    id: "branch",
    from: { part: "b", pin: "p" },
    to: { part: "l", pin: "a" },
  });
  assert.notEqual(evaluate(p).status, "lit");
});
test("shorted supply is unsafe; dangling terminals and malformed payload rejected", () => {
  const p = fixture();
  p.wires.push({
    id: "short",
    from: { part: "b", pin: "p" },
    to: { part: "b", pin: "n" },
  });
  assert.equal(evaluate(p).status, "unsafe");
  assert.equal(evaluate({}).status, "unsupported");
});
test("wire geometry never changes electrical result", () => {
  const p = fixture();
  const before = evaluate(p);
  p.parts.forEach((c) => {
    c.x = 0;
    c.y = 0;
  });
  assert.deepEqual(evaluate(p), before);
});
test('LED directly across supply is unsafe without a resistor', () => {
 const p=fixture();p.parts=p.parts.filter(c=>c.kind!=='resistor');p.wires=[{id:'direct',from:{part:'b',pin:'p'},to:{part:'l',pin:'a'}},p.wires[2]];
 assert.equal(evaluate(p).status,'unsafe');assert.match(evaluate(p).message,/Missing current-limiting resistor/);
});
test('multiple series resistors use total resistance and individual power',()=>{
 const p=fixture();p.parts.push(newPart('resistor','r2',288,288));p.wires[1].to={part:'r2',pin:'a'};p.wires.push({id:'w4',from:{part:'r2',pin:'b'},to:{part:'l',pin:'a'}});
 const r=evaluate(p);assert.equal(r.status,'lit');assert.ok(Math.abs(r.currentMa-4.54545)<.001);assert.ok(r.resistorWatts<.007);
});
test('unsupported breadboard or non-finite settings never predict behavior',()=>{
 const p=fixture();p.parts.push({...newPart('led','bad',0,0),kind:'breadboard'});assert.equal(evaluate(p).status,'unsupported');p.parts.pop();p.parts[0].value=Infinity;assert.equal(evaluate(p).status,'unsupported');
});
