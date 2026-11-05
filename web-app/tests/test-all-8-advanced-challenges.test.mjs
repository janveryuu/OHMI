import test from "node:test";
import assert from "node:assert/strict";
import { parseCircuitIntent, generateCircuit, validateCircuitAgainstRequirements } from "../src/lib/playground/circuit-generator.ts";
import { validateCircuitSpec } from "../src/lib/playground/circuit-spec.ts";
import { validateElectronicsDocument } from "../src/lib/playground/electronics-document.ts";
import { buildTinkercadLearningKit } from "../src/lib/playground/tinkercad-export.ts";

test("Challenge 1: Smart Emergency Security Alarm", () => {
  const prompt = "Build a complete Arduino Uno smart emergency security alarm system using a breadboard, PIR motion sensor, pushbuttons, red and green LEDs, current-limiting resistors, buzzer, and 16x2 LCD. One button arms the system; another disarms it.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "smart_security_alarm");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno Smart Emergency Security Alarm System");
  assert.ok(circuit.arduinoCode.includes("PIR_PIN = 2"));
  assert.ok(circuit.arduinoCode.includes("ARM_BTN_PIN = 3"));
  assert.ok(circuit.arduinoCode.includes("DISARM_BTN_PIN = 4"));
  assert.ok(circuit.arduinoCode.includes("LiquidCrystal_I2C"));
  assert.ok(circuit.arduinoCode.includes("INPUT_PULLUP"));
  assert.ok(circuit.arduinoCode.includes("tone(BUZZER_PIN"));

  const parts = circuit.document.parts;
  assert.ok(parts.some(p => p.type === "hcsr501"), "Missing PIR sensor");
  assert.ok(parts.some(p => p.type === "buzzer"), "Missing buzzer");
  assert.ok(parts.some(p => p.type === "lcd1602_i2c"), "Missing LCD");
  assert.equal(parts.filter(p => p.type === "pushbutton").length, 2, "Expected 2 pushbuttons");
  assert.equal(parts.filter(p => p.type === "led").length, 2, "Expected 2 LEDs (Green & Red)");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Challenge 2: Intelligent Four-Way Traffic Controller", () => {
  const prompt = "Build an advanced Arduino Uno four-way intersection traffic light controller using a breadboard. Include red, yellow, and green LEDs for north, south, east, and west traffic, appropriate resistors, two pedestrian request buttons, and an emergency override button.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "four_way_traffic");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno Intelligent Four-Way Traffic Controller");
  assert.ok(circuit.arduinoCode.includes("EMERGENCY_BTN = A2"));
  assert.ok(circuit.arduinoCode.includes("case EMERGENCY:"));
  assert.ok(circuit.arduinoCode.includes("PED_CROSSING"));

  const parts = circuit.document.parts;
  const leds = parts.filter(p => p.type === "led");
  const resistors = parts.filter(p => p.type === "resistor");
  const buttons = parts.filter(p => p.type === "pushbutton");

  assert.equal(leds.length, 12, "Must contain exactly 12 LEDs for 4 directions");
  assert.equal(resistors.length, 12, "Must contain 12 current-limiting resistors");
  assert.equal(buttons.length, 3, "Must contain 2 pedestrian buttons and 1 emergency override button");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Challenge 3: FMSS Two-Digit 7-Segment Counter", () => {
  const prompt = "Build a complete Arduino Uno R3 two-digit decimal up/down counter on a breadboard. Use two 7-segment displays, two tactile pushbuttons, appropriate current-limiting resistors, and correctly routed jumper wires. Count 00 to 99.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "decimal_counter");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Two-digit decimal up/down counter");
  assert.ok(circuit.arduinoCode.includes("MIN_COUNT = 0"));
  assert.ok(circuit.arduinoCode.includes("MAX_COUNT = 99"));
  assert.ok(circuit.arduinoCode.includes("millis()-changedAt[i]>=30"), "Debouncing required");

  const parts = circuit.document.parts;
  assert.equal(parts.filter(p => p.type === "seg7_cc").length, 2, "Expected 2 common-cathode displays");
  assert.equal(parts.filter(p => p.type === "resistor").length, 7, "Expected 7 segment resistors");
  assert.equal(parts.filter(p => p.type === "pushbutton").length, 2, "Expected 2 buttons");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Challenge 4: Smart Parking Garage", () => {
  const prompt = "Build a complete Arduino Uno automatic parking entrance system with a breadboard, ultrasonic distance sensor, servo motor, red and green LEDs, resistors, buzzer, and 16x2 LCD.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "parking_garage");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno Automatic Parking Entrance System");
  assert.ok(circuit.arduinoCode.includes("#include <Servo.h>"));
  assert.ok(circuit.arduinoCode.includes("LiquidCrystal_I2C"));
  assert.ok(circuit.arduinoCode.includes("TRIG_PIN = 11"));
  assert.ok(circuit.arduinoCode.includes("ECHO_PIN = 12"));
  assert.ok(circuit.arduinoCode.includes("SERVO_PIN = 9"));

  const parts = circuit.document.parts;
  assert.ok(parts.some(p => p.type === "hcsr04"), "Missing HC-SR04 ultrasonic sensor");
  assert.ok(parts.some(p => p.type === "header_male"), "Missing servo motor interface header");
  assert.ok(parts.some(p => p.type === "buzzer"), "Missing buzzer");
  assert.ok(parts.some(p => p.type === "lcd1602_i2c"), "Missing 16x2 LCD");
  assert.equal(parts.filter(p => p.type === "led").length, 2, "Expected 2 LEDs (Green & Red)");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Challenge 5: Password-Protected Door Lock", () => {
  const prompt = "Build an Arduino Uno electronic security door lock using a breadboard, 4x4 matrix keypad, servo motor, 16x2 LCD, red and green LEDs, buzzer, and appropriate supporting components.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "door_lock");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno Electronic Security Door Lock");
  assert.ok(circuit.arduinoCode.includes("#include <Servo.h>"));
  assert.ok(circuit.arduinoCode.includes("getKey()"));
  assert.ok(circuit.arduinoCode.includes("lockoutTimer"));
  assert.ok(circuit.arduinoCode.includes("ACCESS DENIED"));

  const parts = circuit.document.parts;
  assert.ok(parts.some(p => p.type === "header_female"), "Missing 4x4 keypad interface header");
  assert.ok(parts.some(p => p.type === "header_male"), "Missing servo motor interface header");
  assert.ok(parts.some(p => p.type === "lcd1602_i2c"), "Missing 16x2 LCD");
  assert.ok(parts.some(p => p.type === "buzzer"), "Missing buzzer");
  assert.equal(parts.filter(p => p.type === "led").length, 2, "Expected 2 LEDs");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Challenge 6: Automatic Temperature-Controlled Cooling", () => {
  const prompt = "Build a complete Arduino Uno automatic cooling and temperature monitoring system on a breadboard. Use a TMP36 temperature sensor, DC fan or motor, suitable transistor or MOSFET driver, protective flyback diode where required, red and green LEDs, resistors, buzzer, and an LCD display.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "temperature_cooling");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno Automatic Temperature-Controlled Cooling System");
  assert.ok(circuit.arduinoCode.includes("TEMP_SENSOR_PIN = A0"));
  assert.ok(circuit.arduinoCode.includes("FAN_PWM_PIN = 3"));
  assert.ok(circuit.arduinoCode.includes("LiquidCrystal_I2C"));

  const parts = circuit.document.parts;
  assert.ok(parts.some(p => p.type === "tmp36"), "Missing TMP36 sensor");
  assert.ok(parts.some(p => p.type === "dc_motor"), "Missing DC motor / fan");
  assert.ok(parts.some(p => p.type === "transistor"), "Missing transistor driver");
  assert.ok(parts.some(p => p.type === "diode"), "Missing flyback diode");
  assert.ok(parts.some(p => p.type === "lcd1602_i2c"), "Missing 16x2 LCD");
  assert.ok(parts.some(p => p.type === "buzzer"), "Missing buzzer");
  assert.equal(parts.filter(p => p.type === "led").length, 2, "Expected 2 LEDs");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Challenge 7: Advanced 74HC595 LED Controller", () => {
  const prompt = "Build an Arduino Uno programmable eight-LED animation controller on a breadboard using a 74HC595 shift register, eight LEDs, appropriate current-limiting resistors, a 10 kΩ potentiometer, and two pushbuttons.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "advanced_shift_register");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno Programmable 8-LED Animation Controller (74HC595)");
  assert.ok(circuit.arduinoCode.includes("shiftOut"));
  assert.ok(circuit.arduinoCode.includes("MODE_BTN = 2"));
  assert.ok(circuit.arduinoCode.includes("PAUSE_BTN = 3"));
  assert.ok(circuit.arduinoCode.includes("SPEED_POT = A0"));
  assert.ok(circuit.arduinoCode.includes("0 = Running, 1 = Bouncing, 2 = Alternating"));

  const parts = circuit.document.parts;
  assert.ok(parts.some(p => p.type === "74hc595"), "Missing 74HC595 shift register");
  assert.equal(parts.filter(p => p.type === "led").length, 8, "Expected 8 LEDs");
  assert.equal(parts.filter(p => p.type === "resistor").length, 8, "Expected 8 current-limiting resistors");
  assert.ok(parts.some(p => p.type === "potentiometer"), "Missing 10k potentiometer");
  assert.equal(parts.filter(p => p.type === "pushbutton").length, 2, "Expected 2 pushbuttons");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Challenge 8: Automatic Water Tank & Pump Controller", () => {
  const prompt = "Build a complete Arduino Uno automatic water tank monitoring and pump-control system using a breadboard, ultrasonic sensor, LCD, buzzer, red/yellow/green LEDs, appropriate resistors, and a pump represented by a safely driven DC motor or relay-controlled load.";
  const intent = parseCircuitIntent(prompt);
  assert.equal(intent.isCircuitRequest, true);
  assert.equal(intent.circuitType, "water_tank_pump");

  const circuit = generateCircuit(intent);
  assert.equal(circuit.title, "Arduino Uno Automatic Water Tank & Pump Controller");
  assert.ok(circuit.arduinoCode.includes("TRIG_PIN = 11"));
  assert.ok(circuit.arduinoCode.includes("ECHO_PIN = 12"));
  assert.ok(circuit.arduinoCode.includes("PUMP_PIN = 3"));
  assert.ok(circuit.arduinoCode.includes("LiquidCrystal_I2C"));

  const parts = circuit.document.parts;
  assert.ok(parts.some(p => p.type === "hcsr04"), "Missing HC-SR04 ultrasonic sensor");
  assert.ok(parts.some(p => p.type === "dc_motor"), "Missing DC pump motor");
  assert.ok(parts.some(p => p.type === "transistor"), "Missing transistor driver");
  assert.ok(parts.some(p => p.type === "diode"), "Missing protective diode");
  assert.ok(parts.some(p => p.type === "buzzer"), "Missing buzzer");
  assert.ok(parts.some(p => p.type === "lcd1602_i2c"), "Missing 16x2 LCD");
  assert.equal(parts.filter(p => p.type === "led").length, 3, "Expected 3 LEDs (Red, Yellow, Green)");

  const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
  assert.equal(reqCheck.valid, true, "Req check errors: " + reqCheck.errors.join("; "));
  assert.doesNotThrow(() => validateElectronicsDocument(circuit.document));
  assert.doesNotThrow(() => validateCircuitSpec(circuit.spec));
});

test("Tinkercad Learning Kit Export for Advanced Circuits", async () => {
  const intent = parseCircuitIntent("Automatic Temperature-Controlled Cooling");
  const circuit = generateCircuit(intent);
  const kit = await buildTinkercadLearningKit(circuit.document);
  assert.ok(kit.summary);
  assert.ok(kit.summary.parts.length >= 8);
  assert.ok(kit.zipBytes instanceof Uint8Array);
  assert.ok(kit.zipBytes.length > 500);
});
