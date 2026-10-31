import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCircuitForTinkercad,
  generateComponentsCsv,
  generateWiringGuidePdf,
  createZipArchive,
  buildTinkercadLearningKit,
  mapToTinkercadName,
  mapPinToLabel,
} from "../src/lib/playground/tinkercad-export.ts";
import { getTrafficLightElectronicsDocument } from "../src/lib/playground/traffic-light-template.ts";
import { getDocumentProxy } from "unpdf";

test("mapToTinkercadName maps native parts to student-friendly names", () => {
  assert.equal(mapToTinkercadName("arduino_uno"), "Arduino Uno R3");
  assert.equal(mapToTinkercadName("breadboard_half"), "Breadboard (Small/Standard)");
  assert.equal(mapToTinkercadName("led", { color: "green" }), "Green LED");
  assert.equal(mapToTinkercadName("resistor", { resistance: "330" }), "Resistor (330)");
  assert.equal(mapToTinkercadName("switch"), "Pushbutton");
  assert.equal(mapToTinkercadName("battery_9v"), "9V Battery");
});

test("mapPinToLabel identifies polarities and terminals correctly", () => {
  assert.equal(mapPinToLabel("arduino_uno", "d13"), "Pin D13");
  assert.equal(mapPinToLabel("arduino_uno", "gnd"), "GND (Ground)");
  assert.equal(mapPinToLabel("arduino_uno", "5v"), "5V Power");
  assert.equal(mapPinToLabel("led", "anode"), "Anode (+) [Longer leg]");
  assert.equal(mapPinToLabel("led", "cathode"), "Cathode (-) [Flat edge]");
  assert.equal(mapPinToLabel("resistor", "terminal1"), "Terminal 1");
  assert.equal(mapPinToLabel("switch", "terminal1a"), "Terminal 1a");
});

test("Scenario 1: Arduino Uno LED Blink circuit export generates complete kit", async () => {
  const blinkDoc = {
    format: "designElectronics",
    version: 1,
    title: "Arduino LED Blink Test",
    parts: [
      {
        id: 1,
        type: "arduino_uno",
        label: "Arduino Uno",
        props: {},
        code: "void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }",
        views: { breadboard: { at: [100, 100] } },
      },
      {
        id: 2,
        type: "resistor",
        props: { resistance: "220" },
        views: { breadboard: { at: [250, 100] } },
      },
      {
        id: 3,
        type: "led",
        props: { color: "red" },
        views: { breadboard: { at: [350, 100] } },
      },
    ],
    wires: [
      {
        id: 101,
        view: "breadboard",
        color: "orange",
        from: { part: 1, pin: "d13" },
        to: { part: 2, pin: "terminal1" },
        points: [[150, 100], [250, 100]],
      },
      {
        id: 102,
        view: "breadboard",
        color: "red",
        from: { part: 2, pin: "terminal2" },
        to: { part: 3, pin: "anode" },
        points: [[280, 100], [350, 100]],
      },
      {
        id: 103,
        view: "breadboard",
        color: "black",
        from: { part: 3, pin: "cathode" },
        to: { part: 1, pin: "gnd" },
        points: [[370, 100], [150, 120]],
      },
    ],
  };

  const kit = await buildTinkercadLearningKit(blinkDoc);

  assert.ok(kit.zipBytes instanceof Uint8Array);
  assert.ok(kit.zipBytes.length > 500);
  assert.equal(kit.zipBytes[0], 0x50); // 'P'
  assert.equal(kit.zipBytes[1], 0x4b); // 'K'
  assert.equal(kit.zipBytes[2], 0x03);
  assert.equal(kit.zipBytes[3], 0x04);

  assert.equal(kit.summary.parts.length, 3);
  assert.equal(kit.summary.connections.length, 3);
  assert.equal(kit.summary.hasArduino, true);
  assert.ok(kit.summary.arduinoSketch.includes("pinMode(13, OUTPUT)"));
  assert.equal(kit.summary.isFullyRouted, true);
  assert.equal(kit.summary.warnings.length, 0);

  // Validate PDF with unpdf parser
  const pdfBytes = generateWiringGuidePdf(kit.summary);
  const parsedPdf = await getDocumentProxy(pdfBytes);
  assert.equal(parsedPdf.numPages, 1);

  // Validate CSV
  const csv = generateComponentsCsv(kit.summary);
  assert.ok(csv.includes("Arduino Uno R3"));
  assert.ok(csv.includes("Red LED"));
  assert.ok(csv.includes("Resistor (220)"));

  // Check file previews
  assert.equal(kit.files.length, 5);
  const fileNames = kit.files.map((f) => f.name);
  assert.deepEqual(fileNames, [
    "Wiring_Guide.pdf",
    "Arduino_Sketch.ino",
    "Circuit_Reference.png",
    "Components.csv",
    "Original_Project.dez",
  ]);
});

test("Scenario 2: Traffic Light template export verifies all 3 branches", async () => {
  const trafficLightDoc = getTrafficLightElectronicsDocument();
  const kit = await buildTinkercadLearningKit(trafficLightDoc);

  assert.equal(kit.summary.hasArduino, true);
  assert.ok(kit.summary.arduinoSketch.includes("RED_PIN = 8"));
  assert.ok(kit.summary.arduinoSketch.includes("YELLOW_PIN = 9"));
  assert.ok(kit.summary.arduinoSketch.includes("GREEN_PIN = 10"));

  // Should have Arduino + 3 Resistors + 3 LEDs = 7 parts
  assert.equal(kit.summary.parts.length, 7);

  // All 3 LED branches should be present in connections
  const connDescriptions = kit.summary.connections.map((c) => c.description).join("\n");
  assert.ok(connDescriptions.includes("Pin D8") || connDescriptions.includes("d8"));
  assert.ok(connDescriptions.includes("Pin D9") || connDescriptions.includes("d9"));
  assert.ok(connDescriptions.includes("Pin D10") || connDescriptions.includes("d10"));

  const parsedPdf = await getDocumentProxy(generateWiringGuidePdf(kit.summary));
  assert.equal(parsedPdf.numPages, 1);
});

test("Scenario 3: 74HC595 / IC DIP and battery projects export correctly", async () => {
  const icDoc = {
    format: "designElectronics",
    version: 1,
    title: "74HC595 Shift Register Project",
    parts: [
      {
        id: 1,
        type: "ic_dip",
        label: "74HC595",
        props: { name: "74HC595", pins: "16" },
        views: { breadboard: { at: [100, 100] } },
      },
      {
        id: 2,
        type: "battery_9v",
        props: {},
        views: { breadboard: { at: [300, 100] } },
      },
    ],
    wires: [
      {
        id: 1,
        view: "breadboard",
        color: "red",
        from: { part: 2, pin: "pos" },
        to: { part: 1, pin: "pin16" },
        points: [[300, 100], [100, 100]],
      },
      {
        id: 2,
        view: "breadboard",
        color: "black",
        from: { part: 2, pin: "neg" },
        to: { part: 1, pin: "pin8" },
        points: [[300, 120], [100, 120]],
      },
    ],
  };

  const kit = await buildTinkercadLearningKit(icDoc);
  assert.equal(kit.summary.parts.length, 2);
  assert.equal(kit.summary.hasArduino, false);
  assert.ok(kit.summary.parts.some((p) => p.name.includes("74HC595")));
  assert.ok(kit.summary.parts.some((p) => p.name.includes("9V Battery")));
});

test("Scenario 4: Incomplete / dangling circuit detects unrouted parts honestly", async () => {
  const incompleteDoc = {
    format: "designElectronics",
    version: 1,
    title: "Broken Floating LED Circuit",
    parts: [
      {
        id: 1,
        type: "led",
        props: { color: "blue" },
        views: { breadboard: { at: [100, 100] } },
      },
      {
        id: 2,
        type: "switch",
        props: {},
        views: { breadboard: { at: [200, 100] } },
      },
    ],
    wires: [
      {
        id: 1,
        view: "breadboard",
        color: "blue",
        from: { part: 1, pin: "anode" },
        to: { part: 2, pin: "terminal1a" },
        points: [[100, 100], [200, 100]],
      },
    ],
  };

  const kit = await buildTinkercadLearningKit(incompleteDoc);
  assert.equal(kit.summary.isFullyRouted, false);
  assert.ok(kit.summary.warnings.length > 0);
  assert.ok(
    kit.summary.warnings.some(
      (w) => w.includes("only connected on one terminal") || w.includes("LED"),
    ),
  );
});

test("Scenario 5: ZIP archive format validity and header structure", () => {
  const encoder = new TextEncoder();
  const zip = createZipArchive([
    { name: "file1.txt", data: encoder.encode("Hello World") },
    { name: "sub/file2.txt", data: encoder.encode("Second entry") },
  ]);

  // Check magic number PK\x03\x04
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);

  // Check that Central Directory signature exists in the buffer: PK\x01\x02
  let foundCentral = false;
  for (let i = 0; i < zip.length - 4; i++) {
    if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x01 && zip[i + 3] === 0x02) {
      foundCentral = true;
      break;
    }
  }
  assert.ok(foundCentral, "Central directory header must be present");

  // Check that EOCD signature exists: PK\x05\x06
  let foundEocd = false;
  for (let i = 0; i < zip.length - 4; i++) {
    if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x05 && zip[i + 3] === 0x06) {
      foundEocd = true;
      break;
    }
  }
  assert.ok(foundEocd, "End of Central Directory signature must be present");
});
