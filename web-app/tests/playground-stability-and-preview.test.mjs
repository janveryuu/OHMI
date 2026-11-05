import test from "node:test";
import assert from "node:assert/strict";
import {
  isPreviewNote,
  prepareCircuit,
} from "../src/lib/playground/build-verification.ts";
import { getTrafficLightElectronicsDocument } from "../src/lib/playground/traffic-light-template.ts";
import { parseCircuitIntent, generateCircuit } from "../src/lib/playground/circuit-generator.ts";

test("isPreviewNote accurately filters non-fatal preview notices from genuine errors", () => {
  // Informational preview notices that must NOT fail builds
  assert.equal(isPreviewNote("LiquidCrystal_I2C (line 12) isn't simulated in this preview."), true);
  assert.equal(isPreviewNote("Wire (line 15) isn't simulated in this preview."), true);
  assert.equal(isPreviewNote("tone (line 22) isn't simulated in this preview."), true);
  assert.equal(isPreviewNote("Not simulated (pinout only): buzzer"), true);
  assert.equal(isPreviewNote("Not simulated (pinout only): lcd16x2"), true);
  assert.equal(isPreviewNote("Not simulated (pinout only): ultrasonic"), true);
  assert.equal(isPreviewNote("Not simulated (pinout only): pir"), true);
  assert.equal(isPreviewNote("Low current reduces brightness (1.2 mA)"), true);
  assert.equal(isPreviewNote("Backlight is simulated without active load"), true);

  // Critical electrical and safety warnings that MUST trigger checks failure
  assert.equal(isPreviewNote("Short circuit detected between pin 8 and GND"), false);
  assert.equal(isPreviewNote("LED maximum forward current exceeded (45 mA > 20 mA)"), false);
  assert.equal(isPreviewNote("Floating input pin 2 causes undefined logic level"), false);
  assert.equal(isPreviewNote("Arduino pin 13 source current exceeds 40 mA limit"), false);
  assert.equal(isPreviewNote("Power rail reverse polarity detected"), false);
});

test("prepareCircuit succeeds with preview notes without throwing error", async () => {
  const dummyDoc = getTrafficLightElectronicsDocument();
  const samplesWithNotes = Array.from({ length: 80 }, (_, i) => ({
    time: i * 0.05,
    leds: { "3": 1 },
    errors: [],
    warnings: i === 0 ? ["LiquidCrystal_I2C (line 4) isn't simulated in this preview."] : [],
    damaged: [],
  }));

  const mockBridge = {
    async request(req) {
      assert.equal(req.operation, "prepare");
      return {
        document: dummyDoc,
        observations: { samples: samplesWithNotes },
        mounted: 4,
      };
    },
  };

  const result = await prepareCircuit(mockBridge, dummyDoc);
  assert.ok(result.document);
  assert.equal(result.samples.length, 80);
  assert.equal(result.notes.length, 1);
  assert.match(result.notes[0], /isn't simulated in this preview/);
});

test("prepareCircuit rejects genuine electrical damage with formatted diagnostics", async () => {
  const dummyDoc = getTrafficLightElectronicsDocument();
  const samplesWithDamage = Array.from({ length: 80 }, (_, i) => ({
    time: i * 0.05,
    leds: { "3": 1 },
    errors: [],
    warnings: [],
    damaged: i === 10 ? ["LED 1 (destroyed by excessive forward current)"] : [],
  }));

  const mockBridge = {
    async request(req) {
      assert.equal(req.operation, "prepare");
      return {
        document: dummyDoc,
        observations: { samples: samplesWithDamage },
        mounted: 4,
      };
    },
  };

  await assert.rejects(
    prepareCircuit(mockBridge, dummyDoc),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /^Native circuit checks failed\./);
      assert.match(err.message, /Damaged part/);
      return true;
    },
  );
});

test("prepareCircuit rejects compiler and runtime code errors with line number", async () => {
  const dummyDoc = getTrafficLightElectronicsDocument();
  const samplesWithError = Array.from({ length: 80 }, (_, i) => ({
    time: i * 0.05,
    leds: { "3": 1 },
    errors: i === 5 ? [{ message: "expected ';' before '}' token", line: 18 }] : [],
    warnings: [],
    damaged: [],
  }));

  const mockBridge = {
    async request(req) {
      assert.equal(req.operation, "prepare");
      return {
        document: dummyDoc,
        observations: { samples: samplesWithError },
        mounted: 4,
      };
    },
  };

  await assert.rejects(
    prepareCircuit(mockBridge, dummyDoc),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /^Native circuit checks failed\./);
      assert.match(err.message, /line 18/i);
      return true;
    },
  );
});

test("prepareCircuit automatically falls back to layout=false when auto-layout fails", async () => {
  const dummyDoc = getTrafficLightElectronicsDocument();
  const samples = Array.from({ length: 80 }, (_, i) => ({
    time: i * 0.05,
    leds: { "3": 1 },
    errors: [],
    warnings: [],
    damaged: [],
  }));

  let attempts = 0;
  const mockBridge = {
    async request(req) {
      attempts++;
      if (req.layout === true) {
        throw new Error("Dense breadboard pack limit reached");
      }
      return {
        document: dummyDoc,
        observations: { samples },
        mounted: 4,
      };
    },
  };

  const result = await prepareCircuit(mockBridge, dummyDoc, true);
  assert.equal(attempts, 2);
  assert.ok(result.document);
  assert.equal(result.samples.length, 80);
});

test("Ask OHMI generated circuit for complex challenge produces valid document", () => {
  const prompt = "Build an Arduino Uno smart emergency security alarm system using a breadboard, PIR motion sensor, pushbuttons, red and green LEDs, current-limiting resistors, buzzer, and 16x2 LCD.";
  const intent = parseCircuitIntent(prompt);
  const circuit = generateCircuit(intent);

  assert.ok(circuit.document);
  assert.ok(Array.isArray(circuit.document.parts));
  assert.ok(circuit.document.parts.length >= 7);
  assert.ok(circuit.arduinoCode.includes("setup"));
  assert.ok(circuit.arduinoCode.includes("loop"));
});
