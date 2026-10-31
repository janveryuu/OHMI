import { validateElectronicsDocument } from "./electronics-document.ts";

export interface ModificationResult {
  isModification: boolean;
  success: boolean;
  summary: string;
  document?: Record<string, unknown>;
  code?: string;
  details?: {
    addedParts: string[];
    modifiedParts: string[];
    pinsUsed: string[];
  };
}

export function isModificationRequest(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    /\b(?:add|insert|attach|connect|put|change|modify|replace|update|switch|pushbutton|button|another\s+led|more\s+leds?|lagyan|dagdagan)\b/i.test(p) &&
    !/\b(?:from\s+scratch|brand\s+new|start\s+over|create\s+new)\b/i.test(p)
  );
}

export function modifyExistingCircuit(
  rawDoc: Record<string, unknown>,
  prompt: string,
): ModificationResult {
  const p = prompt.toLowerCase();

  // Validate the incoming base document first
  let doc: Record<string, unknown>;
  try {
    doc = structuredClone(validateElectronicsDocument(rawDoc));
  } catch (err) {
    return {
      isModification: false,
      success: false,
      summary: "Current circuit document is invalid or empty.",
    };
  }

  const parts = (doc.parts || []) as Record<string, unknown>[];
  const wires = (doc.wires || []) as Record<string, unknown>[];

  if (!parts.length) {
    return {
      isModification: false,
      success: false,
      summary: "Canvas is currently empty. Build a new circuit first.",
    };
  }

  const unoPart = parts.find((pt) => pt.type === "arduino_uno");
  const batteryPart = parts.find((pt) => pt.type === "battery");

  // Case 1: Add a Pushbutton or Switch
  if (/\b(?:pushbutton|button|switch|slide\s*switch|pindutan)\b/i.test(p)) {
    // Check if switch already exists
    const existingSwitch = parts.find((pt) => pt.type === "switch" || pt.type === "pushbutton");
    if (existingSwitch) {
      return {
        isModification: true,
        success: true,
        summary: "Pushbutton / switch already exists in this circuit.",
        document: doc,
        code: unoPart?.code as string | undefined,
      };
    }

    const existingIds = new Set([
      ...parts.map((pt) => Number(pt.id) || 0),
      ...wires.map((w) => Number(w.id) || 0),
    ]);
    let nextAvailableId = Math.max(0, ...existingIds) + 1;
    const switchId = nextAvailableId++;
    let nextWireId = nextAvailableId;

    if (unoPart) {
      // Find used digital pins
      const usedPins = new Set<string>();
      for (const w of wires) {
        const from = w.from as { part: number; pin: string };
        const to = w.to as { part: number; pin: string };
        if (from?.part === unoPart.id && from.pin?.startsWith("D")) usedPins.add(from.pin);
        if (to?.part === unoPart.id && to.pin?.startsWith("D")) usedPins.add(to.pin);
      }

      // Pick lowest available pin from [2, 3, 4, 5, 6, 7] (or 8-13)
      const candidatePins = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const selectedPinNumber = candidatePins.find((pin) => !usedPins.has(`D${pin}`)) || 2;
      const selectedPin = `D${selectedPinNumber}`;

      // Add switch component
      const newSwitch = {
        id: switchId,
        type: "switch",
        label: "SW1",
        props: { position: "left" },
        views: {
          breadboard: { at: [1800, 1400] },
          schematic: { at: [-400, 800] },
          pcb: { at: [1800, 1400] },
        },
      };
      parts.push(newSwitch);

      // Connect switch common to GND
      wires.push(
        {
          id: nextWireId++,
          view: "schematic",
          points: [[-400, 800], [0, 200]],
          from: { part: switchId, pin: "common" },
          to: { part: unoPart.id, pin: "GND" },
        },
        {
          id: nextWireId++,
          view: "breadboard",
          points: [[1800, 1400], [1140, 100]],
          from: { part: switchId, pin: "common" },
          to: { part: unoPart.id, pin: "GND" },
          color: "#222222",
        },
      );

      // Connect switch 'a' to chosen Arduino digital pin
      wires.push(
        {
          id: nextWireId++,
          view: "schematic",
          points: [[-350, 800], [100, 0]],
          from: { part: switchId, pin: "a" },
          to: { part: unoPart.id, pin: selectedPin },
        },
        {
          id: nextWireId++,
          view: "breadboard",
          points: [[1850, 1400], [800, 100]],
          from: { part: switchId, pin: "a" },
          to: { part: unoPart.id, pin: selectedPin },
          color: "#2563eb",
        },
      );

      // Update the Arduino Sketch with pushbutton INPUT_PULLUP logic
      let currentCode = typeof unoPart.code === "string" ? unoPart.code : "";
      let newCode = "";

      if (currentCode.includes("BUTTON_PIN")) {
        newCode = currentCode;
      } else {
        newCode = `// Arduino Circuit with Pushbutton Control
const int BUTTON_PIN = ${selectedPinNumber};

${currentCode}

// Note: Button is configured with INPUT_PULLUP on pin D${selectedPinNumber}.
// When pressed, digitalRead(BUTTON_PIN) returns LOW.`;

        // Integrate button pin setup into setup()
        if (newCode.includes("void setup() {")) {
          newCode = newCode.replace(
            "void setup() {",
            `void setup() {\n  pinMode(BUTTON_PIN, INPUT_PULLUP);`,
          );
        }
      }

      unoPart.code = newCode;
      doc.nextId = Math.max(switchId + 5, nextWireId + 5);

      const validated = validateElectronicsDocument(doc);
      return {
        isModification: true,
        success: true,
        summary: `Added pushbutton connected to Arduino Pin ${selectedPin} (INPUT_PULLUP) and GND. Updated Arduino sketch.`,
        document: validated,
        code: newCode,
        details: {
          addedParts: ["Slide Switch / Pushbutton (SW1)"],
          modifiedParts: ["Arduino Uno (A1) code updated"],
          pinsUsed: [selectedPin, "GND"],
        },
      };
    } else if (batteryPart) {
      // Battery circuit: insert switch between battery plus and first component
      const newSwitch = {
        id: switchId,
        type: "switch",
        label: "SW1",
        props: { position: "left" },
        views: {
          breadboard: { at: [1400, 0] },
          schematic: { at: [1400, 0] },
          pcb: { at: [1400, 0] },
        },
      };
      parts.push(newSwitch);

      wires.push(
        {
          id: nextWireId++,
          view: "schematic",
          points: [[600, 0], [1400, 0]],
          from: { part: batteryPart.id, pin: "plus" },
          to: { part: switchId, pin: "common" },
        },
        {
          id: nextWireId++,
          view: "breadboard",
          points: [[600, 0], [1400, 0]],
          from: { part: batteryPart.id, pin: "plus" },
          to: { part: switchId, pin: "common" },
          color: "#d94343",
        },
      );

      doc.nextId = Math.max(switchId + 5, nextWireId + 5);
      const validated = validateElectronicsDocument(doc);
      return {
        isModification: true,
        success: true,
        summary: "Added power switch in series with battery supply.",
        document: validated,
        details: {
          addedParts: ["Switch (SW1)"],
          modifiedParts: ["Battery power rail"],
          pinsUsed: ["plus", "common"],
        },
      };
    }
  }

  // Case 2: Change resistor values (e.g. "change resistor to 330", "set 1k ohm")
  const resistorMatch = p.match(/(?:change|set|make)\s+(?:the\s+)?resistors?\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(k|kilo|m|mega)?/i);
  if (resistorMatch) {
    let ohms = parseFloat(resistorMatch[1]);
    const unit = resistorMatch[2]?.toLowerCase();
    if (unit === "k" || unit === "kilo") ohms *= 1000;
    if (unit === "m" || unit === "mega") ohms *= 1000000;

    let modifiedCount = 0;
    for (const pt of parts) {
      if (pt.type === "resistor") {
        if (!pt.props || typeof pt.props !== "object") pt.props = {};
        (pt.props as Record<string, unknown>).resistance = `${ohms}Ω`;
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      const validated = validateElectronicsDocument(doc);
      return {
        isModification: true,
        success: true,
        summary: `Updated ${modifiedCount} resistor(s) to ${ohms} Ω on canvas.`,
        document: validated,
        details: {
          addedParts: [],
          modifiedParts: [`${modifiedCount} Resistors set to ${ohms} Ω`],
          pinsUsed: [],
        },
      };
    }
  }

  return {
    isModification: false,
    success: false,
    summary: "Could not apply modification directly to current circuit. Building new circuit instead.",
  };
}
