import type { CircuitIntent, GeneratedCircuit } from "./circuit-generator.ts";
import { validateCircuitSpec, type CircuitSpec } from "./circuit-spec.ts";
import { validateElectronicsDocument } from "./electronics-document.ts";

// ============================================================================
// Helper to build dual-view wires (breadboard + schematic)
// ============================================================================
interface ConnectionDef {
  fromPart: string;
  fromPin: string;
  toPart: string;
  toPin: string;
  color?: string;
}

function buildDualDocumentAndSpec(
  title: string,
  explanation: string,
  warnings: string[],
  specParts: CircuitSpec["parts"],
  connections: ConnectionDef[],
  sketch: string,
) {
  const spec = validateCircuitSpec({
    version: 1,
    status: "draft",
    title,
    explanation,
    warnings,
    parts: specParts,
    connections: connections.map((c) => ({
      from: { part: c.fromPart, pin: c.fromPin },
      to: { part: c.toPart, pin: c.toPin },
    })),
  });

  const partIdMap = new Map<string, number>();
  specParts.forEach((part, index) => {
    partIdMap.set(part.id, index + 1);
  });

  const docParts = specParts.map((part, index) => {
    const numericId = index + 1;
    const propsObj: Record<string, string> = {};
    for (const prop of part.properties) {
      propsObj[prop.key] = prop.value;
    }

    return {
      id: numericId,
      type: part.type,
      label: part.id.toUpperCase(),
      props: propsObj,
      code: part.type === "arduino_uno" ? sketch : "",
      views: {
        breadboard: { at: [index * 800, 200] },
        schematic: { at: [index * 600, 200] },
        pcb: { at: [index * 600, 200] },
      },
    };
  });

  let wireIdCounter = 100;
  const docWires: Record<string, unknown>[] = [];

  for (const conn of connections) {
    const fromNum = partIdMap.get(conn.fromPart);
    const toNum = partIdMap.get(conn.toPart);
    if (!fromNum || !toNum) continue;

    // Schematic wire
    docWires.push({
      id: wireIdCounter++,
      view: "schematic",
      points: [[0, 0], [100, 100]],
      from: { part: fromNum, pin: conn.fromPin },
      to: { part: toNum, pin: conn.toPin },
      color: conn.color || "#418ce1",
    });

    // Breadboard wire
    docWires.push({
      id: wireIdCounter++,
      view: "breadboard",
      points: [[0, 0], [100, 100]],
      from: { part: fromNum, pin: conn.fromPin },
      to: { part: toNum, pin: conn.toPin },
      color: conn.color || "#418ce1",
    });
  }

  const document = validateElectronicsDocument({
    format: "designElectronics",
    version: 1,
    title,
    parts: docParts,
    wires: docWires,
  });

  return { spec, document };
}

// ============================================================================
// 1. SMART EMERGENCY SECURITY ALARM (Challenge 1)
// ============================================================================
export function generateSmartSecurityAlarmCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Smart Emergency Security Alarm System";
  const tag = "Uno · Breadboard · PIR Motion · 2 Pushbuttons · Red & Green LEDs · Buzzer · LCD 16×2";

  const sketch = `// Arduino Uno Smart Emergency Security Alarm
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

const int PIR_PIN = 2;
const int ARM_BTN_PIN = 3;
const int DISARM_BTN_PIN = 4;
const int GREEN_LED_PIN = 5;
const int RED_LED_PIN = 6;
const int BUZZER_PIN = 7;

enum SystemState { DISARMED, ARMED, ALARM_TRIGGERED };
SystemState state = DISARMED;

int lastArmRead = HIGH;
int lastDisarmRead = HIGH;
unsigned long armDebounce = 0;
unsigned long disarmDebounce = 0;
unsigned long flashTimer = 0;
bool redLedState = false;

void updateLCD(const char* line1, const char* line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(ARM_BTN_PIN, INPUT_PULLUP);
  pinMode(DISARM_BTN_PIN, INPUT_PULLUP);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  lcd.init();
  lcd.backlight();
  updateLCD("SECURITY SYSTEM", "DISARMED (SAFE)");
}

void loop() {
  int armRead = digitalRead(ARM_BTN_PIN);
  if (armRead != lastArmRead && millis() - armDebounce > 50) {
    armDebounce = millis();
    if (armRead == LOW && state == DISARMED) {
      state = ARMED;
      updateLCD("SECURITY SYSTEM", "ARMED (ACTIVE)");
    }
    lastArmRead = armRead;
  }

  int disarmRead = digitalRead(DISARM_BTN_PIN);
  if (disarmRead != lastDisarmRead && millis() - disarmDebounce > 50) {
    disarmDebounce = millis();
    if (disarmRead == LOW && state != DISARMED) {
      state = DISARMED;
      noTone(BUZZER_PIN);
      updateLCD("SECURITY SYSTEM", "DISARMED (SAFE)");
    }
    lastDisarmRead = disarmRead;
  }

  if (state == DISARMED) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, LOW);
    noTone(BUZZER_PIN);
  } else if (state == ARMED) {
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
    noTone(BUZZER_PIN);
    if (digitalRead(PIR_PIN) == HIGH) {
      state = ALARM_TRIGGERED;
      updateLCD("!! WARNING !!", "INTRUDER DETECTED");
    }
  } else if (state == ALARM_TRIGGERED) {
    digitalWrite(GREEN_LED_PIN, LOW);
    if (millis() - flashTimer >= 200) {
      flashTimer = millis();
      redLedState = !redLedState;
      digitalWrite(RED_LED_PIN, redLedState ? HIGH : LOW);
      if (redLedState) tone(BUZZER_PIN, 1200);
      else tone(BUZZER_PIN, 800);
    }
  }
}`;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "bb", type: "breadboard", properties: [{ key: "size", value: "half+" }], sketch: "" },
    { id: "pir", type: "hcsr501", properties: [], sketch: "" },
    { id: "btn_arm", type: "pushbutton", properties: [], sketch: "" },
    { id: "btn_disarm", type: "pushbutton", properties: [], sketch: "" },
    { id: "r_green", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_green", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    { id: "r_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "buzzer", type: "buzzer", properties: [], sketch: "" },
    { id: "lcd", type: "lcd1602_i2c", properties: [], sketch: "" },
  ];

  const connections: ConnectionDef[] = [
    // Power & Ground rails
    { fromPart: "uno", fromPin: "5V", toPart: "pir", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "pir", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "5V", toPart: "lcd", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "lcd", toPin: "GND", color: "#1f2937" },
    // I2C bus
    { fromPart: "uno", fromPin: "SDA", toPart: "lcd", toPin: "SDA", color: "#eab308" },
    { fromPart: "uno", fromPin: "SCL", toPart: "lcd", toPin: "SCL", color: "#eab308" },
    // PIR signal
    { fromPart: "uno", fromPin: "D2", toPart: "pir", toPin: "OUT", color: "#3b82f6" },
    // Arm button (D3, INPUT_PULLUP)
    { fromPart: "uno", fromPin: "D3", toPart: "btn_arm", toPin: "pin1", color: "#8b5cf6" },
    { fromPart: "btn_arm", fromPin: "pin2", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // Disarm button (D4, INPUT_PULLUP)
    { fromPart: "uno", fromPin: "D4", toPart: "btn_disarm", toPin: "pin1", color: "#8b5cf6" },
    { fromPart: "btn_disarm", fromPin: "pin2", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // Green LED branch (D5 -> R -> LED -> GND)
    { fromPart: "uno", fromPin: "D5", toPart: "r_green", toPin: "pin0", color: "#22c55e" },
    { fromPart: "r_green", fromPin: "pin1", toPart: "led_green", toPin: "anode", color: "#22c55e" },
    { fromPart: "led_green", fromPin: "cathode", toPart: "uno", toPin: "GND_3", color: "#1f2937" },
    // Red LED branch (D6 -> R -> LED -> GND)
    { fromPart: "uno", fromPin: "D6", toPart: "r_red", toPin: "pin0", color: "#ef4444" },
    { fromPart: "r_red", fromPin: "pin1", toPart: "led_red", toPin: "anode", color: "#ef4444" },
    { fromPart: "led_red", fromPin: "cathode", toPart: "uno", toPin: "GND_3", color: "#1f2937" },
    // Buzzer (D7 -> Buzzer plus, minus -> GND)
    { fromPart: "uno", fromPin: "D7", toPart: "buzzer", toPin: "plus", color: "#f97316" },
    { fromPart: "buzzer", fromPin: "minus", toPart: "uno", toPin: "GND_3", color: "#1f2937" },
  ];

  const warnings = [
    "Smart security alarm with debounced arm/disarm buttons, PIR motion detection, 16×2 I2C LCD, flashing red LED alarm, and buzzer tone generator.",
  ];

  const { spec, document } = buildDualDocumentAndSpec(
    title,
    "Complete breadboard-wired smart security alarm with PIR sensor, dual buttons, status LEDs, buzzer siren, and I2C LCD display.",
    warnings,
    specParts,
    connections,
    sketch,
  );

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: intent.rawPrompt,
    wiring: [
      { label: "PIR Motion Sensor", detail: "VCC → 5V, GND → GND, OUT → Arduino D2" },
      { label: "Arm Button", detail: "Pin 1 → D3 (INPUT_PULLUP), Pin 3 → GND" },
      { label: "Disarm Button", detail: "Pin 1 → D4 (INPUT_PULLUP), Pin 3 → GND" },
      { label: "Safe Indicator", detail: "Green LED Anode → 220 Ω Resistor → D5, Cathode → GND" },
      { label: "Alarm Indicator", detail: "Red LED Anode → 220 Ω Resistor → D6, Cathode → GND" },
      { label: "Piezo Buzzer", detail: "(+) Pin → D7, (−) Pin → GND" },
      { label: "I2C LCD 16×2", detail: "VCC → 5V, GND → GND, SDA → SDA, SCL → SCL" },
    ],
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ============================================================================
// 2. INTELLIGENT FOUR-WAY TRAFFIC CONTROLLER (Challenge 2)
// ============================================================================
export function generateFourWayTrafficCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Intelligent Four-Way Traffic Controller";
  const tag = "Uno · Breadboard · 12 LEDs (NS & EW) · 12 × 220 Ω · 2 Pedestrian Buttons · Emergency Override";

  const sketch = `// Arduino Uno Intelligent Four-Way Traffic Controller
// North/South and East/West traffic phases with Pedestrian & Emergency Override

const int NS_RED = 2;
const int NS_YELLOW = 3;
const int NS_GREEN = 4;

const int S_RED = 5;
const int S_YELLOW = 6;
const int S_GREEN = 7;

const int EW_RED = 8;
const int EW_YELLOW = 9;
const int EW_GREEN = 10;

const int W_RED = 11;
const int W_YELLOW = 12;
const int W_GREEN = 13;

const int PED_NS_BTN = A0;
const int PED_EW_BTN = A1;
const int EMERGENCY_BTN = A2;

enum TrafficPhase { NS_GO, NS_TRANSITION, ALL_RED_NS, EW_GO, EW_TRANSITION, ALL_RED_EW, PED_CROSSING, EMERGENCY };
TrafficPhase currentPhase = NS_GO;

unsigned long phaseTimer = 0;
bool pedRequest = false;

void setPhaseLeds(bool nsR, bool nsY, bool nsG, bool ewR, bool ewY, bool ewG) {
  digitalWrite(NS_RED, nsR);   digitalWrite(S_RED, nsR);
  digitalWrite(NS_YELLOW, nsY);digitalWrite(S_YELLOW, nsY);
  digitalWrite(NS_GREEN, nsG); digitalWrite(S_GREEN, nsG);

  digitalWrite(EW_RED, ewR);   digitalWrite(W_RED, ewR);
  digitalWrite(EW_YELLOW, ewY);digitalWrite(W_YELLOW, ewY);
  digitalWrite(EW_GREEN, ewG); digitalWrite(W_GREEN, ewG);
}

void setup() {
  for (int pin = 2; pin <= 13; pin++) pinMode(pin, OUTPUT);
  pinMode(PED_NS_BTN, INPUT_PULLUP);
  pinMode(PED_EW_BTN, INPUT_PULLUP);
  pinMode(EMERGENCY_BTN, INPUT_PULLUP);
  phaseTimer = millis();
}

void loop() {
  // Check emergency override button immediately
  if (digitalRead(EMERGENCY_BTN) == LOW) {
    currentPhase = EMERGENCY;
  }

  // Check pedestrian request buttons
  if (digitalRead(PED_NS_BTN) == LOW || digitalRead(PED_EW_BTN) == LOW) {
    pedRequest = true;
  }

  unsigned long elapsed = millis() - phaseTimer;

  switch (currentPhase) {
    case NS_GO:
      setPhaseLeds(LOW, LOW, HIGH, HIGH, LOW, LOW);
      if (elapsed > 5000 || (pedRequest && elapsed > 2500)) {
        currentPhase = NS_TRANSITION;
        phaseTimer = millis();
      }
      break;

    case NS_TRANSITION:
      setPhaseLeds(LOW, HIGH, LOW, HIGH, LOW, LOW);
      if (elapsed > 2000) {
        currentPhase = ALL_RED_NS;
        phaseTimer = millis();
      }
      break;

    case ALL_RED_NS:
      setPhaseLeds(HIGH, LOW, LOW, HIGH, LOW, LOW);
      if (elapsed > 1000) {
        if (pedRequest) {
          currentPhase = PED_CROSSING;
          pedRequest = false;
        } else {
          currentPhase = EW_GO;
        }
        phaseTimer = millis();
      }
      break;

    case EW_GO:
      setPhaseLeds(HIGH, LOW, LOW, LOW, LOW, HIGH);
      if (elapsed > 5000) {
        currentPhase = EW_TRANSITION;
        phaseTimer = millis();
      }
      break;

    case EW_TRANSITION:
      setPhaseLeds(HIGH, LOW, LOW, LOW, HIGH, LOW);
      if (elapsed > 2000) {
        currentPhase = ALL_RED_EW;
        phaseTimer = millis();
      }
      break;

    case ALL_RED_EW:
      setPhaseLeds(HIGH, LOW, LOW, HIGH, LOW, LOW);
      if (elapsed > 1000) {
        currentPhase = NS_GO;
        phaseTimer = millis();
      }
      break;

    case PED_CROSSING:
      setPhaseLeds(HIGH, LOW, LOW, HIGH, LOW, LOW);
      if (elapsed > 4000) {
        currentPhase = EW_GO;
        phaseTimer = millis();
      }
      break;

    case EMERGENCY:
      setPhaseLeds(HIGH, LOW, LOW, HIGH, LOW, LOW);
      delay(500);
      setPhaseLeds(LOW, LOW, LOW, LOW, LOW, LOW);
      delay(500);
      if (digitalRead(EMERGENCY_BTN) == HIGH) {
        currentPhase = ALL_RED_NS;
        phaseTimer = millis();
      }
      break;
  }
}`;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "bb", type: "breadboard", properties: [{ key: "size", value: "full+" }], sketch: "" },
    // 12 LEDs + 12 Resistors
    // North
    { id: "r_n_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_n_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "r_n_yel", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_n_yel", type: "led", properties: [{ key: "color", value: "Yellow" }], sketch: "" },
    { id: "r_n_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_n_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    // South
    { id: "r_s_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_s_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "r_s_yel", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_s_yel", type: "led", properties: [{ key: "color", value: "Yellow" }], sketch: "" },
    { id: "r_s_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_s_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    // East
    { id: "r_e_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_e_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "r_e_yel", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_e_yel", type: "led", properties: [{ key: "color", value: "Yellow" }], sketch: "" },
    { id: "r_e_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_e_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    // West
    { id: "r_w_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_w_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "r_w_yel", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_w_yel", type: "led", properties: [{ key: "color", value: "Yellow" }], sketch: "" },
    { id: "r_w_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_w_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    // Buttons
    { id: "btn_ped_ns", type: "pushbutton", properties: [], sketch: "" },
    { id: "btn_ped_ew", type: "pushbutton", properties: [], sketch: "" },
    { id: "btn_emer", type: "pushbutton", properties: [], sketch: "" },
  ];

  const ledPins = [
    { r: "r_n_red", l: "led_n_red", pin: "D2", color: "#ef4444" },
    { r: "r_n_yel", l: "led_n_yel", pin: "D3", color: "#eab308" },
    { r: "r_n_grn", l: "led_n_grn", pin: "D4", color: "#22c55e" },
    { r: "r_s_red", l: "led_s_red", pin: "D5", color: "#ef4444" },
    { r: "r_s_yel", l: "led_s_yel", pin: "D6", color: "#eab308" },
    { r: "r_s_grn", l: "led_s_grn", pin: "D7", color: "#22c55e" },
    { r: "r_e_red", l: "led_e_red", pin: "D8", color: "#ef4444" },
    { r: "r_e_yel", l: "led_e_yel", pin: "D9", color: "#eab308" },
    { r: "r_e_grn", l: "led_e_grn", pin: "D10", color: "#22c55e" },
    { r: "r_w_red", l: "led_w_red", pin: "D11", color: "#ef4444" },
    { r: "r_w_yel", l: "led_w_yel", pin: "D12", color: "#eab308" },
    { r: "r_w_grn", l: "led_w_grn", pin: "D13", color: "#22c55e" },
  ];

  const connections: ConnectionDef[] = [];

  for (const lp of ledPins) {
    connections.push({ fromPart: "uno", fromPin: lp.pin, toPart: lp.r, toPin: "pin0", color: lp.color });
    connections.push({ fromPart: lp.r, fromPin: "pin1", toPart: lp.l, toPin: "anode", color: lp.color });
    connections.push({ fromPart: lp.l, fromPin: "cathode", toPart: "uno", toPin: "GND", color: "#1f2937" });
  }

  connections.push(
    { fromPart: "uno", fromPin: "A0", toPart: "btn_ped_ns", toPin: "pin1", color: "#8b5cf6" },
    { fromPart: "btn_ped_ns", fromPin: "pin2", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    { fromPart: "uno", fromPin: "A1", toPart: "btn_ped_ew", toPin: "pin1", color: "#8b5cf6" },
    { fromPart: "btn_ped_ew", fromPin: "pin2", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    { fromPart: "uno", fromPin: "A2", toPart: "btn_emer", toPin: "pin1", color: "#dc2626" },
    { fromPart: "btn_emer", fromPin: "pin2", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
  );

  const warnings = [
    "Full 4-way intersection with 12 distinct LED branches (North, South, East, West), yellow transitions, all-red intervals, pedestrian crossing requests, and emergency red override.",
  ];

  const { spec, document } = buildDualDocumentAndSpec(
    title,
    "Breadboard-wired four-way intersection controller with 12 LEDs, 12 series resistors, pedestrian crossing buttons, and emergency override.",
    warnings,
    specParts,
    connections,
    sketch,
  );

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: intent.rawPrompt,
    wiring: [
      { label: "North Traffic", detail: "Red (D2), Yellow (D3), Green (D4) via 220 Ω resistors to GND" },
      { label: "South Traffic", detail: "Red (D5), Yellow (D6), Green (D7) via 220 Ω resistors to GND" },
      { label: "East Traffic", detail: "Red (D8), Yellow (D9), Green (D10) via 220 Ω resistors to GND" },
      { label: "West Traffic", detail: "Red (D11), Yellow (D12), Green (D13) via 220 Ω resistors to GND" },
      { label: "Pedestrian Buttons", detail: "NS Request → A0 (INPUT_PULLUP), EW Request → A1 (INPUT_PULLUP)" },
      { label: "Emergency Button", detail: "Emergency Override → A2 (INPUT_PULLUP)" },
    ],
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ============================================================================
// 4. SMART PARKING GARAGE ENTRANCE (Challenge 4)
// ============================================================================
export function generateParkingGarageCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Automatic Parking Entrance System";
  const tag = "Uno · Breadboard · HC-SR04 · Servo Interface · Red & Green LEDs · Buzzer · LCD 16×2";

  const sketch = `// Arduino Uno Automatic Parking Entrance System
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo barrierServo;

const int TRIG_PIN = 11;
const int ECHO_PIN = 12;
const int SERVO_PIN = 9;
const int GREEN_LED = 6;
const int RED_LED = 7;
const int BUZZER_PIN = 8;

bool gateOpen = false;
unsigned long vehicleClearTime = 0;
unsigned long lastMeasureTime = 0;

long getDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  barrierServo.attach(SERVO_PIN);
  barrierServo.write(0); // Barrier closed

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("PARKING ENTRANCE");
  lcd.setCursor(0, 1);
  lcd.print("GATE CLOSED");

  digitalWrite(RED_LED, HIGH);
  digitalWrite(GREEN_LED, LOW);
}

void loop() {
  if (millis() - lastMeasureTime >= 100) {
    lastMeasureTime = millis();
    long distance = getDistanceCm();

    if (distance <= 15 && !gateOpen) {
      // Vehicle detected within 15 cm: Open barrier
      gateOpen = true;
      barrierServo.write(90);
      digitalWrite(GREEN_LED, HIGH);
      digitalWrite(RED_LED, LOW);
      noTone(BUZZER_PIN);
      lcd.setCursor(0, 1);
      lcd.print("GATE OPEN       ");
    } else if (distance > 15 && gateOpen) {
      if (vehicleClearTime == 0) {
        vehicleClearTime = millis();
      } else if (millis() - vehicleClearTime >= 3000) {
        // Vehicle cleared for 3 seconds: Check for obstruction before closing
        if (getDistanceCm() > 15) {
          gateOpen = false;
          vehicleClearTime = 0;
          barrierServo.write(0);
          digitalWrite(GREEN_LED, LOW);
          digitalWrite(RED_LED, HIGH);
          noTone(BUZZER_PIN);
          lcd.setCursor(0, 1);
          lcd.print("GATE CLOSED     ");
        } else {
          // Obstruction detected while attempting to close!
          tone(BUZZER_PIN, 1000);
          vehicleClearTime = millis();
        }
      }
    } else if (distance <= 15 && gateOpen) {
      vehicleClearTime = 0; // Reset clear timer if vehicle is still in zone
    }
  }
}`;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "bb", type: "breadboard", properties: [{ key: "size", value: "half+" }], sketch: "" },
    { id: "sonar", type: "hcsr04", properties: [], sketch: "" },
    { id: "servo_hdr", type: "header_male", properties: [{ key: "pins", value: "3" }], sketch: "" },
    { id: "r_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    { id: "r_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "buzzer", type: "buzzer", properties: [], sketch: "" },
    { id: "lcd", type: "lcd1602_i2c", properties: [], sketch: "" },
  ];

  const connections: ConnectionDef[] = [
    // Ultrasonic HC-SR04
    { fromPart: "uno", fromPin: "5V", toPart: "sonar", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "sonar", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "D11", toPart: "sonar", toPin: "TRIG", color: "#3b82f6" },
    { fromPart: "uno", fromPin: "D12", toPart: "sonar", toPin: "ECHO", color: "#8b5cf6" },
    // Servo 3-Pin Header (Pin 1 = Signal, Pin 2 = 5V, Pin 3 = GND)
    { fromPart: "uno", fromPin: "D9", toPart: "servo_hdr", toPin: "pin1", color: "#f97316" },
    { fromPart: "uno", fromPin: "5V", toPart: "servo_hdr", toPin: "pin2", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "servo_hdr", toPin: "pin3", color: "#1f2937" },
    // Green LED (Open)
    { fromPart: "uno", fromPin: "D6", toPart: "r_grn", toPin: "pin0", color: "#22c55e" },
    { fromPart: "r_grn", fromPin: "pin1", toPart: "led_grn", toPin: "anode", color: "#22c55e" },
    { fromPart: "led_grn", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // Red LED (Closed)
    { fromPart: "uno", fromPin: "D7", toPart: "r_red", toPin: "pin0", color: "#ef4444" },
    { fromPart: "r_red", fromPin: "pin1", toPart: "led_red", toPin: "anode", color: "#ef4444" },
    { fromPart: "led_red", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // Buzzer
    { fromPart: "uno", fromPin: "D8", toPart: "buzzer", toPin: "plus", color: "#f97316" },
    { fromPart: "buzzer", fromPin: "minus", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // LCD 16×2 I2C
    { fromPart: "uno", fromPin: "5V", toPart: "lcd", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "lcd", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "SDA", toPart: "lcd", toPin: "SDA", color: "#eab308" },
    { fromPart: "uno", fromPin: "SCL", toPart: "lcd", toPin: "SCL", color: "#eab308" },
  ];

  const warnings = [
    "Smart parking garage system with HC-SR04 ultrasonic vehicle detection, 3-pin servo motor interface (D9), status LEDs, obstruction buzzer, and 16×2 I2C LCD display. Servo actuator PWM is electrically generated; mechanical motion simulation is partially supported in 2D engine.",
  ];

  const { spec, document } = buildDualDocumentAndSpec(
    title,
    "Complete automatic parking barrier circuit with HC-SR04 ultrasonic distance sensor, 3-pin servo header, red/green status LEDs, obstruction buzzer, and I2C LCD.",
    warnings,
    specParts,
    connections,
    sketch,
  );

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: intent.rawPrompt,
    wiring: [
      { label: "HC-SR04 Ultrasonic", detail: "VCC → 5V, GND → GND, TRIG → D11, ECHO → D12" },
      { label: "Servo Motor Header", detail: "Signal → D9 (PWM), VCC → 5V, GND → GND" },
      { label: "Gate Open LED", detail: "Green LED Anode → 220 Ω Resistor → D6, Cathode → GND" },
      { label: "Gate Closed LED", detail: "Red LED Anode → 220 Ω Resistor → D7, Cathode → GND" },
      { label: "Obstruction Buzzer", detail: "(+) Pin → D8, (−) Pin → GND" },
      { label: "I2C LCD 16×2", detail: "VCC → 5V, GND → GND, SDA → SDA, SCL → SCL" },
    ],
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ============================================================================
// 5. PASSWORD-PROTECTED DOOR LOCK (Challenge 5)
// ============================================================================
export function generateDoorLockCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Electronic Security Door Lock";
  const tag = "Uno · Breadboard · 4×4 Keypad Header · Servo Interface · Red & Green LEDs · Buzzer · LCD 16×2";

  const sketch = `// Arduino Uno Electronic Security Door Lock
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo lockServo;

const char PASSWORD[] = "1234";
char enteredPin[5] = "";
byte pinIndex = 0;
byte failedAttempts = 0;
bool isLockedOut = false;
unsigned long lockoutTimer = 0;
unsigned long unlockTimer = 0;
bool isUnlocked = false;

const int ROW_PINS[4] = {2, 3, 4, 5};
const int COL_PINS[4] = {6, 7, 8, 9};
const char KEYMAP[4][4] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

const int SERVO_PIN = 10;
const int GREEN_LED = 11;
const int RED_LED = 12;
const int BUZZER_PIN = 13;

char getKey() {
  for (int r = 0; r < 4; r++) {
    digitalWrite(ROW_PINS[r], LOW);
    for (int c = 0; c < 4; c++) {
      if (digitalRead(COL_PINS[c]) == LOW) {
        delay(20); // Debounce
        while (digitalRead(COL_PINS[c]) == LOW);
        digitalWrite(ROW_PINS[r], HIGH);
        return KEYMAP[r][c];
      }
    }
    digitalWrite(ROW_PINS[r], HIGH);
  }
  return 0;
}

void setup() {
  for (int r = 0; r < 4; r++) { pinMode(ROW_PINS[r], OUTPUT); digitalWrite(ROW_PINS[r], HIGH); }
  for (int c = 0; c < 4; c++) { pinMode(COL_PINS[c], INPUT_PULLUP); }

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  lockServo.attach(SERVO_PIN);
  lockServo.write(0); // Locked

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("ENTER PIN:");
  digitalWrite(RED_LED, HIGH);
  digitalWrite(GREEN_LED, LOW);
}

void loop() {
  if (isLockedOut) {
    long remaining = 30 - ((millis() - lockoutTimer) / 1000);
    if (remaining > 0) {
      lcd.setCursor(0, 0);
      lcd.print("SYSTEM LOCKED!  ");
      lcd.setCursor(0, 1);
      lcd.print("WAIT: ");
      lcd.print(remaining);
      lcd.print("s   ");
      tone(BUZZER_PIN, 500, 100);
      delay(900);
      return;
    } else {
      isLockedOut = false;
      failedAttempts = 0;
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("ENTER PIN:");
    }
  }

  if (isUnlocked && millis() - unlockTimer >= 5000) {
    isUnlocked = false;
    lockServo.write(0);
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ENTER PIN:");
  }

  char key = getKey();
  if (key) {
    if (key == '#') {
      // Submit PIN
      enteredPin[pinIndex] = '\\0';
      if (strcmp(enteredPin, PASSWORD) == 0) {
        // Correct Password
        isUnlocked = true;
        unlockTimer = millis();
        failedAttempts = 0;
        lockServo.write(90);
        digitalWrite(GREEN_LED, HIGH);
        digitalWrite(RED_LED, LOW);
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("ACCESS GRANTED");
        lcd.setCursor(0, 1);
        lcd.print("DOOR UNLOCKED");
        tone(BUZZER_PIN, 1800, 300);
      } else {
        // Wrong Password
        failedAttempts++;
        digitalWrite(RED_LED, HIGH);
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("ACCESS DENIED");
        tone(BUZZER_PIN, 400, 600);
        delay(1000);

        if (failedAttempts >= 3) {
          isLockedOut = true;
          lockoutTimer = millis();
        } else {
          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("ENTER PIN:");
        }
      }
      pinIndex = 0;
      memset(enteredPin, 0, sizeof(enteredPin));
    } else if (key == '*') {
      // Clear
      pinIndex = 0;
      memset(enteredPin, 0, sizeof(enteredPin));
      lcd.setCursor(0, 1);
      lcd.print("                ");
    } else if (pinIndex < 4) {
      enteredPin[pinIndex++] = key;
      lcd.setCursor(pinIndex - 1, 1);
      lcd.print('*');
    }
  }
}`;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "bb", type: "breadboard", properties: [{ key: "size", value: "half+" }], sketch: "" },
    { id: "keypad_hdr", type: "header_female", properties: [{ key: "pins", value: "8" }], sketch: "" },
    { id: "servo_hdr", type: "header_male", properties: [{ key: "pins", value: "3" }], sketch: "" },
    { id: "r_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    { id: "r_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "buzzer", type: "buzzer", properties: [], sketch: "" },
    { id: "lcd", type: "lcd1602_i2c", properties: [], sketch: "" },
  ];

  const connections: ConnectionDef[] = [
    // 4x4 Keypad 8-Pin Header (Pins 1..4: Rows D2..D5, Pins 5..8: Cols D6..D9)
    { fromPart: "uno", fromPin: "D2", toPart: "keypad_hdr", toPin: "pin1", color: "#3b82f6" },
    { fromPart: "uno", fromPin: "D3", toPart: "keypad_hdr", toPin: "pin2", color: "#3b82f6" },
    { fromPart: "uno", fromPin: "D4", toPart: "keypad_hdr", toPin: "pin3", color: "#3b82f6" },
    { fromPart: "uno", fromPin: "D5", toPart: "keypad_hdr", toPin: "pin4", color: "#3b82f6" },
    { fromPart: "uno", fromPin: "D6", toPart: "keypad_hdr", toPin: "pin5", color: "#8b5cf6" },
    { fromPart: "uno", fromPin: "D7", toPart: "keypad_hdr", toPin: "pin6", color: "#8b5cf6" },
    { fromPart: "uno", fromPin: "D8", toPart: "keypad_hdr", toPin: "pin7", color: "#8b5cf6" },
    { fromPart: "uno", fromPin: "D9", toPart: "keypad_hdr", toPin: "pin8", color: "#8b5cf6" },
    // Servo 3-Pin Header
    { fromPart: "uno", fromPin: "D10", toPart: "servo_hdr", toPin: "pin1", color: "#f97316" },
    { fromPart: "uno", fromPin: "5V", toPart: "servo_hdr", toPin: "pin2", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "servo_hdr", toPin: "pin3", color: "#1f2937" },
    // Green LED (Granted)
    { fromPart: "uno", fromPin: "D11", toPart: "r_grn", toPin: "pin0", color: "#22c55e" },
    { fromPart: "r_grn", fromPin: "pin1", toPart: "led_grn", toPin: "anode", color: "#22c55e" },
    { fromPart: "led_grn", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // Red LED (Denied)
    { fromPart: "uno", fromPin: "D12", toPart: "r_red", toPin: "pin0", color: "#ef4444" },
    { fromPart: "r_red", fromPin: "pin1", toPart: "led_red", toPin: "anode", color: "#ef4444" },
    { fromPart: "led_red", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // Buzzer
    { fromPart: "uno", fromPin: "D13", toPart: "buzzer", toPin: "plus", color: "#f97316" },
    { fromPart: "buzzer", fromPin: "minus", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
    // LCD 16×2 I2C
    { fromPart: "uno", fromPin: "5V", toPart: "lcd", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "lcd", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "SDA", toPart: "lcd", toPin: "SDA", color: "#eab308" },
    { fromPart: "uno", fromPin: "SCL", toPart: "lcd", toPin: "SCL", color: "#eab308" },
  ];

  const warnings = [
    "Security door lock circuit with 4×4 keypad header interface (D2..D9), servo door actuator header (D10), status LEDs, buzzer alarm, and 16×2 I2C LCD. Default passcode is 1234. Physical keypad scanning and servo mechanism are partially supported in the web simulation engine.",
  ];

  const { spec, document } = buildDualDocumentAndSpec(
    title,
    "Breadboard-wired electronic door lock with 4×4 keypad interface, servo motor lock header, access LEDs, alarm buzzer, and I2C LCD display.",
    warnings,
    specParts,
    connections,
    sketch,
  );

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: intent.rawPrompt,
    wiring: [
      { label: "Keypad Header (8-Pin)", detail: "Rows 1..4 → D2..D5, Cols 1..4 → D6..D9" },
      { label: "Servo Motor Header", detail: "Signal → D10 (PWM), VCC → 5V, GND → GND" },
      { label: "Access Granted LED", detail: "Green LED Anode → 220 Ω Resistor → D11, Cathode → GND" },
      { label: "Access Denied LED", detail: "Red LED Anode → 220 Ω Resistor → D12, Cathode → GND" },
      { label: "Alert Buzzer", detail: "(+) Pin → D13, (−) Pin → GND" },
      { label: "I2C LCD 16×2", detail: "VCC → 5V, GND → GND, SDA → SDA, SCL → SCL" },
    ],
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ============================================================================
// 6. AUTOMATIC TEMPERATURE-CONTROLLED COOLING (Challenge 6)
// ============================================================================
export function generateTemperatureCoolingCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Automatic Temperature-Controlled Cooling System";
  const tag = "Uno · Breadboard · TMP36 · DC Fan/Motor · NPN Transistor & Flyback Diode · Red & Green LEDs · Buzzer · LCD 16×2";

  const sketch = `// Arduino Uno Automatic Temperature-Controlled Cooling System
// Uses TMP36 on A0, NPN Transistor + 1N4007 Flyback Diode for motor, LEDs, Buzzer, I2C LCD
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

const int TEMP_SENSOR_PIN = A0;
const int FAN_PWM_PIN = 3;
const int GREEN_LED = 4;
const int RED_LED = 5;
const int BUZZER_PIN = 8;

bool fanRunning = false;
unsigned long lastUpdate = 0;

float readTemperatureC() {
  int raw = analogRead(TEMP_SENSOR_PIN);
  float voltage = raw * (5.0 / 1023.0);
  return (voltage - 0.5) * 100.0;
}

void setup() {
  pinMode(FAN_PWM_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  analogWrite(FAN_PWM_PIN, 0); // Fan off initially

  lcd.init();
  lcd.backlight();
}

void loop() {
  if (millis() - lastUpdate >= 250) {
    lastUpdate = millis();
    float tempC = readTemperatureC();

    // Hysteresis control: turn ON at >= 30.0 C, turn OFF at < 28.0 C
    if (!fanRunning && tempC >= 30.0) {
      fanRunning = true;
      analogWrite(FAN_PWM_PIN, 255); // Full speed
    } else if (fanRunning && tempC < 28.0) {
      fanRunning = false;
      analogWrite(FAN_PWM_PIN, 0); // Fan OFF
    }

    // High temperature warning at >= 40.0 C
    if (tempC >= 40.0) {
      digitalWrite(RED_LED, HIGH);
      digitalWrite(GREEN_LED, LOW);
      tone(BUZZER_PIN, 1500);
    } else {
      digitalWrite(RED_LED, LOW);
      noTone(BUZZER_PIN);
      digitalWrite(GREEN_LED, fanRunning ? LOW : HIGH);
    }

    lcd.setCursor(0, 0);
    lcd.print("TEMP: ");
    lcd.print(tempC, 1);
    lcd.print((char)223); // Degree symbol
    lcd.print("C   ");

    lcd.setCursor(0, 1);
    if (tempC >= 40.0) {
      lcd.print("STATUS: OVERHEAT");
    } else if (fanRunning) {
      lcd.print("FAN: RUNNING    ");
    } else {
      lcd.print("FAN: OFF (SAFE) ");
    }
  }
}`;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "bb", type: "breadboard", properties: [{ key: "size", value: "half+" }], sketch: "" },
    { id: "tmp36", type: "tmp36", properties: [], sketch: "" },
    { id: "fan", type: "dc_motor", properties: [], sketch: "" },
    { id: "flyback", type: "diode", properties: [], sketch: "" },
    { id: "q1", type: "transistor", properties: [{ key: "type", value: "NPN" }], sketch: "" },
    { id: "r_base", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    { id: "r_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "buzzer", type: "buzzer", properties: [], sketch: "" },
    { id: "lcd", type: "lcd1602_i2c", properties: [], sketch: "" },
  ];

  const connections: ConnectionDef[] = [
    // TMP36 Temperature Sensor (+VS to 5V, GND to GND, VOUT to A0)
    { fromPart: "uno", fromPin: "5V", toPart: "tmp36", toPin: "+VS", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "tmp36", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "A0", toPart: "tmp36", toPin: "VOUT", color: "#3b82f6" },

    // DC Fan/Motor driven by NPN Transistor & protected by 1N4007 Flyback Diode
    // Motor Pin 0 to +5V rail, Diode Cathode to +5V rail
    { fromPart: "uno", fromPin: "5V", toPart: "fan", toPin: "pin0", color: "#ef4444" },
    { fromPart: "uno", fromPin: "5V", toPart: "flyback", toPin: "cathode", color: "#ef4444" },
    // Motor Pin 1 & Diode Anode to Transistor Collector
    { fromPart: "fan", fromPin: "pin1", toPart: "q1", toPin: "C", color: "#10b981" },
    { fromPart: "flyback", fromPin: "anode", toPart: "q1", toPin: "C", color: "#10b981" },
    // Transistor Emitter to GND
    { fromPart: "q1", fromPin: "E", toPart: "uno", toPin: "GND", color: "#1f2937" },
    // Transistor Base via 1000 Ω resistor to Arduino D3 PWM
    { fromPart: "uno", fromPin: "D3", toPart: "r_base", toPin: "pin0", color: "#3b82f6" },
    { fromPart: "r_base", fromPin: "pin1", toPart: "q1", toPin: "B", color: "#3b82f6" },

    // Green LED (Safe/Normal) to D4
    { fromPart: "uno", fromPin: "D4", toPart: "r_grn", toPin: "pin0", color: "#22c55e" },
    { fromPart: "r_grn", fromPin: "pin1", toPart: "led_grn", toPin: "anode", color: "#22c55e" },
    { fromPart: "led_grn", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // Red LED (Overheat) to D5
    { fromPart: "uno", fromPin: "D5", toPart: "r_red", toPin: "pin0", color: "#ef4444" },
    { fromPart: "r_red", fromPin: "pin1", toPart: "led_red", toPin: "anode", color: "#ef4444" },
    { fromPart: "led_red", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // Buzzer to D8
    { fromPart: "uno", fromPin: "D8", toPart: "buzzer", toPin: "plus", color: "#f97316" },
    { fromPart: "buzzer", fromPin: "minus", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // LCD 16×2 I2C
    { fromPart: "uno", fromPin: "5V", toPart: "lcd", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "lcd", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "SDA", toPart: "lcd", toPin: "SDA", color: "#eab308" },
    { fromPart: "uno", fromPin: "SCL", toPart: "lcd", toPin: "SCL", color: "#eab308" },
  ];

  const warnings = [
    "Temperature-controlled cooling system featuring TMP36 precision sensor, NPN transistor driver (2N2222/TIP120) with protective flyback diode, 1 kΩ base resistor, dual LEDs, overheat buzzer, and 16×2 I2C LCD. Motor is isolated from Arduino GPIO pins for electrical safety.",
  ];

  const { spec, document } = buildDualDocumentAndSpec(
    title,
    "Breadboard-wired automatic cooling controller with TMP36 analog temperature sensor, transistor motor driver with flyback diode, warning LEDs, buzzer, and I2C LCD.",
    warnings,
    specParts,
    connections,
    sketch,
  );

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: intent.rawPrompt,
    wiring: [
      { label: "TMP36 Temperature Sensor", detail: "+VS → 5V, GND → GND, VOUT → A0" },
      { label: "DC Fan Driver", detail: "Motor (+) → 5V rail; Motor (−) & Flyback Anode → NPN Collector; Emitter → GND; Base via 1 kΩ → D3" },
      { label: "Flyback Protection", detail: "Diode Cathode → 5V rail, Anode → Transistor Collector (parallel with motor)" },
      { label: "Safe Mode LED", detail: "Green LED Anode → 220 Ω Resistor → D4, Cathode → GND" },
      { label: "Warning LED", detail: "Red LED Anode → 220 Ω Resistor → D5, Cathode → GND" },
      { label: "Overheat Buzzer", detail: "(+) Pin → D8, (−) Pin → GND" },
      { label: "I2C LCD 16×2", detail: "VCC → 5V, GND → GND, SDA → SDA, SCL → SCL" },
    ],
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ============================================================================
// 7. ADVANCED 74HC595 LED CONTROLLER (Challenge 7)
// ============================================================================
export function generateAdvancedShiftRegisterCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Programmable 8-LED Animation Controller (74HC595)";
  const tag = "Uno · Breadboard · 74HC595 · 8 LEDs · 8 × 1000 Ω · 10 kΩ Potentiometer · 2 Debounced Pushbuttons";

  const sketch = `// Arduino Uno Programmable 8-LED Animation Controller (74HC595)
// Non-blocking animation timing with Potentiometer Speed Control & 2 Pushbuttons

const int LATCH_PIN = 8;  // ST_CP (pin 12 on 74HC595)
const int DATA_PIN = 11;  // DS (pin 14 on 74HC595)
const int CLOCK_PIN = 12; // SH_CP (pin 11 on 74HC595)

const int MODE_BTN = 2;
const int PAUSE_BTN = 3;
const int SPEED_POT = A0;

byte currentMode = 0; // 0 = Running, 1 = Bouncing, 2 = Alternating
bool isPaused = false;
byte animationStep = 0;
bool bounceDirection = true;
unsigned long lastStepTime = 0;

int lastModeRead = HIGH;
int lastPauseRead = HIGH;
unsigned long modeDebounce = 0;
unsigned long pauseDebounce = 0;

void writeShiftRegister(byte pattern) {
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, pattern);
  digitalWrite(LATCH_PIN, HIGH);
}

void setup() {
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);

  pinMode(MODE_BTN, INPUT_PULLUP);
  pinMode(PAUSE_BTN, INPUT_PULLUP);

  writeShiftRegister(0x00);
}

void loop() {
  // Check Mode Button
  int modeRead = digitalRead(MODE_BTN);
  if (modeRead != lastModeRead && millis() - modeDebounce > 50) {
    modeDebounce = millis();
    if (modeRead == LOW) {
      currentMode = (currentMode + 1) % 3;
      animationStep = 0;
      bounceDirection = true;
    }
    lastModeRead = modeRead;
  }

  // Check Pause Button
  int pauseRead = digitalRead(PAUSE_BTN);
  if (pauseRead != lastPauseRead && millis() - pauseDebounce > 50) {
    pauseDebounce = millis();
    if (pauseRead == LOW) {
      isPaused = !isPaused;
    }
    lastPauseRead = pauseRead;
  }

  // Read speed from Potentiometer: map 0..1023 to 30ms..500ms step delay
  int potVal = analogRead(SPEED_POT);
  unsigned long stepDelay = map(potVal, 0, 1023, 30, 500);

  if (!isPaused && millis() - lastStepTime >= stepDelay) {
    lastStepTime = millis();

    byte pattern = 0x00;

    if (currentMode == 0) {
      // Mode 0: Running Lights (Chaser left to right)
      pattern = 1 << animationStep;
      animationStep = (animationStep + 1) % 8;
    } else if (currentMode == 1) {
      // Mode 1: Bouncing Lights
      pattern = 1 << animationStep;
      if (bounceDirection) {
        animationStep++;
        if (animationStep >= 7) bounceDirection = false;
      } else {
        animationStep--;
        if (animationStep == 0) bounceDirection = true;
      }
    } else if (currentMode == 2) {
      // Mode 2: Alternating Pattern (0x55 <-> 0xAA)
      pattern = (animationStep % 2 == 0) ? 0b01010101 : 0b10101010;
      animationStep = (animationStep + 1) % 2;
    }

    writeShiftRegister(pattern);
  }
}`;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "bb", type: "breadboard", properties: [{ key: "size", value: "full+" }], sketch: "" },
    { id: "sr", type: "74hc595", properties: [], sketch: "" },
    // 8 Resistors (1kΩ each)
    { id: "r1", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r2", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r3", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r4", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r5", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r6", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r7", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r8", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    // 8 LEDs
    { id: "led1", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "led2", type: "led", properties: [{ key: "color", value: "Yellow" }], sketch: "" },
    { id: "led3", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    { id: "led4", type: "led", properties: [{ key: "color", value: "Blue" }], sketch: "" },
    { id: "led5", type: "led", properties: [{ key: "color", value: "White" }], sketch: "" },
    { id: "led6", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "led7", type: "led", properties: [{ key: "color", value: "Yellow" }], sketch: "" },
    { id: "led8", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    // Potentiometer & Pushbuttons
    { id: "pot", type: "potentiometer", properties: [{ key: "resistance", value: "10kΩ" }], sketch: "" },
    { id: "btn_mode", type: "pushbutton", properties: [], sketch: "" },
    { id: "btn_pause", type: "pushbutton", properties: [], sketch: "" },
  ];

  const qPins = ["pin15", "pin1", "pin2", "pin3", "pin4", "pin5", "pin6", "pin7"];
  const connections: ConnectionDef[] = [
    // 74HC595 Power & Control
    { fromPart: "uno", fromPin: "D11", toPart: "sr", toPin: "pin14", color: "#3b82f6" }, // DS
    { fromPart: "uno", fromPin: "D8", toPart: "sr", toPin: "pin12", color: "#eab308" },  // ST_CP
    { fromPart: "uno", fromPin: "D12", toPart: "sr", toPin: "pin11", color: "#22c55e" }, // SH_CP
    { fromPart: "uno", fromPin: "5V", toPart: "sr", toPin: "pin16", color: "#ef4444" },  // VCC
    { fromPart: "uno", fromPin: "GND", toPart: "sr", toPin: "pin8", color: "#1f2937" },  // GND
    { fromPart: "uno", fromPin: "5V", toPart: "sr", toPin: "pin10", color: "#ef4444" },  // MR
    { fromPart: "uno", fromPin: "GND", toPart: "sr", toPin: "pin13", color: "#1f2937" }, // OE

    // Potentiometer (5V, GND, A0)
    { fromPart: "uno", fromPin: "5V", toPart: "pot", toPin: "leg1", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "pot", toPin: "leg2", color: "#1f2937" },
    { fromPart: "uno", fromPin: "A0", toPart: "pot", toPin: "wiper", color: "#f97316" },

    // Pushbutton 1 (Mode: D2, INPUT_PULLUP)
    { fromPart: "uno", fromPin: "D2", toPart: "btn_mode", toPin: "pin1", color: "#8b5cf6" },
    { fromPart: "btn_mode", fromPin: "pin2", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // Pushbutton 2 (Pause/Resume: D3, INPUT_PULLUP)
    { fromPart: "uno", fromPin: "D3", toPart: "btn_pause", toPin: "pin1", color: "#8b5cf6" },
    { fromPart: "btn_pause", fromPin: "pin2", toPart: "uno", toPin: "GND_2", color: "#1f2937" },
  ];

  for (let i = 0; i < 8; i++) {
    const rId = `r${i + 1}`;
    const ledId = `led${i + 1}`;
    connections.push({ fromPart: "sr", fromPin: qPins[i], toPart: rId, toPin: "pin0", color: "#3b82f6" });
    connections.push({ fromPart: rId, fromPin: "pin1", toPart: ledId, toPin: "anode", color: "#3b82f6" });
    connections.push({ fromPart: ledId, fromPin: "cathode", toPart: "uno", toPin: "GND_3", color: "#1f2937" });
  }

  const warnings = [
    "Programmable 8-LED animation controller using 74HC595 shift register, 1 kΩ current-limiting resistors per LED (keeping aggregate load below 50 mA), 10 kΩ potentiometer for dynamic speed adjustment, and dual debounced buttons for mode switching and pause/resume.",
  ];

  const { spec, document } = buildDualDocumentAndSpec(
    title,
    "Breadboard-wired 8-LED shift register animation controller with 10k potentiometer speed tuning, mode selector button, and pause/resume button.",
    warnings,
    specParts,
    connections,
    sketch,
  );

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: intent.rawPrompt,
    wiring: [
      { label: "74HC595 Control", detail: "Data (DS) → D11, Latch (ST_CP) → D8, Clock (SH_CP) → D12" },
      { label: "74HC595 Power", detail: "VCC (pin 16) & MR (pin 10) → 5V; GND (pin 8) & OE (pin 13) → GND" },
      { label: "8 LEDs Output", detail: "Q0–Q7 (pins 15, 1..7) → 8 × 1 kΩ Resistors → 8 × LEDs Anodes (+); Cathodes → GND" },
      { label: "Speed Potentiometer", detail: "Leg 1 → 5V, Leg 2 → GND, Wiper → A0" },
      { label: "Mode Button", detail: "Pin 1 → D2 (INPUT_PULLUP), Pin 3 → GND" },
      { label: "Pause Button", detail: "Pin 1 → D3 (INPUT_PULLUP), Pin 3 → GND" },
    ],
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}

// ============================================================================
// 8. AUTOMATIC WATER TANK & PUMP CONTROLLER (Challenge 8)
// ============================================================================
export function generateWaterTankPumpCircuit(intent: CircuitIntent): GeneratedCircuit {
  const title = "Arduino Uno Automatic Water Tank & Pump Controller";
  const tag = "Uno · Breadboard · HC-SR04 · DC Pump & Flyback Driver · 3 Level LEDs · Buzzer · LCD 16×2";

  const sketch = `// Arduino Uno Automatic Water Tank & Pump Controller
// Ultrasonic level sensing with hysteresis pump control, flyback-protected motor driver, LEDs, Buzzer & LCD
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

const int TRIG_PIN = 11;
const int ECHO_PIN = 12;
const int PUMP_PIN = 3; // Transistor base drive (PWM capable)

const int GREEN_LED = 4; // Full level
const int YELLOW_LED = 5; // Medium level
const int RED_LED = 6;    // Low level
const int BUZZER_PIN = 8; // Alarm buzzer

const int TANK_EMPTY_CM = 100;
const int TANK_FULL_CM = 10;

bool pumpRunning = false;
unsigned long lastMeasureTime = 0;

long measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;
  return duration * 0.034 / 2;
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(PUMP_PIN, LOW);

  lcd.init();
  lcd.backlight();
}

void loop() {
  if (millis() - lastMeasureTime >= 300) {
    lastMeasureTime = millis();
    long distance = measureDistanceCm();

    if (distance < 0 || distance > 200) {
      // Sensor reading invalid
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(YELLOW_LED, LOW);
      digitalWrite(RED_LED, HIGH);
      tone(BUZZER_PIN, 1000);
      lcd.setCursor(0, 0);
      lcd.print("WATER TANK: ERR ");
      lcd.setCursor(0, 1);
      lcd.print("SENSOR FAULT!   ");
      return;
    }

    // Calculate water level percentage
    long levelPercent = map(distance, TANK_EMPTY_CM, TANK_FULL_CM, 0, 100);
    levelPercent = constrain(levelPercent, 0, 100);

    // Hysteresis Pump Control:
    // Start pump if level falls below 20%
    if (levelPercent < 20 && !pumpRunning) {
      pumpRunning = true;
      digitalWrite(PUMP_PIN, HIGH);
    }
    // Stop pump once level reaches or exceeds 90%
    else if (levelPercent >= 90 && pumpRunning) {
      pumpRunning = false;
      digitalWrite(PUMP_PIN, LOW);
    }

    // LED status indicators
    if (levelPercent >= 80) {
      digitalWrite(GREEN_LED, HIGH);
      digitalWrite(YELLOW_LED, LOW);
      digitalWrite(RED_LED, LOW);
      noTone(BUZZER_PIN);
    } else if (levelPercent >= 30) {
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(YELLOW_LED, HIGH);
      digitalWrite(RED_LED, LOW);
      noTone(BUZZER_PIN);
    } else {
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(YELLOW_LED, LOW);
      digitalWrite(RED_LED, HIGH);
      if (levelPercent < 10) {
        tone(BUZZER_PIN, 1800, 150); // Critical low water alarm
      } else {
        noTone(BUZZER_PIN);
      }
    }

    lcd.setCursor(0, 0);
    lcd.print("LEVEL: ");
    lcd.print(levelPercent);
    lcd.print("%    ");

    lcd.setCursor(0, 1);
    if (pumpRunning) {
      lcd.print("PUMP: FILLING   ");
    } else {
      lcd.print("PUMP: STANDBY   ");
    }
  }
}`;

  const specParts: CircuitSpec["parts"] = [
    { id: "uno", type: "arduino_uno", properties: [], sketch },
    { id: "bb", type: "breadboard", properties: [{ key: "size", value: "half+" }], sketch: "" },
    { id: "sonar", type: "hcsr04", properties: [], sketch: "" },
    { id: "pump", type: "dc_motor", properties: [], sketch: "" },
    { id: "flyback", type: "diode", properties: [], sketch: "" },
    { id: "q1", type: "transistor", properties: [{ key: "type", value: "NPN" }], sketch: "" },
    { id: "r_base", type: "resistor", properties: [{ key: "resistance", value: "1000" }], sketch: "" },
    { id: "r_grn", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_grn", type: "led", properties: [{ key: "color", value: "Green" }], sketch: "" },
    { id: "r_yel", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_yel", type: "led", properties: [{ key: "color", value: "Yellow" }], sketch: "" },
    { id: "r_red", type: "resistor", properties: [{ key: "resistance", value: "220" }], sketch: "" },
    { id: "led_red", type: "led", properties: [{ key: "color", value: "Red" }], sketch: "" },
    { id: "buzzer", type: "buzzer", properties: [], sketch: "" },
    { id: "lcd", type: "lcd1602_i2c", properties: [], sketch: "" },
  ];

  const connections: ConnectionDef[] = [
    // Ultrasonic sensor
    { fromPart: "uno", fromPin: "5V", toPart: "sonar", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "sonar", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "D11", toPart: "sonar", toPin: "TRIG", color: "#3b82f6" },
    { fromPart: "uno", fromPin: "D12", toPart: "sonar", toPin: "ECHO", color: "#8b5cf6" },

    // DC Pump Motor with NPN Transistor & Flyback Diode
    { fromPart: "uno", fromPin: "5V", toPart: "pump", toPin: "pin0", color: "#ef4444" },
    { fromPart: "uno", fromPin: "5V", toPart: "flyback", toPin: "cathode", color: "#ef4444" },
    { fromPart: "pump", fromPin: "pin1", toPart: "q1", toPin: "C", color: "#10b981" },
    { fromPart: "flyback", fromPin: "anode", toPart: "q1", toPin: "C", color: "#10b981" },
    { fromPart: "q1", fromPin: "E", toPart: "uno", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "D3", toPart: "r_base", toPin: "pin0", color: "#3b82f6" },
    { fromPart: "r_base", fromPin: "pin1", toPart: "q1", toPin: "B", color: "#3b82f6" },

    // Green LED (Full) to D4
    { fromPart: "uno", fromPin: "D4", toPart: "r_grn", toPin: "pin0", color: "#22c55e" },
    { fromPart: "r_grn", fromPin: "pin1", toPart: "led_grn", toPin: "anode", color: "#22c55e" },
    { fromPart: "led_grn", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // Yellow LED (Medium) to D5
    { fromPart: "uno", fromPin: "D5", toPart: "r_yel", toPin: "pin0", color: "#eab308" },
    { fromPart: "r_yel", fromPin: "pin1", toPart: "led_yel", toPin: "anode", color: "#eab308" },
    { fromPart: "led_yel", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // Red LED (Low) to D6
    { fromPart: "uno", fromPin: "D6", toPart: "r_red", toPin: "pin0", color: "#ef4444" },
    { fromPart: "r_red", fromPin: "pin1", toPart: "led_red", toPin: "anode", color: "#ef4444" },
    { fromPart: "led_red", fromPin: "cathode", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // Buzzer to D8
    { fromPart: "uno", fromPin: "D8", toPart: "buzzer", toPin: "plus", color: "#f97316" },
    { fromPart: "buzzer", fromPin: "minus", toPart: "uno", toPin: "GND_2", color: "#1f2937" },

    // LCD 16×2 I2C
    { fromPart: "uno", fromPin: "5V", toPart: "lcd", toPin: "VCC", color: "#ef4444" },
    { fromPart: "uno", fromPin: "GND", toPart: "lcd", toPin: "GND", color: "#1f2937" },
    { fromPart: "uno", fromPin: "SDA", toPart: "lcd", toPin: "SDA", color: "#eab308" },
    { fromPart: "uno", fromPin: "SCL", toPart: "lcd", toPin: "SCL", color: "#eab308" },
  ];

  const warnings = [
    "Automatic water tank and pump controller with HC-SR04 ultrasonic water level measurement, safe transistor driver with 1N4007 flyback suppression, 3-level LED indicators, critical low/sensor fault buzzer, and 16×2 I2C LCD displaying live level percentage and pump state.",
  ];

  const { spec, document } = buildDualDocumentAndSpec(
    title,
    "Breadboard-wired water tank management system with ultrasonic depth sensor, transistor-switched pump motor with flyback diode, full/medium/low LEDs, alarm buzzer, and I2C LCD.",
    warnings,
    specParts,
    connections,
    sketch,
  );

  return {
    id: crypto.randomUUID(),
    title,
    tag,
    promptText: intent.rawPrompt,
    wiring: [
      { label: "HC-SR04 Level Sensor", detail: "VCC → 5V, GND → GND, TRIG → D11, ECHO → D12" },
      { label: "Water Pump Driver", detail: "Pump (+) → 5V; Pump (−) & Flyback Anode → NPN Collector; Emitter → GND; Base via 1 kΩ → D3" },
      { label: "Flyback Diode", detail: "Cathode → 5V rail, Anode → Transistor Collector (suppresses inductive kickback)" },
      { label: "Level Indicators", detail: "Green (Full) → D4, Yellow (Medium) → D5, Red (Low) → D6 via 220 Ω resistors to GND" },
      { label: "Alarm Buzzer", detail: "(+) Pin → D8, (−) Pin → GND" },
      { label: "I2C LCD 16×2", detail: "VCC → 5V, GND → GND, SDA → SDA, SCL → SCL" },
    ],
    arduinoCode: sketch,
    document,
    spec,
    intent,
  };
}
