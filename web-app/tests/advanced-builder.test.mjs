import test from "node:test";
import assert from "node:assert/strict";
import { generateCircuit, parseCircuitIntent } from "../src/lib/playground/circuit-generator.ts";
import { validateCircuitSpec, validateCircuitBuildResult } from "../src/lib/playground/circuit-spec.ts";
import { prepareCircuit } from "../src/lib/playground/build-verification.ts";

test("unsupported requirements and quantities cannot silently select another recipe", () => {
  for (const prompt of ["Build Uno with 25 LEDs", "Build an Arduino servo circuit", "Build two potentiometers with one LED", "Build an LDR and potentiometer LED", "Build ESP32 with one LED"])
    assert.throws(()=>generateCircuit(parseCircuitIntent(prompt)),/not qualified|not supported|cannot preserve/);
  const counter=generateCircuit(parseCircuitIntent("Build FMSS two 7-segment displays and two buttons, four 1k resistors, counter from 00 to 99"));
  assert.equal(counter.spec.parts.filter(p=>p.type === "seg7_cc").length,2);
  assert.match(counter.spec.warnings.join(" "),/four 1 kΩ resistors are insufficient/);
  assert.throws(()=>generateCircuit(parseCircuitIntent("Build two-digit common-anode 7-segment counter")),/common-cathode/);
  assert.throws(()=>generateCircuit(parseCircuitIntent("Build 7-segment thermometer display")),/not substituted/);
  assert.throws(()=>generateCircuit(parseCircuitIntent("Build two-digit 7-segment counter with LDR")),/common-cathode/);
  assert.throws(()=>generateCircuit(parseCircuitIntent("hello")),/Describe a supported circuit/);
  assert.throws(()=>generateCircuit(parseCircuitIntent("Build Arduino with eight LEDs and four resistors")),/resistor quantity/);
  assert.throws(()=>generateCircuit(parseCircuitIntent("Build potentiometer LED using A1")),/pin mapping/);
  const two = generateCircuit(parseCircuitIntent("Build Arduino with 2 red LEDs and 330 ohm resistors"));
  assert.equal(two.document.parts.filter(part=>part.type === "led").length,2);
  assert.ok(two.spec.parts.filter(part=>part.type === "resistor").every(part=>part.properties[0].value === "330"));
});

test("tactile button uses opposite native contacts; inverted LDR behavior is corrected", () => {
  for(const prompt of ["Build pushbutton LED", "Build pushbutton-controlled alarm"]) {
    const circuit=generateCircuit(parseCircuitIntent(prompt));
    const button=circuit.document.parts.find(p=>p.type==="pushbutton");
    assert.ok(circuit.document.wires.some(w=>w.from?.part===button.id && w.from.pin==="pin2"));
    assert.ok(!circuit.document.wires.some(w=>w.from?.part===button.id && w.from.pin==="pin3"));
    assert.match(circuit.arduinoCode, /millis\(\) - buttonChangedAt >= 30/);
  }
  const night=generateCircuit(parseCircuitIntent("Build LDR automatic night light"));
  assert.match(night.arduinoCode,/lightLevel > DARK_THRESHOLD/);
});

test("shift register requires real supplies, output resistance and bounded aggregate current", () => {
  const circuit=generateCircuit(parseCircuitIntent("Build 74HC595 eight LED running lights"));
  assert.equal(circuit.spec.parts.filter(p=>p.type==="resistor").length,8);
  for(const p of circuit.spec.parts.filter(p=>p.type==="resistor"))assert.equal(p.properties[0].value,"1000");
  const missing=structuredClone(circuit.spec);
  missing.connections=missing.connections.filter(w=>!(w.to.part==="sr" && w.to.pin==="pin16"));
  assert.throws(()=>validateCircuitSpec(missing),/missing or incorrect/);
  const overcurrent=structuredClone(circuit.spec);
  overcurrent.parts.filter(p=>p.type==="resistor").forEach(p=>p.properties[0].value="220");
  assert.throws(()=>validateCircuitSpec(overcurrent),/6 mA/);
});

test("native verification rejects warnings without opening or replacing work", async () => {
  const circuit=generateCircuit(parseCircuitIntent("Build Arduino with eight LEDs"));
  let calls=0;
  await assert.rejects(prepareCircuit({request:async request=>{ calls++; assert.equal(request.operation,"prepare");return {document:circuit.document,observations:{samples:Array.from({length:80},()=>({errors:[],warnings:["Unsupported API"],damaged:[]}))}};}},circuit.document),/Native circuit checks failed/);
  assert.equal(calls,1);
  const result=validateCircuitBuildResult({kind:"circuit_build",version:1,status:"draft",answer:circuit.spec.explanation,circuitSpec:circuit.spec,document:circuit.document,provider:"local",model:"ohmi-recipes-v2",prompt_version:"ohmi-circuit-build-v1"});
  assert.equal(result.provider,"local");
});

test("counter safety rejects bypasses, shared segment lines and unqualified decimal points", () => {
  const circuit=generateCircuit(parseCircuitIntent("Build two-digit decimal counter 00 to 59 with 7-segment displays"));
  assert.match(circuit.arduinoCode,/MAX_COUNT = 59/);
  for(const alter of [
    spec=>spec.parts.find(p=>p.type === "resistor").properties[0].value="220",
    spec=>spec.connections.push({from:{part:"digit0",pin:"pin7"},to:{part:"digit0",pin:"pin6"}}),
    spec=>spec.connections.push({from:{part:"digit0",pin:"pin5"},to:{part:"uno",pin:"5V"}}),
  ]){const spec=structuredClone(circuit.spec);alter(spec);assert.throws(()=>validateCircuitSpec(spec));}
});
