/**
 * OHMI — Tinkercad Learning Kit Export Engine
 *
 * Generates a complete, deterministic, offline-capable learning package containing:
 * 1. Arduino_Sketch.ino  - Exact code from the circuit
 * 2. Wiring_Guide.pdf     - Vector PDF wiring checklist with polarities and checkpoints
 * 3. Circuit_Reference.png - Visual schematic/breadboard reference image
 * 4. Components.csv       - Bill of Materials formatted for Tinkercad parts catalog
 * 5. Original_Project.dez - Original OHMI simulator project snapshot
 *
 * Strict ₱0 budget, no paid third-party APIs.
 */

export interface TinkercadPart {
  id: number;
  type: string;
  name: string;
  tinkercadEquivalent: string;
  props: Record<string, string>;
  label: string;
  code?: string;
  connectedWiresCount: number;
}

export interface TinkercadConnection {
  id: number;
  fromPartId: number;
  fromPartName: string;
  fromPin: string;
  fromPinLabel: string;
  toPartId: number;
  toPartName: string;
  toPin: string;
  toPinLabel: string;
  color: string;
  stepNumber: number;
  description: string;
  checkpoint?: string;
}

export interface TinkercadKitSummary {
  title: string;
  date: string;
  parts: TinkercadPart[];
  connections: TinkercadConnection[];
  arduinoSketch: string;
  hasArduino: boolean;
  warnings: string[];
  isFullyRouted: boolean;
  notes: string[];
}

export interface ExportedFilePreview {
  name: string;
  size: number;
  description: string;
  format: string;
}

export interface TinkercadLearningKitBundle {
  zipBytes: Uint8Array;
  filename: string;
  summary: TinkercadKitSummary;
  files: ExportedFilePreview[];
}

// Map native simulator types to Autodesk Tinkercad component equivalents
export function mapToTinkercadName(type: string, props: Record<string, string> = {}): string {
  switch (type.toLowerCase()) {
    case "arduino_uno":
      return "Arduino Uno R3";
    case "breadboard_half":
    case "breadboard_full":
    case "breadboard_mini":
    case "breadboard":
      return "Breadboard (Small/Standard)";
    case "led": {
      const color = props.color ? props.color.charAt(0).toUpperCase() + props.color.slice(1) : "Red";
      return `${color} LED`;
    }
    case "resistor": {
      const val = props.resistance || props.value || "220 Ω";
      return `Resistor (${val})`;
    }
    case "switch":
    case "pushbutton":
      return "Pushbutton";
    case "battery_9v":
      return "9V Battery";
    case "battery_aa":
      return "1.5V AA Battery";
    case "potentiometer":
      return "Potentiometer";
    case "capacitor":
      return "Capacitor";
    case "buzzer":
      return "Piezo Buzzer";
    case "ic_dip":
      return props.name ? `Integrated Circuit (${props.name})` : "DIP IC";
    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

// Map raw pin identifiers to clear student-friendly terminal names
export function mapPinToLabel(partType: string, pin: string): string {
  const p = pin.toLowerCase();
  const t = partType.toLowerCase();

  if (t.includes("arduino")) {
    if (p.startsWith("d")) return `Pin ${p.toUpperCase()}`;
    if (p.startsWith("a")) return `Analog Pin ${p.toUpperCase()}`;
    if (p === "gnd" || p.startsWith("gnd")) return "GND (Ground)";
    if (p === "5v") return "5V Power";
    if (p === "3v3" || p === "3.3v") return "3.3V Power";
    if (p === "vin") return "VIN (Voltage In)";
    if (p === "aref") return "AREF";
    if (p === "reset") return "RESET";
    return `Pin ${pin.toUpperCase()}`;
  }

  if (t === "led") {
    if (p === "anode" || p === "a" || p === "pin1" || p === "1") {
      return "Anode (+) [Longer leg]";
    }
    if (p === "cathode" || p === "c" || p === "k" || p === "pin2" || p === "2") {
      return "Cathode (-) [Flat edge]";
    }
  }

  if (t === "resistor") {
    if (p === "pin1" || p === "1" || p === "terminal1") return "Terminal 1";
    if (p === "pin2" || p === "2" || p === "terminal2") return "Terminal 2";
  }

  if (t === "switch" || t === "pushbutton") {
    if (p === "pin1" || p === "1" || p === "terminal1a") return "Terminal 1a";
    if (p === "pin2" || p === "2" || p === "terminal1b") return "Terminal 1b";
    if (p === "pin3" || p === "3" || p === "terminal2a") return "Terminal 2a";
    if (p === "pin4" || p === "4" || p === "terminal2b") return "Terminal 2b";
  }

  if (t.startsWith("battery")) {
    if (p === "pos" || p === "positive" || p === "+" || p === "pin1") return "Positive (+) Terminal";
    if (p === "neg" || p === "negative" || p === "-" || p === "pin2") return "Negative (-) Ground";
  }

  if (t.startsWith("breadboard")) {
    if (p.startsWith("tp")) return `Top Positive Rail (+) [Col ${p.replace("tp", "")}]`;
    if (p.startsWith("tn")) return `Top Negative Rail (-) [Col ${p.replace("tn", "")}]`;
    if (p.startsWith("bp")) return `Bottom Positive Rail (+) [Col ${p.replace("bp", "")}]`;
    if (p.startsWith("bn")) return `Bottom Negative Rail (-) [Col ${p.replace("bn", "")}]`;
    return `Tie Point ${p.toUpperCase()}`;
  }

  return pin.toUpperCase();
}

/**
 * Parses raw .dez JSON into a structured, validated Tinkercad Learning Kit model.
 */
export function parseCircuitForTinkercad(document: Record<string, unknown>): TinkercadKitSummary {
  const title = typeof document.title === "string" ? document.title : "OHMI Electronics Project";
  const rawParts = Array.isArray(document.parts) ? (document.parts as Record<string, unknown>[]) : [];
  const rawWires = Array.isArray(document.wires) ? (document.wires as Record<string, unknown>[]) : [];

  const partsMap = new Map<number, TinkercadPart>();
  let primaryArduinoSketch = "";

  for (const raw of rawParts) {
    const id = Number(raw.id);
    const type = String(raw.type || "unknown");
    const label = String(raw.label || "");
    const props = (raw.props && typeof raw.props === "object" ? (raw.props as Record<string, string>) : {}) || {};
    const code = typeof raw.code === "string" ? raw.code : undefined;

    if (type.startsWith("arduino_") && code && !primaryArduinoSketch) {
      primaryArduinoSketch = code;
    }

    const name = label || mapToTinkercadName(type, props);
    partsMap.set(id, {
      id,
      type,
      name,
      tinkercadEquivalent: mapToTinkercadName(type, props),
      props,
      label,
      code,
      connectedWiresCount: 0,
    });
  }

  // Filter breadboard view wires first; fallback to all wires if no breadboard view
  const breadboardWires = rawWires.filter((w) => w.view === "breadboard");
  const wiresToProcess = breadboardWires.length > 0 ? breadboardWires : rawWires;

  const connections: TinkercadConnection[] = [];
  const warnings: string[] = [];
  let stepCounter = 1;

  for (const w of wiresToProcess) {
    const id = Number(w.id || 0);
    const from = w.from as { part: number; pin: string } | undefined;
    const to = w.to as { part: number; pin: string } | undefined;
    const color = String(w.color || "green");

    if (from && to && partsMap.has(Number(from.part)) && partsMap.has(Number(to.part))) {
      const fromPart = partsMap.get(Number(from.part))!;
      const toPart = partsMap.get(Number(to.part))!;

      fromPart.connectedWiresCount++;
      toPart.connectedWiresCount++;

      const fromPinLabel = mapPinToLabel(fromPart.type, String(from.pin));
      const toPinLabel = mapPinToLabel(toPart.type, String(to.pin));

      let checkpoint = "";
      if (fromPart.type === "led" || toPart.type === "led") {
        checkpoint = "Check LED polarity: Anode is long leg, Cathode is flat edge.";
      } else if (fromPinLabel.includes("GND") || toPinLabel.includes("GND")) {
        checkpoint = "Verify ground return path is firmly connected.";
      } else if (fromPinLabel.includes("5V") || toPinLabel.includes("5V")) {
        checkpoint = "Power rail connection: Never connect 5V directly to GND!";
      }

      const description = `Connect ${fromPart.name} [${fromPinLabel}] to ${toPart.name} [${toPinLabel}].`;

      connections.push({
        id,
        fromPartId: fromPart.id,
        fromPartName: fromPart.name,
        fromPin: String(from.pin),
        fromPinLabel,
        toPartId: toPart.id,
        toPartName: toPart.name,
        toPin: String(to.pin),
        toPinLabel,
        color,
        stepNumber: stepCounter++,
        description,
        checkpoint,
      });
    }
  }

  const parts = Array.from(partsMap.values());

  // Electrical sanity checks & unrouted pin detection
  for (const part of parts) {
    if (part.type === "breadboard" || part.type.startsWith("breadboard_")) continue;
    if (part.connectedWiresCount === 0) {
      warnings.push(`Part #${part.id} (${part.name}) has no wire connections placed.`);
    } else if (part.type === "led" && part.connectedWiresCount < 2) {
      warnings.push(`LED #${part.id} (${part.name}) is only connected on one terminal; requires both Anode and Cathode.`);
    } else if (part.type === "resistor" && part.connectedWiresCount < 2) {
      warnings.push(`Resistor #${part.id} (${part.name}) has a floating lead.`);
    }
  }

  const hasArduino = parts.some((p) => p.type.startsWith("arduino_"));
  if (hasArduino) {
    const arduino = parts.find((p) => p.type.startsWith("arduino_"))!;
    if (arduino.connectedWiresCount === 0) {
      warnings.push("Arduino board is on canvas but has no wires connected to its pins.");
    }
  }

  const notes: string[] = [
    "Independent educational companion for Autodesk Tinkercad Circuits.",
    "Tinkercad does not support direct .dez file import; use this guide to recreate and simulate your circuit manually.",
    "Always check resistor values to prevent excessive current through LEDs.",
  ];

  return {
    title,
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    parts,
    connections,
    arduinoSketch: primaryArduinoSketch || getDefaultArduinoSketch(hasArduino),
    hasArduino,
    warnings,
    isFullyRouted: warnings.length === 0 && connections.length > 0,
    notes,
  };
}

function getDefaultArduinoSketch(hasArduino: boolean): string {
  if (hasArduino) {
    return `// OHMI Arduino Sketch Template
void setup() {
  // Initialize digital pin outputs or inputs here
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  // Main circuit loop
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`;
  }
  return `// Pure battery/DC circuit. No microcontroller code required.
// Recreate the physical wiring in Tinkercad Circuits and click 'Start Simulation'.
`;
}

/**
 * Generates Components.csv (Bill of Materials) formatted for Tinkercad parts bin search.
 */
export function generateComponentsCsv(summary: TinkercadKitSummary): string {
  const rows: string[] = [];
  rows.push('"Item","Part ID","Tinkercad Component","Label","Key Properties","Connected Pins"');

  let itemNum = 1;
  for (const part of summary.parts) {
    const propsStr = Object.entries(part.props)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ") || "Default";

    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    rows.push([
      itemNum++,
      part.id,
      escape(part.tinkercadEquivalent),
      escape(part.label || part.name),
      escape(propsStr),
      part.connectedWiresCount,
    ].join(","));
  }

  return rows.join("\n") + "\n";
}

/**
 * Generates Wiring_Guide.pdf in pure standard PDF 1.4 syntax.
 * Includes Helvetica fonts, teal header band, BOM table, step-by-step connections, checkpoints, and warnings.
 */
export function generateWiringGuidePdf(summary: TinkercadKitSummary): Uint8Array {
  const sanitize = (text: string) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, " ");

  const lines: string[] = [];
  lines.push("q");

  // Teal Header Bar (Color: #0f766e -> 0.06 0.46 0.43)
  lines.push("0.06 0.46 0.43 rg");
  lines.push("36 720 540 48 re f");

  // Header Title
  lines.push("BT");
  lines.push("/F2 15 Tf");
  lines.push("1 1 1 rg");
  lines.push("48 742 Td");
  lines.push(`(${sanitize("OHMI - Tinkercad Learning Kit: Wiring Guide")}) Tj`);
  lines.push("ET");

  // Subtitle
  lines.push("BT");
  lines.push("/F1 8.5 Tf");
  lines.push("0.9 0.95 0.95 rg");
  lines.push("48 730 Td");
  lines.push(`(${sanitize(`Project: ${summary.title}  |  Exported: ${summary.date}  |  Components: ${summary.parts.length}  |  Wires: ${summary.connections.length}`)}) Tj`);
  lines.push("ET");

  let y = 698;

  // Warning Banner if any unrouted items exist
  if (summary.warnings.length > 0) {
    lines.push("0.98 0.92 0.85 rg");
    lines.push(`36 ${y - 28} 540 24 re f`);
    lines.push("0.7 0.35 0.05 rg");
    lines.push(`36 ${y - 28} 540 24 re S`);

    lines.push("BT");
    lines.push("/F2 8.5 Tf");
    lines.push("0.6 0.25 0.02 rg");
    lines.push(`46 ${y - 18} Td`);
    lines.push(`(${sanitize(`[!] WIRING NOTICE: ${summary.warnings[0]}`)}) Tj`);
    lines.push("ET");
    y -= 38;
  }

  // Section 1: Bill of Materials
  lines.push("BT");
  lines.push("/F2 11 Tf");
  lines.push("0.1 0.15 0.2 rg");
  lines.push(`36 ${y} Td`);
  lines.push(`(${sanitize("1. Bill of Materials (Tinkercad Components)")}) Tj`);
  lines.push("ET");
  y -= 14;

  // Table Header
  lines.push("0.94 0.96 0.96 rg");
  lines.push(`36 ${y - 12} 540 14 re f`);
  lines.push("BT");
  lines.push("/F2 8 Tf");
  lines.push("0.2 0.25 0.3 rg");
  lines.push(`42 ${y - 8} Td`);
  lines.push(`(${sanitize("ID    Component in Tinkercad             Properties / Value           Label / Ref")}) Tj`);
  lines.push("ET");
  y -= 18;

  // Table Rows (Show first 8 parts cleanly on page 1)
  const displayParts = summary.parts.slice(0, 9);
  for (const part of displayParts) {
    const propsStr = Object.entries(part.props)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ") || "-";

    const idCol = String(part.id).padEnd(5, " ");
    const nameCol = part.tinkercadEquivalent.slice(0, 32).padEnd(34, " ");
    const propCol = propsStr.slice(0, 26).padEnd(28, " ");
    const labelCol = (part.label || part.name).slice(0, 20);

    lines.push("BT");
    lines.push("/F1 8 Tf");
    lines.push("0.15 0.15 0.15 rg");
    lines.push(`42 ${y} Td`);
    lines.push(`(${sanitize(`${idCol} ${nameCol} ${propCol} ${labelCol}`)}) Tj`);
    lines.push("ET");
    y -= 12;
  }

  if (summary.parts.length > 9) {
    lines.push("BT");
    lines.push("/F1 7.5 Tf");
    lines.push("0.4 0.4 0.4 rg");
    lines.push(`42 ${y} Td`);
    lines.push(`(${sanitize(`... and ${summary.parts.length - 9} more parts (see Components.csv for complete list)`)}) Tj`);
    lines.push("ET");
    y -= 14;
  }

  y -= 8;

  // Section 2: Step-by-Step Physical Connections
  lines.push("BT");
  lines.push("/F2 11 Tf");
  lines.push("0.1 0.15 0.2 rg");
  lines.push(`36 ${y} Td`);
  lines.push(`(${sanitize("2. Step-by-Step Wiring Sequence")}) Tj`);
  lines.push("ET");
  y -= 14;

  const displayConnections = summary.connections.slice(0, 14);
  if (displayConnections.length === 0) {
    lines.push("BT");
    lines.push("/F1 8.5 Tf");
    lines.push("0.4 0.4 0.4 rg");
    lines.push(`42 ${y} Td`);
    lines.push(`(${sanitize("No wire connections found in project. Add wires in Playground to generate steps.")}) Tj`);
    lines.push("ET");
    y -= 14;
  } else {
    for (const conn of displayConnections) {
      const stepText = `[ ] Step ${conn.stepNumber}: ${conn.fromPartName} (${conn.fromPinLabel}) -> ${conn.toPartName} (${conn.toPinLabel}) [${conn.color}]`;

      lines.push("BT");
      lines.push("/F2 8 Tf");
      lines.push("0.1 0.1 0.1 rg");
      lines.push(`42 ${y} Td`);
      lines.push(`(${sanitize(stepText.slice(0, 100))}) Tj`);
      lines.push("ET");
      y -= 10;

      if (conn.checkpoint) {
        lines.push("BT");
        lines.push("/F1 7.5 Tf");
        lines.push("0.06 0.46 0.43 rg");
        lines.push(`60 ${y} Td`);
        lines.push(`(${sanitize(`Checkpoint: ${conn.checkpoint}`)}) Tj`);
        lines.push("ET");
        y -= 10;
      }
    }

    if (summary.connections.length > 14) {
      lines.push("BT");
      lines.push("/F1 7.5 Tf");
      lines.push("0.4 0.4 0.4 rg");
      lines.push(`42 ${y} Td`);
      lines.push(`(${sanitize(`... and ${summary.connections.length - 14} additional connections (see Original_Project.dez)`)}) Tj`);
      lines.push("ET");
      y -= 12;
    }
  }

  y -= 8;

  // Section 3: Polarities & Important Rules
  lines.push("BT");
  lines.push("/F2 11 Tf");
  lines.push("0.1 0.15 0.2 rg");
  lines.push(`36 ${y} Td`);
  lines.push(`(${sanitize("3. Critical Polarity & Safety Checks")}) Tj`);
  lines.push("ET");
  y -= 13;

  const tips = [
    "LED Polarity: Long leg is Anode (+); connect to positive or digital pin. Flat rim is Cathode (-); connect to ground.",
    "Current Limiting: Always wire a 220-330 ohm resistor in series with each LED to prevent burning out parts.",
    "Arduino Power: Connect USB or 9V battery only after verifying all GND and 5V power rails have no shorts.",
    "Pushbuttons: Use terminals diagonally or across the center divider to ensure proper open/close switching.",
  ];

  for (const tip of tips) {
    lines.push("BT");
    lines.push("/F1 7.5 Tf");
    lines.push("0.2 0.2 0.2 rg");
    lines.push(`42 ${y} Td`);
    lines.push(`(${sanitize(`* ${tip}`)}) Tj`);
    lines.push("ET");
    y -= 10;
  }

  // Footer Disclaimer
  lines.push("0.7 0.7 0.7 rg");
  lines.push("36 32 540 0.5 re f");

  lines.push("BT");
  lines.push("/F1 7 Tf");
  lines.push("0.45 0.45 0.45 rg");
  lines.push("36 22 Td");
  lines.push(`(${sanitize("OHMI Learning Companion - Independent educational project for Autodesk Tinkercad Circuits. Not affiliated with Autodesk.")}) Tj`);
  lines.push("ET");

  lines.push("Q");

  const streamContent = lines.join("\n");
  const streamLength = new TextEncoder().encode(streamContent).length;

  const obj1 = "<< /Type /Catalog /Pages 2 0 R >>";
  const obj2 = "<< /Type /Pages /Kids [5 0 R] /Count 1 >>";
  const obj3 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const obj4 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  const obj5 = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`;
  const obj6 = `<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`;

  const allObjs = [obj1, obj2, obj3, obj4, obj5, obj6];

  let pdfText = "%PDF-1.4\n";
  const offsets: number[] = [];

  const encoder = new TextEncoder();

  for (let idx = 0; idx < allObjs.length; idx++) {
    offsets.push(encoder.encode(pdfText).length);
    pdfText += `${idx + 1} 0 obj\n${allObjs[idx]}\nendobj\n`;
  }

  const startXref = encoder.encode(pdfText).length;
  pdfText += "xref\n";
  pdfText += `0 ${allObjs.length + 1}\n`;
  pdfText += "0000000000 65535 f \n";
  for (const off of offsets) {
    pdfText += String(off).padStart(10, "0") + " 00000 n \n";
  }
  pdfText += "trailer\n";
  pdfText += `<< /Size ${allObjs.length + 1} /Root 1 0 R >>\n`;
  pdfText += "startxref\n";
  pdfText += `${startXref}\n`;
  pdfText += "%%EOF\n";

  return encoder.encode(pdfText);
}

/**
 * Pure TypeScript ZIP Archive Builder
 * Constructs a fully standard, uncompressed (STORE) ZIP container with CRC-32 checksums.
 */
export function createZipArchive(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function crc32(buf: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  const textEncoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const data = file.data;
    const fileCrc = crc32(data);
    const size = data.length;

    // Local Header (30 bytes + filename + data)
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true);         // Version needed: 2.0
    lv.setUint16(6, 0x0800, true);     // General purpose bit flag: UTF-8 filename
    lv.setUint16(8, 0, true);          // Compression: 0 (Store)
    lv.setUint16(10, 0, true);         // Mod time
    lv.setUint16(12, 0, true);         // Mod date
    lv.setUint32(14, fileCrc, true);   // CRC-32
    lv.setUint32(18, size, true);      // Compressed size
    lv.setUint32(22, size, true);      // Uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // Extra field length
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localHeaders.push(local);

    // Central Directory Header (46 bytes + filename)
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true);         // Version made by: 2.0
    cv.setUint16(6, 20, true);         // Version needed: 2.0
    cv.setUint16(8, 0x0800, true);     // General purpose: UTF-8
    cv.setUint16(10, 0, true);         // Compression: 0
    cv.setUint16(12, 0, true);         // Mod time
    cv.setUint16(14, 0, true);         // Mod date
    cv.setUint32(16, fileCrc, true);   // CRC-32
    cv.setUint32(20, size, true);      // Compressed size
    cv.setUint32(24, size, true);      // Uncompressed size
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);         // Extra field length
    cv.setUint16(32, 0, true);         // Comment length
    cv.setUint16(34, 0, true);         // Disk number start
    cv.setUint16(36, 0, true);         // Internal file attributes
    cv.setUint32(38, 0, true);         // External file attributes
    cv.setUint32(42, offset, true);    // Relative offset of local header
    central.set(nameBytes, 46);
    centralHeaders.push(central);

    offset += local.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const c of centralHeaders) centralSize += c.length;

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);      // EOCD signature
  ev.setUint16(4, 0, true);               // Disk number
  ev.setUint16(6, 0, true);               // Disk with start of central directory
  ev.setUint16(8, files.length, true);    // Total entries on this disk
  ev.setUint16(10, files.length, true);   // Total entries
  ev.setUint32(12, centralSize, true);    // Size of central directory
  ev.setUint32(16, centralOffset, true);  // Offset of central directory
  ev.setUint16(20, 0, true);              // ZIP comment length

  const totalLength = centralOffset + centralSize + eocd.length;
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const l of localHeaders) {
    out.set(l, pos);
    pos += l.length;
  }
  for (const c of centralHeaders) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(eocd, pos);
  return out;
}

/**
 * Creates a clean circuit reference image from SVG data or fallback raster.
 */
export async function createCircuitPngBytes(svgData?: string): Promise<Uint8Array> {
  // If running in browser and SVG is available, render via Canvas
  if (typeof window !== "undefined" && typeof document !== "undefined" && svgData) {
    try {
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });

      if (loaded) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(800, img.width || 800);
        canvas.height = Math.max(600, img.height || 600);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);

          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          if (blob) {
            const buf = await blob.arrayBuffer();
            return new Uint8Array(buf);
          }
        }
      }
      URL.revokeObjectURL(url);
    } catch {
      // Fallback below
    }
  }

  // Fallback: minimal valid 1x1 PNG or valid placeholder image bytes
  // Standard 1x1 white PNG bytes
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
}

/**
 * Builds the complete Tinkercad Learning Kit ZIP bundle from a .dez snapshot.
 */
export async function buildTinkercadLearningKit(
  snapshot: Record<string, unknown>,
  svgData?: string,
): Promise<{
  zipBytes: Uint8Array;
  filename: string;
  summary: TinkercadKitSummary;
  files: ExportedFilePreview[];
}> {
  const summary = parseCircuitForTinkercad(snapshot);
  const encoder = new TextEncoder();

  // 1. Arduino_Sketch.ino
  const sketchBytes = encoder.encode(summary.arduinoSketch);

  // 2. Wiring_Guide.pdf
  const pdfBytes = generateWiringGuidePdf(summary);

  // 3. Components.csv
  const csvText = generateComponentsCsv(summary);
  const csvBytes = encoder.encode(csvText);

  // 4. Circuit_Reference.png
  const pngBytes = await createCircuitPngBytes(svgData);

  // 5. Original_Project.dez
  const dezText = JSON.stringify(snapshot, null, 2);
  const dezBytes = encoder.encode(dezText);

  const filesInZip = [
    { name: "Arduino_Sketch.ino", data: sketchBytes },
    { name: "Wiring_Guide.pdf", data: pdfBytes },
    { name: "Circuit_Reference.png", data: pngBytes },
    { name: "Components.csv", data: csvBytes },
    { name: "Original_Project.dez", data: dezBytes },
  ];

  const zipBytes = createZipArchive(filesInZip);

  const cleanTitle = (summary.title || "Circuit").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `OHMI-Tinkercad-Learning-Kit-${cleanTitle}.zip`;

  const files: ExportedFilePreview[] = [
    {
      name: "Wiring_Guide.pdf",
      size: pdfBytes.length,
      description: "Printable wiring checklist, pinouts, polarity notes & verification checkpoints",
      format: "PDF Document",
    },
    {
      name: "Arduino_Sketch.ino",
      size: sketchBytes.length,
      description: summary.hasArduino
        ? "C++ sketch ready to paste into Tinkercad Code editor"
        : "Reference sketch notes for passive DC circuit",
      format: "Arduino Sketch",
    },
    {
      name: "Circuit_Reference.png",
      size: pngBytes.length,
      description: "Visual layout diagram of the breadboard connections",
      format: "PNG Image",
    },
    {
      name: "Components.csv",
      size: csvBytes.length,
      description: `${summary.parts.length} components with values and Tinkercad parts catalog names`,
      format: "Spreadsheet / CSV",
    },
    {
      name: "Original_Project.dez",
      size: dezBytes.length,
      description: "Complete native circuit file to reopen or edit in OHMI anytime",
      format: "OHMI Project",
    },
  ];

  return {
    zipBytes,
    filename,
    summary,
    files,
  };
}
