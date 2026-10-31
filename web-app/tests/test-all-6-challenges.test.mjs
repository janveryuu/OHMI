import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCircuitIntent,
  generateCircuit,
  validateCircuitAgainstRequirements,
} from "../src/lib/playground/circuit-generator.ts";
import { validateElectronicsDocument } from "../src/lib/playground/electronics-document.ts";

test("Challenge 1: Pushbutton-Controlled LED", () => {
  const prompt =
    "Build an Arduino Uno circuit with a pushbutton, red LED, and 220 ohm resistor. Connect pushbutton to D2 with INPUT_PULLUP and LED to D9. LED should turn ON when button is pressed and OFF when released.";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "pushbutton_led");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Pushbutton"));
  assert.match(circuit.arduinoCode, /pinMode\(BUTTON_PIN,\s*INPUT_PULLUP\)/);
  assert.match(circuit.arduinoCode, /digitalWrite\(LED_PIN,\s*HIGH\)/);
  assert.match(circuit.arduinoCode, /digitalWrite\(LED_PIN,\s*LOW\)/);

  const doc = validateElectronicsDocument(circuit.document);
  const parts = doc.parts;

  const btn = parts.find((p) => p.type === "pushbutton" || p.type === "switch");
  const led = parts.find((p) => p.type === "led");
  const res = parts.find((p) => p.type === "resistor");
  const uno = parts.find((p) => p.type === "arduino_uno");

  assert.ok(btn, "Pushbutton part present");
  assert.ok(led, "LED part present");
  assert.ok(res, "Resistor part present");
  assert.ok(uno, "Arduino Uno part present");

  const bbWires = doc.wires.filter((w) => w.view === "breadboard");
  const schWires = doc.wires.filter((w) => w.view === "schematic");
  assert.ok(bbWires.length >= 4, "Native breadboard wires exist for all connections");
  assert.ok(schWires.length >= 4, "Schematic wires exist");

  const validation = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(validation.valid, true);
});

test("Challenge 2: Automatic Traffic Light", () => {
  const prompt =
    "Build an Arduino Uno traffic light with red, yellow, and green LEDs, each with a 220 Ω resistor. Connect them to pins 8, 9, and 10. Make green turn on for 5 seconds, yellow for 2 seconds, and red for 5 seconds, repeating continuously. Generate the Arduino code, build the actual circuit, and run the simulation.";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "traffic_light");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Traffic Light"));
  assert.match(circuit.arduinoCode, /RED_PIN = 8/);
  assert.match(circuit.arduinoCode, /YELLOW_PIN = 9/);
  assert.match(circuit.arduinoCode, /GREEN_PIN = 10/);
  assert.match(circuit.arduinoCode, /delay\(5000\)/);
  assert.match(circuit.arduinoCode, /delay\(2000\)/);

  const doc = validateElectronicsDocument(circuit.document);
  const leds = doc.parts.filter((p) => p.type === "led");
  const resistors = doc.parts.filter((p) => p.type === "resistor");
  assert.equal(leds.length, 3, "3 LEDs placed");
  assert.equal(resistors.length, 3, "3 series 220 ohm resistors placed");

  const bbWires = doc.wires.filter((w) => w.view === "breadboard");
  const schWires = doc.wires.filter((w) => w.view === "schematic");
  assert.ok(bbWires.length >= 7, "Breadboard wires route all 3 LED branches and GND");
  assert.ok(schWires.length >= 7, "Schematic wires route all 3 LED branches and GND");

  const validation = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(validation.valid, true);
});

test("Challenge 3: Adjustable LED Brightness (Potentiometer)", () => {
  const prompt =
    "Build an Arduino Uno circuit with a 10 kΩ potentiometer, one red LED, and a 220 Ω resistor. Connect the potentiometer output to A0 and the LED to PWM pin 9. Write Arduino code that changes the LED brightness smoothly as I rotate the potentiometer. Build the real editable circuit and start the simulation.";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "potentiometer_led");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Potentiometer"));
  assert.match(circuit.arduinoCode, /analogRead\(POT_PIN\)/);
  assert.match(circuit.arduinoCode, /analogWrite\(LED_PIN/);

  const doc = validateElectronicsDocument(circuit.document);
  const pot = doc.parts.find((p) => p.type === "potentiometer");
  const led = doc.parts.find((p) => p.type === "led");
  const res = doc.parts.find((p) => p.type === "resistor");
  assert.ok(pot, "Potentiometer placed");
  assert.ok(led, "LED placed");
  assert.ok(res, "Resistor placed");

  const bbWires = doc.wires.filter((w) => w.view === "breadboard");
  assert.ok(bbWires.length >= 5, "Breadboard wires connect 5V, GND, A0 wiper, D9 PWM, and return");

  const validation = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(validation.valid, true);
});

test("Challenge 4: Automatic Night Light (LDR Photoresistor)", () => {
  const prompt =
    "Build an Arduino Uno automatic night light using an LDR photoresistor, a 10 kΩ resistor, one white LED, and a 220 Ω current-limiting resistor. Use A0 to measure ambient light and D9 to control the LED. The LED should turn ON in darkness and OFF in bright light. Generate the complete Arduino code, build the circuit, and run the simulation.";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "night_light");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Night Light"));
  assert.match(circuit.arduinoCode, /analogRead\(LDR_PIN\)/);
  assert.match(circuit.arduinoCode, /DARK_THRESHOLD/);

  const doc = validateElectronicsDocument(circuit.document);
  const ldr = doc.parts.find((p) => p.type === "photocell" || p.type === "photoresistor" || p.type === "ldr");
  const resistors = doc.parts.filter((p) => p.type === "resistor");
  const led = doc.parts.find((p) => p.type === "led");

  assert.ok(ldr, "LDR Photoresistor placed");
  assert.equal(resistors.length, 2, "2 resistors placed (10k divider and 220 ohm LED limiter)");
  assert.ok(led, "LED placed");

  const bbWires = doc.wires.filter((w) => w.view === "breadboard");
  assert.ok(bbWires.length >= 6, "Breadboard wires connect 5V, divider midpoint to A0, LDR GND, D9, and LED GND");

  const validation = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(validation.valid, true);
});

test("Challenge 5: Mini Security Alarm", () => {
  const prompt =
    "Build an Arduino Uno security alarm with a pushbutton, a red LED, a 220 Ω resistor, and a buzzer. Connect the pushbutton to D2 using INPUT_PULLUP, the LED to D9, and the buzzer to D8. When I press the button, make the red LED flash and the buzzer sound an alarm. Stop both when I release the button. Generate the Arduino code and run the simulation.";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "security_alarm");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Security Alarm"));
  assert.match(circuit.arduinoCode, /BUTTON_PIN = 2/);
  assert.match(circuit.arduinoCode, /BUZZER_PIN = 8/);
  assert.match(circuit.arduinoCode, /LED_PIN = 9/);
  assert.match(circuit.arduinoCode, /tone\(BUZZER_PIN/);
  assert.match(circuit.arduinoCode, /noTone\(BUZZER_PIN\)/);

  const doc = validateElectronicsDocument(circuit.document);
  const buzzer = doc.parts.find((p) => p.type === "buzzer");
  const btn = doc.parts.find((p) => p.type === "pushbutton" || p.type === "switch");
  const led = doc.parts.find((p) => p.type === "led");
  assert.ok(buzzer, "Buzzer placed");
  assert.ok(btn, "Pushbutton placed");
  assert.ok(led, "LED placed");

  const bbWires = doc.wires.filter((w) => w.view === "breadboard");
  assert.ok(bbWires.length >= 6, "Breadboard wires connect button D2/GND, buzzer D8/GND, and LED D9/resistor/GND");

  const validation = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(validation.valid, true);
});

test("Challenge 6: 8-LED Running Lights with 74HC595 (Zero Unrouted Nets)", () => {
  const prompt =
    "Build an Arduino Uno circuit using a 74HC595 shift register, eight LEDs, and eight appropriate current-limiting resistors. Use only three Arduino digital control pins for the shift register. Program the LEDs to light up one at a time from left to right, then reverse direction, repeating continuously. Generate the complete Arduino sketch, correctly connect power, ground, data, clock, and latch pins, and verify the simulation.";
  const intent = parseCircuitIntent(prompt);

  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "shift_register");

  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("74HC595"));
  assert.match(circuit.arduinoCode, /shiftOut/);
  assert.match(circuit.arduinoCode, /DATA_PIN/);
  assert.match(circuit.arduinoCode, /LATCH_PIN/);
  assert.match(circuit.arduinoCode, /CLOCK_PIN/);

  const doc = validateElectronicsDocument(circuit.document);
  const ic = doc.parts.find((p) => p.type === "dip" || p.type === "74hc595");
  const leds = doc.parts.filter((p) => p.type === "led");
  const resistors = doc.parts.filter((p) => p.type === "resistor");

  assert.ok(ic, "74HC595 DIP IC placed");
  assert.equal(leds.length, 8, "8 LEDs placed");
  assert.equal(resistors.length, 8, "8 current limiting resistors placed");

  // Verify all 31 connections exist in BOTH breadboard view AND schematic view
  const bbWires = doc.wires.filter((w) => w.view === "breadboard");
  const schWires = doc.wires.filter((w) => w.view === "schematic");

  assert.equal(bbWires.length, 31, "All 31 connections routed in breadboard view (Zero unrouted nets)");
  assert.equal(schWires.length, 31, "All 31 connections routed in schematic view");

  const validation = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(validation.valid, true);
});

test("Validation: Rejects incomplete circuits honestly", () => {
  const intent = parseCircuitIntent("Build an Arduino Uno with 8 LEDs using 74HC595");
  const circuit = generateCircuit(intent);

  // Invalidate by stripping breadboard wires
  const brokenCircuit = {
    ...circuit,
    document: {
      ...circuit.document,
      wires: circuit.document.wires.filter((w) => w.view !== "breadboard"),
    },
  };

  const validation = validateCircuitAgainstRequirements(brokenCircuit, intent);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((i) => i.includes("breadboard view")));
});
