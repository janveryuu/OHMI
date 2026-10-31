import test from "node:test";
import assert from "node:assert/strict";
import { parseCircuitIntent, generateCircuit } from "../src/lib/playground/circuit-generator.ts";
import { isModificationRequest, modifyExistingCircuit } from "../src/lib/playground/circuit-modifier.ts";
import { validateElectronicsDocument } from "../src/lib/playground/electronics-document.ts";

test("Scenario 1: Arduino Uno + LED + 220 Ω resistor blinking every second", () => {
  const prompt = "Arduino Uno + LED + 220 Ω resistor blinking every second";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.controller, "arduino");
  assert.equal(intent.ledCount, 1);
  assert.equal(intent.resistorOhms, 220);
  assert.equal(intent.behavior, "blink");

  const circuit = generateCircuit(intent);

  assert.equal(circuit.title, "Arduino LED Blink (1 LED)");
  assert.match(circuit.tag, /Arduino Uno · 1 LED · 220 Ω/);
  assert.match(circuit.arduinoCode, /pinMode\(LED_PINS\[i\], OUTPUT\)/);
  assert.match(circuit.arduinoCode, /delay\(500\)/);

  // Validate real components on canvas
  const doc = validateElectronicsDocument(circuit.document);
  assert.equal(doc.format, "designElectronics");
  assert.equal(doc.version, 1);

  const parts = doc.parts;
  const uno = parts.find((p) => p.type === "arduino_uno");
  const resistor = parts.find((p) => p.type === "resistor");
  const led = parts.find((p) => p.type === "led");

  assert.ok(uno, "Arduino Uno part placed on canvas");
  assert.ok(resistor, "Resistor part placed on canvas");
  assert.ok(led, "LED part placed on canvas");
  assert.equal(uno.code, circuit.arduinoCode, "Arduino sketch embedded directly on Uno part");

  // Validate wiring: Uno D8 -> Resistor pin0 -> Resistor pin1 -> LED anode -> LED cathode -> GND
  const wires = doc.wires;
  assert.ok(wires.length > 0, "Wires created");

  const sigWire = wires.find(
    (w) =>
      ((w.from.part === uno.id && w.from.pin === "D8") ||
      (w.to.part === uno.id && w.to.pin === "D8")) &&
      w.view === "breadboard",
  );
  assert.ok(sigWire, "Signal wire connected to Uno Pin D8 on breadboard");

  const gndWire = wires.find(
    (w) =>
      (w.from.part === led.id && w.from.pin === "cathode") &&
      (w.to.part === uno.id && w.to.pin === "GND") &&
      w.view === "breadboard",
  );
  assert.ok(gndWire, "Cathode ground return wire connected to Uno GND on breadboard");
});

test("Scenario 2: Arduino traffic light with three LEDs", () => {
  const prompt = "Build an Arduino traffic light with three LEDs";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.controller, "arduino");
  assert.equal(intent.ledCount, 3);
  assert.equal(intent.behavior, "traffic_light");
  assert.deepEqual(intent.colors, ["Red", "Yellow", "Green"]);

  const circuit = generateCircuit(intent);

  assert.equal(circuit.title, "Arduino Traffic Light with Three LEDs");
  assert.match(circuit.tag, /Arduino Uno · 3 LEDs · 220 Ω · Pins D8–D10/);
  assert.match(circuit.arduinoCode, /RED_PIN = 8/);
  assert.match(circuit.arduinoCode, /YELLOW_PIN = 9/);
  assert.match(circuit.arduinoCode, /GREEN_PIN = 10/);

  const doc = validateElectronicsDocument(circuit.document);
  const parts = doc.parts;

  const leds = parts.filter((p) => p.type === "led");
  const resistors = parts.filter((p) => p.type === "resistor");
  const uno = parts.find((p) => p.type === "arduino_uno");

  assert.equal(leds.length, 3, "3 LEDs placed");
  assert.equal(resistors.length, 3, "3 dedicated series current-limiting resistors");
  assert.ok(uno, "Uno placed");
  assert.ok(doc.wires.length > 0, "Wires created across views");

  const breadboardWires = doc.wires.filter((w) => w.view === "breadboard");
  assert.ok(breadboardWires.length >= 6, "Breadboard wires connect all 3 branches");
});

test("Scenario 3: Modify an existing circuit by adding a pushbutton", () => {
  // Start with the traffic light from scenario 2
  const initialCircuit = generateCircuit(parseCircuitIntent("Arduino traffic light with three LEDs"));
  const initialDoc = initialCircuit.document;
  const initialPartCount = initialDoc.parts.length;

  assert.equal(isModificationRequest("Add a pushbutton"), true);
  assert.equal(isModificationRequest("Build a traffic light"), false);

  const modResult = modifyExistingCircuit(initialDoc, "Add a pushbutton");

  assert.equal(modResult.isModification, true);
  assert.equal(modResult.success, true);
  assert.match(modResult.summary, /Added pushbutton connected to Arduino Pin D2/);

  const modifiedDoc = validateElectronicsDocument(modResult.document);
  const parts = modifiedDoc.parts;
  const wires = modifiedDoc.wires;

  assert.equal(parts.length, initialPartCount + 1, "Added exactly 1 new switch part");
  const sw = parts.find((p) => p.type === "switch");
  assert.ok(sw, "Switch part exists on canvas");
  assert.equal(sw.label, "SW1");

  // Verify switch wiring: Pin D2 to switch 'a', GND to switch 'common'
  const buttonWire = wires.find(
    (w) =>
      (w.from.part === sw.id && w.from.pin === "a") ||
      (w.to.part === sw.id && w.to.pin === "a"),
  );
  assert.ok(buttonWire, "Pushbutton wired to Arduino Pin D2");

  const gndWire = wires.find(
    (w) =>
      (w.from.part === sw.id && w.from.pin === "common") ||
      (w.to.part === sw.id && w.to.pin === "common"),
  );
  assert.ok(gndWire, "Pushbutton wired to Arduino GND");

  // Verify code modification
  assert.match(modResult.code, /BUTTON_PIN = 2/);
  assert.match(modResult.code, /INPUT_PULLUP/);

  const uno = parts.find((p) => p.type === "arduino_uno");
  assert.equal(uno.code, modResult.code, "Updated sketch saved directly in Arduino part");
});

test("Modification guards: reject invalid canvas or empty project", () => {
  const emptyResult = modifyExistingCircuit({ format: "designElectronics", version: 1, title: "Empty", parts: [], wires: [] }, "Add a pushbutton");
  assert.equal(emptyResult.isModification, false);
  assert.equal(emptyResult.success, false);
});
