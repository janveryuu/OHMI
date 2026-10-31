import test from "node:test";
import assert from "node:assert/strict";

const PROMPTS = {
  potentiometer: "Build an Arduino Uno circuit with a 10 kΩ potentiometer, one red LED, and a 220 Ω resistor. Connect the potentiometer output to A0 and the LED to PWM pin 9. Write Arduino code that changes the LED brightness smoothly as I rotate the potentiometer. Build the real editable circuit and start the simulation.",
  nightLight: "Build an Arduino Uno automatic night light using an LDR photoresistor, a 10 kΩ resistor, one white LED, and a 220 Ω current-limiting resistor. Use A0 to measure ambient light and D9 to control the LED. The LED should turn ON in darkness and OFF in bright light. Generate the complete Arduino code, build the circuit, and run the simulation.",
  securityAlarm: "Build an Arduino Uno security alarm with a pushbutton, a red LED, a 220 Ω resistor, and a buzzer. Connect the pushbutton to D2 using INPUT_PULLUP, the LED to D9, and the buzzer to D8. When I press the button, make the red LED flash and the buzzer sound an alarm. Stop both when I release the button. Generate the Arduino code and run the simulation.",
  shiftRegister: "Build an Arduino Uno circuit using a 74HC595 shift register, eight LEDs, and eight appropriate current-limiting resistors. Use only three Arduino digital control pins for the shift register. Program the LEDs to light up one at a time from left to right, then reverse direction, repeating continuously. Generate the complete Arduino sketch, correctly connect power, ground, data, clock, and latch pins, and verify the simulation.",
  modifyCircuit: "Modify my CURRENT open Arduino circuit without rebuilding or deleting it. Add a pushbutton that pauses the current LED animation when pressed and resumes it when released. Preserve every existing component, wire, pin assignment, and project setting unless a change is necessary. Update the Arduino code, validate the new connections, and run the modified simulation.",
};

test("Prompt 1: Adjustable LED Brightness recognition and generation", async () => {
  const { parseCircuitIntent, generateCircuit } = await import("../src/lib/playground/circuit-generator.ts");
  const { validateElectronicsDocument } = await import("../src/lib/playground/electronics-document.ts");
  const { validateCircuitSpec } = await import("../src/lib/playground/circuit-spec.ts");

  const intent = parseCircuitIntent(PROMPTS.potentiometer);
  assert.equal(intent.circuitType, "potentiometer_led");
  
  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Potentiometer"));
  assert.ok(circuit.arduinoCode.includes("analogRead(A0)") || circuit.arduinoCode.includes("POT_PIN"));
  assert.ok(circuit.arduinoCode.includes("analogWrite(9") || circuit.arduinoCode.includes("LED_PIN"));

  const validatedDoc = validateElectronicsDocument(circuit.document);
  assert.ok(validatedDoc);
  const validatedSpec = validateCircuitSpec(circuit.spec);
  assert.equal(validatedSpec.status, "draft");
});

test("Prompt 2: Automatic Night Light recognition and generation", async () => {
  const { parseCircuitIntent, generateCircuit } = await import("../src/lib/playground/circuit-generator.ts");
  const { validateElectronicsDocument } = await import("../src/lib/playground/electronics-document.ts");
  const { validateCircuitSpec } = await import("../src/lib/playground/circuit-spec.ts");

  const intent = parseCircuitIntent(PROMPTS.nightLight);
  assert.equal(intent.circuitType, "night_light");
  
  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Night Light") || circuit.title.includes("Photocell"));
  assert.ok(circuit.arduinoCode.includes("analogRead(A0)") || circuit.arduinoCode.includes("LDR"));

  const validatedDoc = validateElectronicsDocument(circuit.document);
  assert.ok(validatedDoc);
  const validatedSpec = validateCircuitSpec(circuit.spec);
  assert.equal(validatedSpec.status, "draft");
});

test("Prompt 3: Mini Security Alarm recognition and generation", async () => {
  const { parseCircuitIntent, generateCircuit } = await import("../src/lib/playground/circuit-generator.ts");
  const { validateElectronicsDocument } = await import("../src/lib/playground/electronics-document.ts");
  const { validateCircuitSpec } = await import("../src/lib/playground/circuit-spec.ts");

  const intent = parseCircuitIntent(PROMPTS.securityAlarm);
  assert.equal(intent.circuitType, "security_alarm");
  
  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Security") || circuit.title.includes("Alarm"));
  assert.ok(circuit.arduinoCode.includes("INPUT_PULLUP"));
  assert.ok(circuit.arduinoCode.includes("tone(") || circuit.arduinoCode.includes("BUZZER"));

  const validatedDoc = validateElectronicsDocument(circuit.document);
  assert.ok(validatedDoc);
  const validatedSpec = validateCircuitSpec(circuit.spec);
  assert.equal(validatedSpec.status, "draft");
});

test("Prompt 4: Eight-LED Running Lights with Shift Register", async () => {
  const { parseCircuitIntent, generateCircuit } = await import("../src/lib/playground/circuit-generator.ts");
  const { validateElectronicsDocument } = await import("../src/lib/playground/electronics-document.ts");
  const { validateCircuitSpec } = await import("../src/lib/playground/circuit-spec.ts");

  const intent = parseCircuitIntent(PROMPTS.shiftRegister);
  assert.equal(intent.circuitType, "shift_register");
  
  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("74HC595") || circuit.title.includes("Shift Register"));
  assert.ok(circuit.arduinoCode.includes("shiftOut"));

  const validatedDoc = validateElectronicsDocument(circuit.document);
  assert.ok(validatedDoc);
  const validatedSpec = validateCircuitSpec(circuit.spec);
  assert.equal(validatedSpec.status, "draft");
});

test("Prompt 5: Modify Existing Circuit", async () => {
  const { parseCircuitIntent, generateCircuit } = await import("../src/lib/playground/circuit-generator.ts");
  const { validateElectronicsDocument } = await import("../src/lib/playground/electronics-document.ts");
  const { validateCircuitSpec } = await import("../src/lib/playground/circuit-spec.ts");

  const intent = parseCircuitIntent(PROMPTS.modifyCircuit);
  assert.equal(intent.circuitType, "modification");
  
  const circuit = generateCircuit(intent);
  assert.ok(circuit.title.includes("Modified") || circuit.title.includes("Pushbutton"));
  assert.ok(circuit.arduinoCode.includes("INPUT_PULLUP"));

  const validatedDoc = validateElectronicsDocument(circuit.document);
  assert.ok(validatedDoc);
  const validatedSpec = validateCircuitSpec(circuit.spec);
  assert.equal(validatedSpec.status, "draft");
});
