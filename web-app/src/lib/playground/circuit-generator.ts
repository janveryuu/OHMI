import { validateElectronicsDocument } from "./electronics-document.ts";
import { validateCircuitSpec, type CircuitSpec } from "./circuit-spec.ts";
import { modifyExistingCircuit } from "./circuit-modifier.ts";
import { getTrafficLightElectronicsDocument } from "./traffic-light-template.ts";

export type CircuitType =
  | "standard_led"
  | "potentiometer_led"
  | "night_light"
  | "security_alarm"
  | "shift_register"
  | "modification";

export interface CircuitIntent {
  isCircuitRequest: boolean;
  circuitType: CircuitType;
  controller: "arduino" | "battery";
  ledCount: number;
  colors: string[];
  hasBattery: boolean;
  batteryVoltage: string;
  hasSwitch: boolean;
  resistorOhms: number;
  behavior: "traffic_light" | "chaser" | "blink" | "dc";
  rawPrompt: string;
}

export interface GeneratedCircuit {
  id: string;
  title: string;
  tag: string;
  promptText: string;
  wiring: { label: string; detail: string }[];
  arduinoCode: string;
  document: Record<string, unknown>;
  spec: CircuitSpec;
  intent: CircuitIntent;
}

const COLOR_ROTATION = ["Red", "Yellow", "Green", "Blue", "White", "Red", "Yellow", "Green", "Blue", "White"];

export function parseCircuitIntent(userText: string, assistantText?: string): CircuitIntent {
  const rawPrompt = userText || "";
  const combined = `${userText || ""} ${assistantText || ""}`.toLowerCase();

  // 1. Check for Modification Request
  const isModification =
    /\b(?:modify|modify\s+my|existing\s+circuit|current\s+open|add\s+a\s+pushbutton\s+that\s+pauses|preserve\s+every\s+existing)\b/i.test(combined) &&
    !/\b(?:from\s+scratch|brand\s+new|start\s+over)\b/i.test(combined);

  if (isModification) {
    return {
      isCircuitRequest: true,
      circuitType: "modification",
      controller: "arduino",
      ledCount: 3,
      colors: ["Red", "Yellow", "Green"],
      hasBattery: false,
      batteryVoltage: "5V",
      hasSwitch: true,
      resistorOhms: 220,
      behavior: "chaser",
      rawPrompt,
    };
  }

  // 2. Check for Potentiometer LED Brightness
  const isPotentiometer =
    /\b(?:potentiometer|10\s*k(?:ohm|ω)?\s*potentiometer|pot|adjustable\s+led|brightness|analogread\(a0\)|rotate\s+the\s+potentiometer)\b/i.test(combined);

  if (isPotentiometer) {
    return {
      isCircuitRequest: true,
      circuitType: "potentiometer_led",
      controller: "arduino",
      ledCount: 1,
      colors: ["Red"],
      hasBattery: false,
      batteryVoltage: "5V",
      hasSwitch: false,
      resistorOhms: 220,
      behavior: "blink",
      rawPrompt,
    };
  }

  // 3. Check for Automatic Night Light (Photocell / LDR)
  const isNightLight =
    /\b(?:night\s*light|photoresistor|photocell|ldr|ambient\s+light|turn\s+on\s+in\s+darkness|darkness)\b/i.test(combined);

  if (isNightLight) {
    return {
      isCircuitRequest: true,
      circuitType: "night_light",
      controller: "arduino",
      ledCount: 1,
      colors: ["White"],
      hasBattery: false,
      batteryVoltage: "5V",
      hasSwitch: false,
      resistorOhms: 220,
      behavior: "blink",
      rawPrompt,
    };
  }

  // 4. Check for Mini Security Alarm (Buzzer + Pushbutton + LED)
  const isSecurityAlarm =
    /\b(?:security|alarm|buzzer|siren|piezo)\b/i.test(combined) ||
    (/\bbuzzer\b/i.test(combined) && /\b(?:button|pushbutton|d2|d8)\b/i.test(combined));

  if (isSecurityAlarm) {
    return {
      isCircuitRequest: true,
      circuitType: "security_alarm",
      controller: "arduino",
      ledCount: 1,
      colors: ["Red"],
      hasBattery: false,
      batteryVoltage: "5V",
      hasSwitch: true,
      resistorOhms: 220,
      behavior: "blink",
      rawPrompt,
    };
  }

  // 5. Check for 74HC595 Shift Register
  const isShiftRegister =
    /\b(?:shift\s*register|74hc595|595|running\s+lights\s+with\s+a\s+shift)\b/i.test(combined);

  if (isShiftRegister) {
    return {
      isCircuitRequest: true,
      circuitType: "shift_register",
      controller: "arduino",
      ledCount: 8,
      colors: ["Red", "Yellow", "Green", "Blue", "White", "Red", "Yellow", "Green"],
      hasBattery: false,
      batteryVoltage: "5V",
      hasSwitch: false,
      resistorOhms: 220,
      behavior: "chaser",
      rawPrompt,
    };
  }

  // 6. Standard LED / Arduino / Battery Circuit
  const hasBuildIntent = /\b(?:build|make|create|wire|wiring|circuit|code|sketch|playground|workspace|connect|setup|set\s+up|project|simulate|tinkercad|working|work|gawa|buo|ikabit|kabit)\b/i.test(combined);
  const mentionsArduino = /\barduino\b/i.test(combined);
  const mentionsBattery = /\b(?:battery|bat|dc\s*source|dc\s*supply|9v|cell|power\s*pack)\b/i.test(combined);
  const mentionsLed = /\bleds?\b/i.test(combined);
  const mentionsTraffic = /\btraffic\b/i.test(combined);
  const mentionsSwitch = /\b(?:switch|button|push\s*button)\b/i.test(combined);

  const isCircuitRequest = (mentionsArduino || mentionsBattery || mentionsLed || mentionsTraffic) && (hasBuildIntent || mentionsLed || mentionsTraffic);

  // Extract explicit LED count
  let count = 0;
  const numMatch = combined.match(/\b([1-9]|10)\s*(?:x\s*)?leds?\b/i) || combined.match(/\bleds?\s*:\s*([1-9]|10)\b/i);
  if (numMatch) {
    count = parseInt(numMatch[1], 10);
  } else {
    if (/\b(?:one|1|single)\s+leds?\b/i.test(combined)) count = 1;
    else if (/\b(?:two|2|pair)\s+leds?\b/i.test(combined)) count = 2;
    else if (/\b(?:three|3)\s+leds?\b/i.test(combined) || mentionsTraffic) count = 3;
    else if (/\b(?:four|4)\s+leds?\b/i.test(combined)) count = 4;
    else if (/\b(?:five|5)\s+leds?\b/i.test(combined)) count = 5;
    else if (/\b(?:six|6)\s+leds?\b/i.test(combined)) count = 6;
    else if (/\b(?:seven|7)\s+leds?\b/i.test(combined)) count = 7;
    else if (/\b(?:eight|8)\s+leds?\b/i.test(combined)) count = 8;
    else if (/\b(?:nine|9)\s+leds?\b/i.test(combined)) count = 9;
    else if (/\b(?:ten|10)\s+leds?\b/i.test(combined)) count = 10;
  }

  if (count === 0) {
    if (mentionsTraffic) count = 3;
    else if (mentionsLed) count = /\bleds\b/i.test(combined) ? 3 : 1;
    else if (mentionsArduino && mentionsBattery) count = 0;
    else count = mentionsArduino ? 3 : 1;
  }
  count = Math.max(0, Math.min(10, count));

  const extractedColors: string[] = [];
  const colorMatches = combined.matchAll(/\b(red|yellow|green|blue|white)\b/gi);
  for (const match of colorMatches) {
    const capitalized = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (!extractedColors.includes(capitalized) && extractedColors.length < Math.max(1, count)) {
      extractedColors.push(capitalized);
    }
  }

  let colors: string[] = [];
  if (mentionsTraffic && count === 3) {
    colors = ["Red", "Yellow", "Green"];
  } else {
    colors = [...extractedColors];
    while (colors.length < Math.max(1, count)) {
      colors.push(COLOR_ROTATION[colors.length % COLOR_ROTATION.length]);
    }
  }

  const isBattery = mentionsBattery && !mentionsArduino;
  const isArduino = !isBattery;
  const hasBattery = mentionsBattery;
  const hasSwitch = mentionsSwitch;

  let batteryVoltage = "9V";
  const voltMatch = combined.match(/\b(1\.5|3|5|9|12)\s*v\b/i);
  if (voltMatch) batteryVoltage = `${voltMatch[1]}V`;

  let resistorOhms = isArduino ? 220 : batteryVoltage === "9V" || batteryVoltage === "12V" ? 470 : 330;
  const ohmMatch = combined.match(/\b(\d{2,4})\s*(?:ohm|Ω)\b/i);
  if (ohmMatch) resistorOhms = parseInt(ohmMatch[1], 10);

  let behavior: CircuitIntent["behavior"] = "chaser";
  if (mentionsTraffic && count === 3) behavior = "traffic_light";
  else if (/\b(?:blink|blinking|flash)\b/i.test(combined) || count === 0) behavior = "blink";
  else if (isBattery) behavior = "dc";

  return {
    isCircuitRequest,
    circuitType: "standard_led",
    controller: isArduino ? "arduino" : "battery",
    ledCount: count,
    colors,
    hasBattery,
    batteryVoltage,
    hasSwitch,
    resistorOhms,
    behavior,
    rawPrompt,
  };
}

export function generateArduinoSketch(intent: CircuitIntent): string {
  const { ledCount, behavior } = intent;

  if (ledCount === 0) {
    return `// Arduino Uno Working Battery Power Circuit
// Powered via VIN and GND (7-12V DC input)
// Built-in status indicator LED on digital pin 13

const int STATUS_PIN = 13;

void setup() {
  pinMode(STATUS_PIN, OUTPUT);
}

void loop() {
  // Blink status LED every 500 ms to confirm power and operation
  digitalWrite(STATUS_PIN, HIGH);
  delay(500);
  digitalWrite(STATUS_PIN, LOW);
  delay(500);
}`;
  }

  const startPin = ledCount > 6 ? 2 : 8;
  const pins = Array.from({ length: ledCount }, (_, i) => startPin + i);

  if (behavior === "traffic_light" && ledCount === 3) {
    return `// Arduino Traffic Light (3 LEDs)
const int RED_PIN = 8;
const int YELLOW_PIN = 9;
const int GREEN_PIN = 10;

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
}

void loop() {
  // Red Light ON (1.5 seconds)
  digitalWrite(RED_PIN, HIGH);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
  delay(1500);

  // Yellow Light ON (0.8 seconds)
  digitalWrite(RED_PIN, LOW);
  digitalWrite(YELLOW_PIN, HIGH);
  digitalWrite(GREEN_PIN, LOW);
  delay(800);

  // Green Light ON (1.5 seconds)
  digitalWrite(RED_PIN, LOW);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(GREEN_PIN, HIGH);
  delay(1500);
}`;
  }

  if (behavior === "blink" || ledCount === 1) {
    return `// Arduino LED Blink (${ledCount} LED${ledCount > 1 ? "s" : ""})
const int LED_PINS[] = {${pins.join(", ")}};
const int NUM_LEDS = ${ledCount};

void setup() {
  for (int i = 0; i < NUM_LEDS; i++) {
    pinMode(LED_PINS[i], OUTPUT);
  }
}

void loop() {
  // Turn all LEDs ON
  for (int i = 0; i < NUM_LEDS; i++) {
    digitalWrite(LED_PINS[i], HIGH);
  }
  delay(500);

  // Turn all LEDs OFF
  for (int i = 0; i < NUM_LEDS; i++) {
    digitalWrite(LED_PINS[i], LOW);
  }
  delay(500);
}`;
  }

  // Running LED sequencer / chaser
  return `// Arduino ${ledCount}-LED Sequencer (Pins D${pins[0]} through D${pins[pins.length - 1]})
const int LED_PINS[] = {${pins.join(", ")}};
const int NUM_LEDS = ${ledCount};

void setup() {
  for (int i = 0; i < NUM_LEDS; i++) {
    pinMode(LED_PINS[i], OUTPUT);
  }
}

void loop() {
  // Forward running chaser
  for (int i = 0; i < NUM_LEDS; i++) {
    digitalWrite(LED_PINS[i], HIGH);
    delay(100);
    digitalWrite(LED_PINS[i], LOW);
  }
  // Reverse running chaser
  for (int i = NUM_LEDS - 2; i > 0; i--) {
    digitalWrite(LED_PINS[i], HIGH);
    delay(100);
    digitalWrite(LED_PINS[i], LOW);
  }
}`;
}

// ----------------------------------------------------
// 1. Potentiometer + PWM LED Generator
// ----------------------------------------------------
function generatePotentiometerCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Adjustable LED Brightness with Potentiometer";
  const tag = "Arduino Uno · 10 kΩ Pot (A0) · Red LED (PWM D9) · 220 Ω";

  const sketch = `// Arduino Uno Adjustable LED Brightness with Potentiometer
const int POT_PIN = A0;  // Potentiometer wiper on analog pin A0
const int LED_PIN = 9;   // Red LED connected to PWM pin D9

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int potValue = analogRead(POT_PIN);              // Read analog value 0 to 1023
  int brightness = map(potValue, 0, 1023, 0, 255); // Map to PWM duty cycle 0 to 255
  analogWrite(LED_PIN, brightness);                // Output PWM brightness smoothly
  delay(10);
}`;

  const wiring = [
    { label: "Potentiometer Power", detail: "Leg 1 → Arduino 5V, Leg 2 → Arduino GND" },
    { label: "Potentiometer Wiper", detail: "Center Wiper → Arduino Analog Pin A0" },
    { label: "Red LED Signal", detail: "Arduino PWM Pin D9 → 220 Ω Resistor (pin0)" },
    { label: "Red LED Connection", detail: "220 Ω Resistor (pin1) → Red LED Anode (+)" },
    { label: "Ground Return", detail: "Red LED Cathode (−) → Arduino GND" },
  ];

  const document = validateElectronicsDocument({
    format: "designElectronics",
    version: 1,
    title,
    parts: [
      {
        id: 1,
        type: "arduino_uno",
        label: "A1",
        props: { outputs: "D9=PWM", type: "Arduino Uno (Rev3)" },
        views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
        code: sketch,
      },
      {
        id: 2,
        type: "potentiometer",
        label: "POT1",
        props: { resistance: "10kΩ" },
        views: { breadboard: { at: [1400, 400] }, schematic: { at: [1400, 400] }, pcb: { at: [1400, 400] } },
      },
      {
        id: 3,
        type: "resistor",
        label: "R1",
        props: { power: "1/4W", resistance: "220Ω", tolerance: "±5%" },
        views: { breadboard: { at: [2400, 200] }, schematic: { at: [2400, 200] }, pcb: { at: [2400, 200] } },
      },
      {
        id: 4,
        type: "led",
        label: "LED1",
        props: { color: "Red", package: "5 mm [THT]" },
        views: { breadboard: { at: [3400, 200] }, schematic: { at: [3400, 200] }, pcb: { at: [3400, 200] } },
      },
    ],
    wires: [
      { id: 101, view: "schematic", points: [[0, 0], [1400, 400]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "leg1" } },
      { id: 102, view: "schematic", points: [[0, 100], [1400, 450]], from: { part: 1, pin: "A0" }, to: { part: 2, pin: "wiper" } },
      { id: 103, view: "schematic", points: [[0, 200], [1400, 500]], from: { part: 1, pin: "GND" }, to: { part: 2, pin: "leg2" } },
      { id: 104, view: "schematic", points: [[200, 0], [2400, 200]], from: { part: 1, pin: "D9" }, to: { part: 3, pin: "pin0" } },
      { id: 105, view: "schematic", points: [[2400, 200], [3400, 200]], from: { part: 3, pin: "pin1" }, to: { part: 4, pin: "anode" } },
      { id: 106, view: "schematic", points: [[3400, 200], [0, 300]], from: { part: 4, pin: "cathode" }, to: { part: 1, pin: "GND_2" } },
    ],
  });

  const spec = validateCircuitSpec({
    version: 1,
    status: "draft",
    title,
    explanation: "Adjustable LED brightness circuit with 10 kΩ potentiometer on A0 and PWM LED on D9.",
    warnings: [],
    parts: [
      { id: "uno", type: "arduino_uno", properties: [], sketch },
      { id: "pot", type: "potentiometer", properties: [{ key: "resistance", value: "10k" }], sketch: "" },
      { id: "r1", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
      { id: "led1", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    ],
    connections: [
      { from: { part: "uno", pin: "5V" }, to: { part: "pot", pin: "leg1" } },
      { from: { part: "uno", pin: "A0" }, to: { part: "pot", pin: "wiper" } },
      { from: { part: "uno", pin: "GND" }, to: { part: "pot", pin: "leg2" } },
      { from: { part: "uno", pin: "D9" }, to: { part: "r1", pin: "pin0" } },
      { from: { part: "r1", pin: "pin1" }, to: { part: "led1", pin: "anode" } },
      { from: { part: "led1", pin: "cathode" }, to: { part: "uno", pin: "GND_2" } },
    ],
  });

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: "Would you like the Arduino C++ code, or should I build this circuit directly in your Electronics workspace?",
    wiring,
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ----------------------------------------------------
// 2. Automatic Night Light (LDR Photocell) Generator
// ----------------------------------------------------
function generateNightLightCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Automatic Night Light with LDR Photoresistor";
  const tag = "Arduino Uno · LDR Photocell (A0) · 10 kΩ Divider · White LED (D9)";

  const sketch = `// Arduino Uno Automatic Night Light (LDR Photoresistor)
const int LDR_PIN = A0;          // Voltage divider ambient light reading
const int LED_PIN = 9;           // White night light LED
const int DARK_THRESHOLD = 500;  // Threshold (<500 is dark, >=500 is bright)

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);
  
  // Turn ON LED when ambient light drops below threshold (darkness)
  if (lightLevel < DARK_THRESHOLD) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(100);
}`;

  const wiring = [
    { label: "10 kΩ Divider Resistor", detail: "Pin0 → Arduino 5V, Pin1 → Arduino A0 & LDR Pin0" },
    { label: "LDR Photoresistor", detail: "Pin0 → 10 kΩ Resistor / A0, Pin1 → Arduino GND" },
    { label: "White LED Signal", detail: "Arduino Pin D9 → 220 Ω Resistor (pin0)" },
    { label: "White LED Anode", detail: "220 Ω Resistor (pin1) → White LED Anode (+)" },
    { label: "Ground Return", detail: "White LED Cathode (−) → Arduino GND" },
  ];

  const document = validateElectronicsDocument({
    format: "designElectronics",
    version: 1,
    title,
    parts: [
      {
        id: 1,
        type: "arduino_uno",
        label: "A1",
        props: { outputs: "D9=HIGH", type: "Arduino Uno (Rev3)" },
        views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
        code: sketch,
      },
      {
        id: 2,
        type: "resistor",
        label: "R_LDR",
        props: { power: "1/4W", resistance: "10kΩ", tolerance: "±5%" },
        views: { breadboard: { at: [1400, 400] }, schematic: { at: [1400, 400] }, pcb: { at: [1400, 400] } },
      },
      {
        id: 3,
        type: "photocell",
        label: "LDR1",
        props: {},
        views: { breadboard: { at: [1400, 800] }, schematic: { at: [1400, 800] }, pcb: { at: [1400, 800] } },
      },
      {
        id: 4,
        type: "resistor",
        label: "R_LED",
        props: { power: "1/4W", resistance: "220Ω", tolerance: "±5%" },
        views: { breadboard: { at: [2400, 200] }, schematic: { at: [2400, 200] }, pcb: { at: [2400, 200] } },
      },
      {
        id: 5,
        type: "led",
        label: "LED1",
        props: { color: "White", package: "5 mm [THT]" },
        views: { breadboard: { at: [3400, 200] }, schematic: { at: [3400, 200] }, pcb: { at: [3400, 200] } },
      },
    ],
    wires: [
      { id: 101, view: "schematic", points: [[0, 0], [1400, 400]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "pin0" } },
      { id: 102, view: "schematic", points: [[1400, 400], [0, 100]], from: { part: 2, pin: "pin1" }, to: { part: 1, pin: "A0" } },
      { id: 103, view: "schematic", points: [[1400, 400], [1400, 800]], from: { part: 2, pin: "pin1" }, to: { part: 3, pin: "pin0" } },
      { id: 104, view: "schematic", points: [[1400, 800], [0, 200]], from: { part: 3, pin: "pin1" }, to: { part: 1, pin: "GND" } },
      { id: 105, view: "schematic", points: [[200, 0], [2400, 200]], from: { part: 1, pin: "D9" }, to: { part: 4, pin: "pin0" } },
      { id: 106, view: "schematic", points: [[2400, 200], [3400, 200]], from: { part: 4, pin: "pin1" }, to: { part: 5, pin: "anode" } },
      { id: 107, view: "schematic", points: [[3400, 200], [0, 300]], from: { part: 5, pin: "cathode" }, to: { part: 1, pin: "GND_2" } },
    ],
  });

  const spec = validateCircuitSpec({
    version: 1,
    status: "draft",
    title,
    explanation: "Automatic night light circuit using LDR on A0 and white LED on D9.",
    warnings: [],
    parts: [
      { id: "uno", type: "arduino_uno", properties: [], sketch },
      { id: "rldr", type: "resistor", properties: [{ key: "resistance", value: "10000" }], sketch: "" },
      { id: "ldr", type: "photocell", properties: [], sketch: "" },
      { id: "rled", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
      { id: "led1", type: "led", properties: [{ key: "color", value: "White" }], sketch: "" },
    ],
    connections: [
      { from: { part: "uno", pin: "5V" }, to: { part: "rldr", pin: "pin0" } },
      { from: { part: "rldr", pin: "pin1" }, to: { part: "uno", pin: "A0" } },
      { from: { part: "rldr", pin: "pin1" }, to: { part: "ldr", pin: "pin0" } },
      { from: { part: "ldr", pin: "pin1" }, to: { part: "uno", pin: "GND" } },
      { from: { part: "uno", pin: "D9" }, to: { part: "rled", pin: "pin0" } },
      { from: { part: "rled", pin: "pin1" }, to: { part: "led1", pin: "anode" } },
      { from: { part: "led1", pin: "cathode" }, to: { part: "uno", pin: "GND_2" } },
    ],
  });

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: "Would you like the Arduino C++ code, or should I build this circuit directly in your Electronics workspace?",
    wiring,
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ----------------------------------------------------
// 3. Mini Security Alarm (Buzzer + Pushbutton) Generator
// ----------------------------------------------------
function generateSecurityAlarmCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Mini Security Alarm with Buzzer & Pushbutton";
  const tag = "Arduino Uno · Pushbutton (D2, Pull-up) · Buzzer (D8) · Red LED (D9)";

  const sketch = `// Arduino Uno Mini Security Alarm
const int BUTTON_PIN = 2; // Pushbutton on D2 (active-LOW with INPUT_PULLUP)
const int BUZZER_PIN = 8; // Alarm buzzer on D8
const int LED_PIN = 9;    // Red warning LED on D9

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // When button is pressed, D2 reads LOW
  if (digitalRead(BUTTON_PIN) == LOW) {
    // Flash red LED and sound two-tone siren
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 1000); // 1 kHz tone
    delay(150);
    digitalWrite(LED_PIN, LOW);
    tone(BUZZER_PIN, 750);  // 750 Hz tone
    delay(150);
  } else {
    // Button released: stop both LED and buzzer
    digitalWrite(LED_PIN, LOW);
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, LOW);
    delay(20);
  }
}`;

  const wiring = [
    { label: "Pushbutton Signal", detail: "Pushbutton Pin 1 → Arduino Digital Pin D2 (INPUT_PULLUP)" },
    { label: "Pushbutton Ground", detail: "Pushbutton Pin 3 → Arduino GND" },
    { label: "Alarm Buzzer Signal", detail: "Buzzer Plus (+) → Arduino Digital Pin D8" },
    { label: "Alarm Buzzer Ground", detail: "Buzzer Minus (−) → Arduino GND" },
    { label: "Red LED Signal", detail: "Arduino Pin D9 → 220 Ω Resistor (pin0)" },
    { label: "Red LED Anode", detail: "220 Ω Resistor (pin1) → Red LED Anode (+)" },
    { label: "Red LED Ground", detail: "Red LED Cathode (−) → Arduino GND" },
  ];

  const document = validateElectronicsDocument({
    format: "designElectronics",
    version: 1,
    title,
    parts: [
      {
        id: 1,
        type: "arduino_uno",
        label: "A1",
        props: { outputs: "", type: "Arduino Uno (Rev3)" },
        views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
        code: sketch,
      },
      {
        id: 2,
        type: "pushbutton",
        label: "BTN1",
        props: {},
        views: { breadboard: { at: [1400, 400] }, schematic: { at: [1400, 400] }, pcb: { at: [1400, 400] } },
      },
      {
        id: 3,
        type: "buzzer",
        label: "BZ1",
        props: {},
        views: { breadboard: { at: [2400, 400] }, schematic: { at: [2400, 400] }, pcb: { at: [2400, 400] } },
      },
      {
        id: 4,
        type: "resistor",
        label: "R1",
        props: { power: "1/4W", resistance: "220Ω", tolerance: "±5%" },
        views: { breadboard: { at: [1400, 800] }, schematic: { at: [1400, 800] }, pcb: { at: [1400, 800] } },
      },
      {
        id: 5,
        type: "led",
        label: "LED1",
        props: { color: "Red", package: "5 mm [THT]" },
        views: { breadboard: { at: [2400, 800] }, schematic: { at: [2400, 800] }, pcb: { at: [2400, 800] } },
      },
    ],
    wires: [
      { id: 101, view: "schematic", points: [[0, 0], [1400, 400]], from: { part: 1, pin: "D2" }, to: { part: 2, pin: "pin1" } },
      { id: 102, view: "schematic", points: [[1400, 400], [0, 100]], from: { part: 2, pin: "pin3" }, to: { part: 1, pin: "GND" } },
      { id: 103, view: "schematic", points: [[0, 200], [2400, 400]], from: { part: 1, pin: "D8" }, to: { part: 3, pin: "plus" } },
      { id: 104, view: "schematic", points: [[2400, 400], [0, 300]], from: { part: 3, pin: "minus" }, to: { part: 1, pin: "GND_2" } },
      { id: 105, view: "schematic", points: [[0, 400], [1400, 800]], from: { part: 1, pin: "D9" }, to: { part: 4, pin: "pin0" } },
      { id: 106, view: "schematic", points: [[1400, 800], [2400, 800]], from: { part: 4, pin: "pin1" }, to: { part: 5, pin: "anode" } },
      { id: 107, view: "schematic", points: [[2400, 800], [0, 500]], from: { part: 5, pin: "cathode" }, to: { part: 1, pin: "GND_3" } },
    ],
  });

  const spec = validateCircuitSpec({
    version: 1,
    status: "draft",
    title,
    explanation: "Security alarm circuit with pushbutton on D2, buzzer on D8, and red LED on D9.",
    warnings: [],
    parts: [
      { id: "uno", type: "arduino_uno", properties: [], sketch },
      { id: "btn", type: "pushbutton", properties: [], sketch: "" },
      { id: "bz", type: "buzzer", properties: [], sketch: "" },
      { id: "r1", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
      { id: "led1", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    ],
    connections: [
      { from: { part: "uno", pin: "D2" }, to: { part: "btn", pin: "pin1" } },
      { from: { part: "btn", pin: "pin3" }, to: { part: "uno", pin: "GND" } },
      { from: { part: "uno", pin: "D8" }, to: { part: "bz", pin: "plus" } },
      { from: { part: "bz", pin: "minus" }, to: { part: "uno", pin: "GND_2" } },
      { from: { part: "uno", pin: "D9" }, to: { part: "r1", pin: "pin0" } },
      { from: { part: "r1", pin: "pin1" }, to: { part: "led1", pin: "anode" } },
      { from: { part: "led1", pin: "cathode" }, to: { part: "uno", pin: "GND_3" } },
    ],
  });

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: "Would you like the Arduino C++ code, or should I build this circuit directly in your Electronics workspace?",
    wiring,
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ----------------------------------------------------
// 4. 74HC595 Shift Register with 8 LEDs Generator
// ----------------------------------------------------
function generateShiftRegisterCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno 8-LED Running Lights with 74HC595 Shift Register";
  const tag = "Arduino Uno · 74HC595 Shift Register · 8 LEDs · Pins D8, D11, D12";

  const sketch = `// Arduino Uno 8-LED Running Lights with 74HC595 Shift Register
const int LATCH_PIN = 8;  // ST_CP (pin 12 on 74HC595)
const int DATA_PIN = 11;  // DS (pin 14 on 74HC595)
const int CLOCK_PIN = 12; // SH_CP (pin 11 on 74HC595)

void setup() {
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
}

void updateShiftRegister(byte leds) {
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, leds);
  digitalWrite(LATCH_PIN, HIGH);
}

void loop() {
  // Light up one at a time from left to right
  for (int i = 0; i < 8; i++) {
    updateShiftRegister(1 << i);
    delay(120);
  }
  // Reverse direction (from right to left)
  for (int i = 6; i > 0; i--) {
    updateShiftRegister(1 << i);
    delay(120);
  }
}`;

  const wiring = [
    { label: "Control Pins", detail: "Data (DS) → Arduino D11, Latch (ST_CP) → Arduino D8, Clock (SH_CP) → Arduino D12" },
    { label: "IC Power", detail: "VCC (pin 16) & Master Reset /MR (pin 10) → Arduino 5V" },
    { label: "IC Ground", detail: "GND (pin 8) & Output Enable /OE (pin 13) → Arduino GND" },
    { label: "8 LEDs Output", detail: "Outputs Q0–Q7 (pins 15, 1..7) → 8x 220 Ω Resistors → 8x Red LEDs Anodes (+)" },
    { label: "LED Grounds", detail: "All 8 LED Cathodes (−) → Arduino GND" },
  ];

  const parts: Record<string, unknown>[] = [
    {
      id: 1,
      type: "arduino_uno",
      label: "A1",
      props: { outputs: "", type: "Arduino Uno (Rev3)" },
      views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
      code: sketch,
    },
    {
      id: 2,
      type: "74hc595",
      label: "U1",
      props: {},
      views: { breadboard: { at: [1800, 400] }, schematic: { at: [1800, 400] }, pcb: { at: [1800, 400] } },
    },
  ];

  const wires: Record<string, unknown>[] = [
    { id: 101, view: "schematic", points: [[0, 0], [1800, 400]], from: { part: 1, pin: "D11" }, to: { part: 2, pin: "pin14" } },
    { id: 102, view: "schematic", points: [[0, 100], [1800, 450]], from: { part: 1, pin: "D8" }, to: { part: 2, pin: "pin12" } },
    { id: 103, view: "schematic", points: [[0, 200], [1800, 500]], from: { part: 1, pin: "D12" }, to: { part: 2, pin: "pin11" } },
    { id: 104, view: "schematic", points: [[0, 300], [1800, 550]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "pin16" } },
    { id: 105, view: "schematic", points: [[0, 400], [1800, 600]], from: { part: 1, pin: "GND" }, to: { part: 2, pin: "pin8" } },
    { id: 106, view: "schematic", points: [[0, 500], [1800, 650]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "pin10" } },
    { id: 107, view: "schematic", points: [[0, 600], [1800, 700]], from: { part: 1, pin: "GND" }, to: { part: 2, pin: "pin13" } },
  ];

  const qPins = ["pin15", "pin1", "pin2", "pin3", "pin4", "pin5", "pin6", "pin7"];
  let wireId = 200;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "sr", type: "74hc595", properties: [], sketch: "" },
  ];

  const specConnections: CircuitSpec["connections"] = [
    { from: { part: "uno", pin: "D11" }, to: { part: "sr", pin: "pin14" } },
    { from: { part: "uno", pin: "D8" }, to: { part: "sr", pin: "pin12" } },
    { from: { part: "uno", pin: "D12" }, to: { part: "sr", pin: "pin11" } },
    { from: { part: "uno", pin: "5V" }, to: { part: "sr", pin: "pin16" } },
    { from: { part: "uno", pin: "GND" }, to: { part: "sr", pin: "pin8" } },
    { from: { part: "uno", pin: "5V" }, to: { part: "sr", pin: "pin10" } },
    { from: { part: "uno", pin: "GND" }, to: { part: "sr", pin: "pin13" } },
  ];

  for (let i = 0; i < 8; i++) {
    const resId = 10 + i * 2;
    const ledId = 11 + i * 2;
    const resKey = `r${i + 1}`;
    const ledKey = `led${i + 1}`;

    parts.push(
      {
        id: resId,
        type: "resistor",
        label: `R${i + 1}`,
        props: { power: "1/4W", resistance: "220Ω", tolerance: "±5%" },
        views: { breadboard: { at: [3000, i * 400] }, schematic: { at: [3000, i * 400] }, pcb: { at: [3000, i * 400] } },
      },
      {
        id: ledId,
        type: "led",
        label: `LED${i + 1}`,
        props: { color: "Red", package: "5 mm [THT]" },
        views: { breadboard: { at: [4000, i * 400] }, schematic: { at: [4000, i * 400] }, pcb: { at: [4000, i * 400] } },
      }
    );

    wires.push(
      { id: wireId++, view: "schematic", points: [[1800, 400], [3000, i * 400]], from: { part: 2, pin: qPins[i] }, to: { part: resId, pin: "pin0" } },
      { id: wireId++, view: "schematic", points: [[3000, i * 400], [4000, i * 400]], from: { part: resId, pin: "pin1" }, to: { part: ledId, pin: "anode" } },
      { id: wireId++, view: "schematic", points: [[4000, i * 400], [0, 700]], from: { part: ledId, pin: "cathode" }, to: { part: 1, pin: "GND_2" } }
    );

    specParts.push(
      { id: resKey, type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
      { id: ledKey, type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" }
    );

    specConnections.push(
      { from: { part: "sr", pin: qPins[i] }, to: { part: resKey, pin: "pin0" } },
      { from: { part: resKey, pin: "pin1" }, to: { part: ledKey, pin: "anode" } },
      { from: { part: ledKey, pin: "cathode" }, to: { part: "uno", pin: "GND_2" } }
    );
  }

  const document = validateElectronicsDocument({
    format: "designElectronics",
    version: 1,
    title,
    parts,
    wires,
  });

  const spec = validateCircuitSpec({
    version: 1,
    status: "draft",
    title,
    explanation: "8-LED running sequencer driven by 74HC595 shift register with Arduino Uno.",
    warnings: [],
    parts: specParts,
    connections: specConnections,
  });

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: "Would you like the Arduino C++ code, or should I build this circuit directly in your Electronics workspace?",
    wiring,
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ----------------------------------------------------
// 5. Modify Existing Circuit Generator
// ----------------------------------------------------
function generateModifiedCircuit(intent: CircuitIntent): GeneratedCircuit {
  let baseDoc: Record<string, unknown> = getTrafficLightElectronicsDocument();

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("ohmi_active_circuit_doc");
      if (stored) {
        baseDoc = JSON.parse(stored);
      }
    } catch {}
  }

  const modResult = modifyExistingCircuit(baseDoc, intent.rawPrompt || "Add a pushbutton that pauses the current animation");
  const doc = (modResult.document || baseDoc) as Record<string, unknown>;
  const sketch = (modResult.code || doc.parts && (doc.parts as any[])[0]?.code || "") as string;

  const title = "Modified Circuit: Added Pause Pushbutton on Pin D2";
  const tag = "Arduino Uno · Pushbutton (D2, Pull-up) · Pause Control";

  const wiring = [
    { label: "Preserved Existing Circuit", detail: "All original components, wires, and pin assignments preserved" },
    { label: "New Pushbutton Signal", detail: "Pushbutton Pin 1 → Arduino Digital Pin D2 (INPUT_PULLUP)" },
    { label: "New Pushbutton Ground", detail: "Pushbutton Pin 3 → Arduino GND" },
    { label: "Pause Code Added", detail: "Animation pauses when button is held down; resumes when released" },
  ];

  const spec: CircuitSpec = {
    version: 1,
    status: "draft",
    title,
    explanation: "Modified Arduino circuit with added pause pushbutton control on pin D2.",
    warnings: [],
    parts: [
      { id: "uno", type: "arduino_uno", properties: [], sketch },
      { id: "btn", type: "pushbutton", properties: [], sketch: "" },
      { id: "r1", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
      { id: "led1", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    ],
    connections: [
      { from: { part: "uno", pin: "D2" }, to: { part: "btn", pin: "pin1" } },
      { from: { part: "btn", pin: "pin3" }, to: { part: "uno", pin: "GND" } },
      { from: { part: "uno", pin: "D8" }, to: { part: "r1", pin: "pin0" } },
      { from: { part: "r1", pin: "pin1" }, to: { part: "led1", pin: "anode" } },
      { from: { part: "led1", pin: "cathode" }, to: { part: "uno", pin: "GND_2" } },
    ],
  };

  const validatedSpec = validateCircuitSpec(spec);

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: "I've modified your circuit with the requested pause pushbutton. Would you like to build it in Playground?",
    wiring,
    arduinoCode: sketch,
    document: validateElectronicsDocument(doc),
    spec: validatedSpec,
    intent,
  };
}

// ----------------------------------------------------
// Main Circuit Generator Switch
// ----------------------------------------------------
export function generateCircuit(intent: CircuitIntent): GeneratedCircuit {
  if (intent.circuitType === "potentiometer_led") {
    return generatePotentiometerCircuit(intent);
  }
  if (intent.circuitType === "night_light") {
    return generateNightLightCircuit(intent);
  }
  if (intent.circuitType === "security_alarm") {
    return generateSecurityAlarmCircuit(intent);
  }
  if (intent.circuitType === "shift_register") {
    return generateShiftRegisterCircuit(intent);
  }
  if (intent.circuitType === "modification") {
    return generateModifiedCircuit(intent);
  }

  // Fall back to standard LED / Arduino / Battery generator
  return generateStandardLedCircuit(intent);
}

function generateStandardLedCircuit(intent: CircuitIntent): GeneratedCircuit {
  const isArduino = intent.controller === "arduino";
  const hasBattery = intent.hasBattery;
  const ledCount = intent.ledCount;
  const colors = intent.colors;
  const startPin = ledCount > 6 ? 2 : 8;
  const sketch = isArduino ? generateArduinoSketch(intent) : "";

  // Title and Tag
  let title = "";
  if (isArduino) {
    if (hasBattery && ledCount === 0) {
      title = `Arduino Uno with ${intent.batteryVoltage} Battery Power`;
    } else if (hasBattery) {
      title = `Arduino Uno with ${intent.batteryVoltage} Battery & ${ledCount} LEDs`;
    } else if (intent.behavior === "traffic_light" && ledCount === 3) {
      title = "Arduino Traffic Light with Three LEDs";
    } else if (intent.behavior === "blink" || ledCount === 1) {
      title = `Arduino LED Blink (${ledCount} LED${ledCount > 1 ? "s" : ""})`;
    } else {
      title = `Arduino Uno with ${ledCount} LEDs Sequencer`;
    }
  } else {
    title = `${intent.batteryVoltage} Battery Circuit with ${ledCount} LED${ledCount > 1 ? "s" : ""}${intent.hasSwitch ? " & Switch" : ""}`;
  }

  const tagParts = [
    isArduino ? "Arduino Uno" : `${intent.batteryVoltage} Battery`,
  ];
  if (hasBattery && isArduino) tagParts.push(`${intent.batteryVoltage} Battery (VIN/GND)`);
  if (ledCount > 0) {
    tagParts.push(`${ledCount} LED${ledCount > 1 ? "s" : ""}`);
    tagParts.push(`${intent.resistorOhms} Ω`);
    if (isArduino) tagParts.push(`Pins D${startPin}–D${startPin + ledCount - 1}`);
  } else {
    tagParts.push("Status Blink Pin 13");
  }
  if (intent.hasSwitch) tagParts.push("Switch");
  const tag = tagParts.join(" · ");

  // Wiring Guide
  const wiring: { label: string; detail: string }[] = [];
  if (hasBattery && isArduino) {
    wiring.push({
      label: "Battery Power",
      detail: `${intent.batteryVoltage} Battery (+) → Arduino VIN, Battery (−) → Arduino GND`,
    });
  }
  for (let i = 0; i < ledCount; i++) {
    const pinName = isArduino ? `Arduino Pin D${startPin + i}` : intent.hasSwitch ? "Switch Output" : "Battery (+)";
    wiring.push({
      label: `${colors[i]} LED #${i + 1}`,
      detail: `Anode (+) → ${intent.resistorOhms} Ω Resistor → ${pinName}`,
    });
  }
  if (ledCount > 0) {
    wiring.push({
      label: "Ground Return",
      detail: `All ${ledCount} LED Cathodes (−) → ${isArduino ? "Arduino GND" : "Battery (−)"}`,
    });
  }

  // Construct valid designElectronics document
  const parts: Record<string, unknown>[] = [];
  const wires: Record<string, unknown>[] = [];
  let nextWireId = 100;

  // Controller / Power Source
  if (isArduino) {
    parts.push({
      id: 1,
      type: "arduino_uno",
      label: "A1",
      props: { outputs: "D13=HIGH", type: "Arduino Uno (Rev3)" },
      views: {
        breadboard: { at: [0, 0] },
        schematic: { at: [0, 0] },
        pcb: { at: [0, 0] },
      },
      code: sketch,
    });
  } else {
    parts.push({
      id: 1,
      type: "battery",
      label: "BT1",
      props: { voltage: intent.batteryVoltage },
      views: {
        breadboard: { at: [0, 0] },
        schematic: { at: [0, 0] },
        pcb: { at: [0, 0] },
      },
    });
  }

  // If Arduino with Battery, add battery as part 2
  const batteryId = 2;
  if (isArduino && hasBattery) {
    parts.push({
      id: batteryId,
      type: "battery",
      label: "BT1",
      props: { voltage: intent.batteryVoltage },
      views: {
        breadboard: { at: [-1400, 400] },
        schematic: { at: [-1800, 0] },
        pcb: { at: [-1400, 400] },
      },
    });

    wires.push(
      {
        id: nextWireId++,
        view: "schematic",
        points: [[-1200, 0], [0, 0]],
        from: { part: batteryId, pin: "plus" },
        to: { part: 1, pin: "VIN" },
      },
      {
        id: nextWireId++,
        view: "breadboard",
        points: [[-800, 400], [1200, 100]],
        from: { part: batteryId, pin: "plus" },
        to: { part: 1, pin: "VIN" },
        color: "#d94343",
      },
      {
        id: nextWireId++,
        view: "schematic",
        points: [[-1200, 200], [0, 200]],
        from: { part: batteryId, pin: "minus" },
        to: { part: 1, pin: "GND_3" },
      },
      {
        id: nextWireId++,
        view: "breadboard",
        points: [[-800, 600], [1300, 100]],
        from: { part: batteryId, pin: "minus" },
        to: { part: 1, pin: "GND_3" },
        color: "#222222",
      },
    );
  }

  // Switch if DC battery circuit with switch
  const switchId = intent.hasSwitch && !isArduino ? 3 : 0;
  if (switchId) {
    parts.push({
      id: switchId,
      type: "switch",
      label: "SW1",
      props: { position: "right" },
      views: {
        breadboard: { at: [1800, 0] },
        schematic: { at: [1800, 0] },
        pcb: { at: [1800, 0] },
      },
    });

    wires.push(
      {
        id: nextWireId++,
        view: "schematic",
        points: [[800, 0], [1800, 0]],
        from: { part: 1, pin: "plus" },
        to: { part: switchId, pin: "common" },
      },
      {
        id: nextWireId++,
        view: "breadboard",
        points: [[800, 0], [1800, 0]],
        from: { part: 1, pin: "plus" },
        to: { part: switchId, pin: "common" },
        color: "#d94343",
      },
    );
  }

  // Add Resistors and LEDs
  for (let i = 0; i < ledCount; i++) {
    const resId = 10 + i * 2;
    const ledId = 11 + i * 2;
    const yOffset = i * 700;
    const pinName = `D${startPin + i}`;

    parts.push({
      id: resId,
      type: "resistor",
      label: `R${i + 1}`,
      props: {
        power: "1/4W",
        resistance: `${intent.resistorOhms}Ω`,
        tolerance: "±5%",
      },
      views: {
        breadboard: { at: [3200, yOffset] },
        schematic: { at: [3200, yOffset] },
        pcb: { at: [3200, yOffset] },
      },
    });

    parts.push({
      id: ledId,
      type: "led",
      label: `LED${i + 1}`,
      props: {
        color: colors[i],
        package: "5 mm [THT]",
      },
      views: {
        breadboard: { at: [4200, yOffset] },
        schematic: { at: [4200, yOffset] },
        pcb: { at: [4200, yOffset] },
      },
    });

    // Wire 1: Power/Pin to Resistor
    if (isArduino) {
      wires.push(
        {
          id: nextWireId++,
          view: "schematic",
          points: [[1200, 900], [3200, 900], [3200, yOffset]],
          from: { part: 1, pin: pinName },
          to: { part: resId, pin: "pin0" },
        },
        {
          id: nextWireId++,
          view: "breadboard",
          points: [[1740, 100], [3200, yOffset]],
          from: { part: 1, pin: pinName },
          to: { part: resId, pin: "pin0" },
          color: "#418ce1",
        },
      );
    } else {
      const sourcePart = switchId || 1;
      const sourcePin = switchId ? "a" : "plus";
      wires.push(
        {
          id: nextWireId++,
          view: "schematic",
          points: [[1800, 0], [3200, yOffset]],
          from: { part: sourcePart, pin: sourcePin },
          to: { part: resId, pin: "pin0" },
        },
        {
          id: nextWireId++,
          view: "breadboard",
          points: [[1800, 0], [3200, yOffset]],
          from: { part: sourcePart, pin: sourcePin },
          to: { part: resId, pin: "pin0" },
          color: "#418ce1",
        },
      );
    }

    // Wire 2: Resistor to LED Anode
    wires.push(
      {
        id: nextWireId++,
        view: "schematic",
        points: [[3600, yOffset], [4200, yOffset]],
        from: { part: resId, pin: "pin1" },
        to: { part: ledId, pin: "anode" },
      },
      {
        id: nextWireId++,
        view: "breadboard",
        points: [[3600, yOffset], [4200, yOffset]],
        from: { part: resId, pin: "pin1" },
        to: { part: ledId, pin: "anode" },
        color: "#418ce1",
      },
    );

    // Wire 3: LED Cathode to Ground
    const gndPin = isArduino ? (i % 2 === 0 ? "GND" : "GND_2") : "minus";
    const gndPart = 1;
    wires.push(
      {
        id: nextWireId++,
        view: "schematic",
        points: [[4600, yOffset], [4600, 1200], [1200, 1200]],
        from: { part: ledId, pin: "cathode" },
        to: { part: gndPart, pin: gndPin },
      },
      {
        id: nextWireId++,
        view: "breadboard",
        points: [[4600, yOffset], [1300, 100]],
        from: { part: ledId, pin: "cathode" },
        to: { part: gndPart, pin: gndPin },
        color: "#222222",
      },
    );
  }

  const document = validateElectronicsDocument({
    format: "designElectronics",
    version: 1,
    title,
    parts,
    wires,
  });

  // Construct valid CircuitSpec matching the generated circuit
  const specParts: CircuitSpec["parts"] = [];
  const specConnections: CircuitSpec["connections"] = [];

  const specId = (num: number) => "part" + num;

  if (isArduino) {
    specParts.push({
      id: specId(1),
      type: "arduino_uno",
      properties: [],
      sketch,
    });
  } else {
    specParts.push({
      id: specId(1),
      type: "battery",
      properties: [{ key: "voltage", value: intent.batteryVoltage }],
      sketch: "",
    });
  }

  if (isArduino && hasBattery) {
    specParts.push({
      id: specId(batteryId),
      type: "battery",
      properties: [{ key: "voltage", value: intent.batteryVoltage }],
      sketch: "",
    });
    specConnections.push(
      { from: { part: specId(batteryId), pin: "plus" }, to: { part: specId(1), pin: "VIN" } },
      { from: { part: specId(batteryId), pin: "minus" }, to: { part: specId(1), pin: "GND" } },
    );
  }

  if (switchId) {
    specParts.push({
      id: specId(switchId),
      type: "switch",
      properties: [{ key: "position", value: "right" }],
      sketch: "",
    });
    specConnections.push({
      from: { part: specId(1), pin: "plus" },
      to: { part: specId(switchId), pin: "common" },
    });
  }

  for (let i = 0; i < ledCount; i++) {
    const resId = specId(10 + i * 2);
    const ledId = specId(11 + i * 2);
    specParts.push(
      {
        id: resId,
        type: "resistor",
        properties: [{ key: "resistance", value: String(intent.resistorOhms) }],
        sketch: "",
      },
      {
        id: ledId,
        type: "led",
        properties: [{ key: "color", value: colors[i] }],
        sketch: "",
      },
    );
  }
  for (let i = 0; i < ledCount; i++) {
    const resId = specId(10 + i * 2);
    const ledId = specId(11 + i * 2);
    const pinName = `D${startPin + i}`;
    if (isArduino) {
      specConnections.push({ from: { part: specId(1), pin: pinName }, to: { part: resId, pin: "pin0" } });
    } else {
      specConnections.push({ from: { part: switchId ? specId(switchId) : specId(1), pin: switchId ? "a" : "plus" }, to: { part: resId, pin: "pin0" } });
    }
    specConnections.push({ from: { part: resId, pin: "pin1" }, to: { part: ledId, pin: "anode" } });
    specConnections.push({ from: { part: ledId, pin: "cathode" }, to: { part: specId(1), pin: isArduino ? "GND" : "minus" } });
  }

  const spec: CircuitSpec = {
    version: 1,
    status: "draft",
    title,
    explanation: `${title} connected and simulated in the OHMI Electronics Workspace.`,
    warnings: [],
    parts: specParts,
    connections: specConnections,
  };

  const validatedSpec = validateCircuitSpec(spec);

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: isArduino
      ? "Would you like the Arduino C++ code, or should I build this circuit directly in your Electronics workspace?"
      : "Would you like the circuit schematic, or should I build this circuit directly in your Electronics workspace?",
    wiring,
    arduinoCode: sketch,
    document,
    spec: validatedSpec,
    intent,
  };
}
