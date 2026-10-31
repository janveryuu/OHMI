import { validateElectronicsDocument } from "./electronics-document.ts";
import { validateCircuitSpec, type CircuitSpec } from "./circuit-spec.ts";

export interface CircuitIntent {
  isCircuitRequest: boolean;
  controller: "arduino" | "battery";
  ledCount: number;
  colors: string[];
  hasBattery: boolean;
  batteryVoltage: string;
  hasSwitch: boolean;
  resistorOhms: number;
  behavior: "traffic_light" | "chaser" | "blink" | "dc";
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
  const combined = `${userText || ""} ${assistantText || ""}`.toLowerCase();

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
    // Check word numbers
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

  // If no count specified, default reasonably
  if (count === 0) {
    if (mentionsTraffic) count = 3;
    else if (mentionsLed) count = /\bleds\b/i.test(combined) ? 3 : 1;
    else if (mentionsArduino && mentionsBattery) count = 0; // Pure Arduino + battery request
    else count = mentionsArduino ? 3 : 1;
  }
  count = Math.max(0, Math.min(10, count));

  // Extract colors
  const extractedColors: string[] = [];
  const colorMatches = combined.matchAll(/\b(red|yellow|green|blue|white)\b/gi);
  for (const match of colorMatches) {
    const capitalized = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (!extractedColors.includes(capitalized) && extractedColors.length < Math.max(1, count)) {
      extractedColors.push(capitalized);
    }
  }

  // If traffic light, force standard colors
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

  // Extract voltage if battery
  let batteryVoltage = "9V";
  const voltMatch = combined.match(/\b(1\.5|3|5|9|12)\s*v\b/i);
  if (voltMatch) batteryVoltage = `${voltMatch[1]}V`;

  // Resistor: 220 for 5V Uno, 470 for 9V battery, 330 for lower DC
  let resistorOhms = isArduino ? 220 : batteryVoltage === "9V" || batteryVoltage === "12V" ? 470 : 330;
  const ohmMatch = combined.match(/\b(\d{2,4})\s*(?:ohm|Ω)\b/i);
  if (ohmMatch) resistorOhms = parseInt(ohmMatch[1], 10);

  let behavior: CircuitIntent["behavior"] = "chaser";
  if (mentionsTraffic && count === 3) behavior = "traffic_light";
  else if (/\b(?:blink|blinking|flash)\b/i.test(combined) || count === 0) behavior = "blink";
  else if (isBattery) behavior = "dc";

  return {
    isCircuitRequest,
    controller: isArduino ? "arduino" : "battery",
    ledCount: count,
    colors,
    hasBattery,
    batteryVoltage,
    hasSwitch,
    resistorOhms,
    behavior,
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

  const startPin = ledCount > 8 ? 2 : 8;
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

export function generateCircuit(intent: CircuitIntent): GeneratedCircuit {
  const isArduino = intent.controller === "arduino";
  const hasBattery = intent.hasBattery;
  const ledCount = intent.ledCount;
  const colors = intent.colors;
  const startPin = ledCount > 8 ? 2 : 8;
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

    // Wire battery plus to Arduino VIN
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
    );

    // Wire battery minus to Arduino GND_3
    wires.push(
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

  let switchId = 0;
  if (intent.hasSwitch && !isArduino) {
    switchId = 50;
    parts.push({
      id: switchId,
      type: "switch",
      label: "SW1",
      props: { position: "left" },
      views: {
        breadboard: { at: [1800, 0] },
        schematic: { at: [1800, 0] },
        pcb: { at: [1800, 0] },
      },
    });
    // Wire battery plus to switch common
    wires.push(
      {
        id: nextWireId++,
        view: "schematic",
        points: [[600, 0], [1800, 0]],
        from: { part: 1, pin: "plus" },
        to: { part: switchId, pin: "common" },
      },
      {
        id: nextWireId++,
        view: "breadboard",
        points: [[600, 0], [1800, 0]],
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
        points: [[3600, yOffset], [4300, yOffset]],
        from: { part: resId, pin: "pin1" },
        to: { part: ledId, pin: "anode" },
        color: "#418ce1",
      },
    );

    // Wire 3: LED Cathode to Ground
    const gndPart = 1;
    const gndPin = isArduino ? "GND" : "minus";
    wires.push(
      {
        id: nextWireId++,
        view: "schematic",
        points: [[4500, yOffset], [0, yOffset], [0, 1400]],
        from: { part: ledId, pin: "cathode" },
        to: { part: gndPart, pin: gndPin },
      },
      {
        id: nextWireId++,
        view: "breadboard",
        points: [[4200, yOffset], [1140, 100]],
        from: { part: ledId, pin: "cathode" },
        to: { part: gndPart, pin: gndPin },
        color: "#222222",
      },
    );
  }

  const maxId = Math.max(1, switchId, ...parts.map((p) => Number(p.id)), ...wires.map((w) => Number(w.id)));

  const rawDocument: Record<string, unknown> = {
    format: "designElectronics",
    version: 1,
    app: "designElectronics 0.2.1",
    uid: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    title,
    saved: new Date().toISOString(),
    rules: {
      traceWidth: 24,
      clearance: 12,
      viaPad: 40,
      viaDrill: 20,
    },
    nextId: maxId + 10,
    parts,
    wires,
  };

  const document = validateElectronicsDocument(rawDocument);

  // Build CircuitSpec
  const specId = (id: number | string) => "part" + id;
  const specParts = parts.map((p) => {
    const partType = p.type as CircuitSpec["parts"][number]["type"];
    const properties: { key: string; value: string }[] = [];
    if (partType === "resistor") properties.push({ key: "resistance", value: String(intent.resistorOhms) });
    if (partType === "battery") properties.push({ key: "voltage", value: intent.batteryVoltage });
    if (partType === "led") properties.push({ key: "color", value: String((p.props as Record<string, string>)?.color || "Red") });
    if (partType === "switch") properties.push({ key: "position", value: "left" });

    return {
      id: specId(p.id as number),
      type: partType,
      properties,
      sketch: isArduino && partType === "arduino_uno" ? sketch : "",
    };
  });

  const specConnections: CircuitSpec["connections"] = [];
  if (isArduino && hasBattery) {
    specConnections.push(
      { from: { part: specId(batteryId), pin: "plus" }, to: { part: specId(1), pin: "VIN" } },
      { from: { part: specId(batteryId), pin: "minus" }, to: { part: specId(1), pin: "GND_3" } },
    );
  }
  if (!isArduino && intent.hasSwitch && switchId) {
    specConnections.push({
      from: { part: specId(1), pin: "plus" },
      to: { part: specId(switchId), pin: "common" },
    });
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
