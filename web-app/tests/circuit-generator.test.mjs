import test from "node:test";
import assert from "node:assert/strict";
import { parseCircuitIntent, generateCircuit, generateArduinoSketch } from "../src/lib/playground/circuit-generator.ts";
import { validateElectronicsDocument } from "../src/lib/playground/electronics-document.ts";

test("parseCircuitIntent parses 6 LEDs Arduino prompt", () => {
  const intent = parseCircuitIntent("build an arduino with six LEDs");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.controller, "arduino");
  assert.equal(intent.ledCount, 6);
  assert.equal(intent.colors.length, 6);
});

test("parseCircuitIntent parses 4 leds Arduino prompt", () => {
  const intent = parseCircuitIntent("build an arduino with 4 leds");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.controller, "arduino");
  assert.equal(intent.ledCount, 4);
});

test("parseCircuitIntent parses battery prompt", () => {
  const intent = parseCircuitIntent("build me a 9V battery circuit with two LEDs and a switch");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.controller, "battery");
  assert.equal(intent.ledCount, 2);
  assert.equal(intent.hasSwitch, true);
  assert.equal(intent.batteryVoltage, "9V");
});

test("parseCircuitIntent parses traffic light prompt", () => {
  const intent = parseCircuitIntent("build an arduino traffic light");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.controller, "arduino");
  assert.equal(intent.ledCount, 3);
  assert.equal(intent.behavior, "traffic_light");
  assert.deepEqual(intent.colors, ["Red", "Yellow", "Green"]);
});

test("generateCircuit builds valid 6-LED Arduino document", () => {
  const intent = parseCircuitIntent("build an arduino with six LEDs");
  const result = generateCircuit(intent);

  assert.match(result.title, /6 LEDs/);
  assert.equal(result.wiring.length, 7); // 6 LEDs + ground
  assert.match(result.arduinoCode, /8, 9, 10, 11, 12, 13/);
  assert.equal(result.document.parts.length, 13); // 1 Uno + 6 Resistors + 6 LEDs

  // Document must pass strict electronics document validation
  const validated = validateElectronicsDocument(result.document);
  assert.equal(validated.format, "designElectronics");
  assert.equal(validated.version, 1);
});

test("generateCircuit builds valid 4-LED Arduino document", () => {
  const intent = parseCircuitIntent("build an arduino with 4 leds");
  const result = generateCircuit(intent);

  assert.match(result.title, /4 LEDs/);
  assert.match(result.arduinoCode, /8, 9, 10, 11/);
  assert.equal(result.document.parts.length, 9); // 1 Uno + 4 Resistors + 4 LEDs

  const validated = validateElectronicsDocument(result.document);
  assert.equal(validated.format, "designElectronics");
});

test("generateCircuit builds valid Battery circuit with switch and 2 LEDs", () => {
  const intent = parseCircuitIntent("build me a 9V battery circuit with two LEDs and a switch");
  const result = generateCircuit(intent);

  assert.match(result.title, /Battery Circuit with 2 LEDs & Switch/);
  assert.equal(result.document.parts.length, 6); // 1 Battery + 1 Switch + 2 Resistors + 2 LEDs

  const validated = validateElectronicsDocument(result.document);
  assert.equal(validated.format, "designElectronics");
});
