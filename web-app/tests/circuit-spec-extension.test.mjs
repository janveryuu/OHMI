import test from "node:test";
import assert from "node:assert/strict";
import { validateCircuitSpec } from "../src/lib/playground/circuit-spec.ts";

test("validateCircuitSpec accepts Arduino Uno powered by 9V battery with sketch", () => {
  const spec = {
    version: 1,
    status: "draft",
    title: "Arduino Uno with 9V Battery",
    explanation: "Arduino Uno powered by an external 9V battery via VIN and GND.",
    warnings: [],
    parts: [
      {
        id: "uno",
        type: "arduino_uno",
        properties: [],
        sketch: "void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }",
      },
      {
        id: "bat",
        type: "battery",
        properties: [{ key: "voltage", value: "9V" }],
        sketch: "",
      },
    ],
    connections: [
      { from: { part: "bat", pin: "plus" }, to: { part: "uno", pin: "VIN" } },
      { from: { part: "bat", pin: "minus" }, to: { part: "uno", pin: "GND" } },
    ],
  };

  const validated = validateCircuitSpec(spec);
  assert.equal(validated.status, "draft");
  assert.equal(validated.parts.length, 2);
});

test("validateCircuitSpec accepts Arduino Uno with 10 LEDs and 10 resistors", () => {
  const parts = [
    {
      id: "uno",
      type: "arduino_uno",
      properties: [],
      sketch: "void setup() { for(int i=2; i<=11; i++) pinMode(i, OUTPUT); } void loop() {}",
    },
  ];

  const connections = [];

  for (let i = 0; i < 10; i++) {
    const resId = `r${i + 1}`;
    const ledId = `led${i + 1}`;
    const pin = `D${2 + i}`;

    parts.push(
      {
        id: resId,
        type: "resistor",
        properties: [{ key: "resistance", value: "220" }],
        sketch: "",
      },
      {
        id: ledId,
        type: "led",
        properties: [{ key: "color", value: "Red" }],
        sketch: "",
      }
    );

    connections.push(
      { from: { part: "uno", pin }, to: { part: resId, pin: "pin0" } },
      { from: { part: resId, pin: "pin1" }, to: { part: ledId, pin: "anode" } },
      { from: { part: ledId, pin: "cathode" }, to: { part: "uno", pin: "GND" } }
    );
  }

  const spec = {
    version: 1,
    status: "draft",
    title: "Arduino Uno with 10 LEDs",
    explanation: "10 LEDs connected to pins D2-D11 with dedicated 220 ohm resistors.",
    warnings: [],
    parts,
    connections,
  };

  const validated = validateCircuitSpec(spec);
  assert.equal(validated.status, "draft");
  assert.equal(validated.parts.length, 21); // 1 Uno + 10 Resistors + 10 LEDs
  assert.equal(validated.connections.length, 30);
});
