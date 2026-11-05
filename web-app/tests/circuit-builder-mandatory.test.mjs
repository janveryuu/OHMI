import test from "node:test";
import assert from "node:assert/strict";
import { parseCircuitIntent, generateCircuit, validateCircuitAgainstRequirements } from "../src/lib/playground/circuit-generator.ts";
import { validateCircuitSpec, validateCircuitBuildResult } from "../src/lib/playground/circuit-spec.ts";
import { validateElectronicsDocument } from "../src/lib/playground/electronics-document.ts";

test("Mandatory Test 1: Arduino Uno with 9 LEDs", () => {
  const intent = parseCircuitIntent("Arduino Uno with 9 LEDs");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.controller, "arduino");
  assert.equal(intent.ledCount, 9);

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno with 9 LEDs Sequencer");
  assert.ok(circuit.document.parts.length >= 19); // Uno + 9 LEDs + 9 Resistors
  assert.ok(circuit.document.wires.length >= 54);
  assert.ok(circuit.arduinoCode.includes("pinMode"));
  assert.ok(circuit.arduinoCode.includes("OUTPUT"));

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check failed: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Mandatory Test 2: Automatic traffic light", () => {
  const intent = parseCircuitIntent("Automatic traffic light");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "traffic_light");
  assert.equal(intent.ledCount, 3);
  assert.deepEqual(intent.colors, ["Red", "Yellow", "Green"]);

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Traffic Light with Three LEDs");
  assert.ok(circuit.arduinoCode.includes("RED_PIN"));
  assert.ok(circuit.arduinoCode.includes("YELLOW_PIN"));
  assert.ok(circuit.arduinoCode.includes("GREEN_PIN"));

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check failed: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Mandatory Test 3: Pushbutton-controlled LED", () => {
  const intent = parseCircuitIntent("Pushbutton-controlled LED");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "pushbutton_led");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.arduinoCode.includes("INPUT_PULLUP"));
  assert.ok(circuit.arduinoCode.includes("buttonChangedAt"));

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check failed: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Mandatory Test 4: Potentiometer LED brightness controller", () => {
  const intent = parseCircuitIntent("Potentiometer LED brightness controller");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "potentiometer_led");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.arduinoCode.includes("analogRead"));
  assert.ok(circuit.arduinoCode.includes("analogWrite"));

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check failed: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Mandatory Test 5: 74HC595 eight-LED running lights", () => {
  const intent = parseCircuitIntent("74HC595 eight-LED running lights");
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "shift_register");
  assert.equal(intent.ledCount, 8);

  const circuit = generateCircuit(intent);
  assert.ok(circuit.document.parts.some((p) => p.type === "74hc595"));
  assert.ok(circuit.arduinoCode.includes("shiftOut"));

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check failed: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Mandatory Test 6: FMSS two-digit 7-segment up/down counter with debouncing, 00-99 limits and safety", () => {
  for (const prompt of [
    "FMSS two-digit 7-segment up/down counter",
    "FMSS two-digit 7-segment Arduino counter assignment",
    "2-digit 7-segment counter with Arduino Uno. Debounced buttons, 00-99 limits"
  ]) {
    const intent = parseCircuitIntent(prompt);
    assert.equal(intent.isCircuitRequest, true, `Expected ${prompt} to be recognized as circuit request`);
    assert.equal(intent.circuitType, "decimal_counter");

    const circuit = generateCircuit(intent);
    assert.equal(circuit.title, "Two-digit decimal up/down counter");
    assert.ok(circuit.arduinoCode.includes("MIN_COUNT = 0"));
    assert.ok(circuit.arduinoCode.includes("MAX_COUNT = 99"));
    assert.ok(circuit.arduinoCode.includes("INPUT_PULLUP"));
    assert.ok(circuit.arduinoCode.includes("millis()-changedAt[i]>=30"), "Must include 30ms debouncing");
    assert.ok(circuit.arduinoCode.includes("count<MAX_COUNT"));
    assert.ok(circuit.arduinoCode.includes("count>MIN_COUNT"));

    // Check display parts and resistors
    const parts = circuit.document.parts;
    const displays = parts.filter((p) => p.type === "seg7_cc");
    const resistors = parts.filter((p) => p.type === "resistor");
    const buttons = parts.filter((p) => p.type === "pushbutton");
    assert.equal(displays.length, 2, "Must contain exactly 2 common-cathode 7-segment displays");
    assert.equal(resistors.length, 7, "Must contain exactly 7 segment resistors (2.2k)");
    assert.equal(buttons.length, 2, "Must contain exactly 2 pushbuttons (add, subtract)");

    // Safety and material warnings
    const warnings = circuit.spec.warnings.join(" ");
    assert.match(warnings, /Material change: use two red common-cathode SC56-11EWA-compatible displays/);
    assert.match(warnings, /seven 2\.2 kΩ segment resistors/);

    const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
    assert.equal(reqCheck.valid, true, "Req check failed: " + reqCheck.errors.join("; "));
    assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
    assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
  }
});

test("Mandatory Test 7: Genuine failure and unsupported conditions are rejected honestly", () => {
  // Reject common anode
  assert.throws(
    () => generateCircuit(parseCircuitIntent("Build two-digit common-anode 7-segment counter")),
    /common-cathode/
  );

  // Reject 3 or 4 digits
  assert.throws(
    () => generateCircuit(parseCircuitIntent("Build four-digit 7-segment counter")),
    /two common-cathode digits on Uno only/
  );

  // Reject out of range decimal limits
  assert.throws(
    () => generateCircuit(parseCircuitIntent("Build two-digit 7-segment counter from 0 to 150")),
    /within 00–99/
  );

  // Reject unsupported hardware (ESP32, servo)
  assert.throws(
    () => generateCircuit(parseCircuitIntent("Build ESP32 with 5 LEDs")),
    /not qualified/
  );

  // Reject conflicting sensors
  assert.throws(
    () => generateCircuit(parseCircuitIntent("Build potentiometer and LDR circuit with buzzer")),
    /not qualified together/
  );
});

test("Mandatory Test 8: Draft serialization and build result validation", () => {
  const intent = parseCircuitIntent("FMSS two-digit 7-segment up/down counter");
  const circuit = generateCircuit(intent);

  const rawResult = {
    kind: "circuit_build",
    version: 1,
    status: "draft",
    answer: circuit.spec.explanation,
    circuitSpec: circuit.spec,
    document: circuit.document,
    provider: "local",
    model: "ohmi-recipes-v2",
    prompt_version: "ohmi-circuit-build-v1"
  };

  const validated = validateCircuitBuildResult(rawResult);
  assert.equal(validated.status, "draft");
  assert.equal(validated.kind, "circuit_build");
  assert.ok(validated.document);
  assert.ok(validated.circuitSpec);

  // Round-trip through JSON serialization
  const serialized = JSON.stringify(validated);
  const deserialized = JSON.parse(serialized);
  const roundTripped = validateCircuitBuildResult(deserialized);
  assert.equal(roundTripped.status, "draft");
  assert.deepEqual(roundTripped.circuitSpec, circuit.spec);
});
