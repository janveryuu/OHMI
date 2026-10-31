import test from "node:test";
import assert from "node:assert/strict";
import { validateElectronicsDocument, electronicsPins } from "../src/lib/playground/electronics-document.ts";

test("potentiometer document validation", () => {
  const doc = {
    format: "designElectronics",
    version: 1,
    title: "Arduino Uno with Potentiometer & PWM LED",
    parts: [
      {
        id: 1,
        type: "arduino_uno",
        label: "A1",
        props: { outputs: "", type: "Arduino Uno (Rev3)" },
        views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
        code: "void setup() {} void loop() {}",
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
      { id: 101, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "leg1" } },
      { id: 102, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "A0" }, to: { part: 2, pin: "wiper" } },
      { id: 103, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "GND" }, to: { part: 2, pin: "leg2" } },
      { id: 104, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D9" }, to: { part: 3, pin: "pin0" } },
      { id: 105, view: "schematic", points: [[0,0],[100,100]], from: { part: 3, pin: "pin1" }, to: { part: 4, pin: "anode" } },
      { id: 106, view: "schematic", points: [[0,0],[100,100]], from: { part: 4, pin: "cathode" }, to: { part: 1, pin: "GND_2" } },
    ],
  };

  const validated = validateElectronicsDocument(doc);
  assert.equal(validated.title, doc.title);
  assert.equal(validated.parts.length, 4);
});

test("photocell night light document validation", () => {
  const doc = {
    format: "designElectronics",
    version: 1,
    title: "Arduino Uno Automatic Night Light with Photocell",
    parts: [
      {
        id: 1,
        type: "arduino_uno",
        label: "A1",
        props: { outputs: "", type: "Arduino Uno (Rev3)" },
        views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
        code: "void setup() {} void loop() {}",
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
      { id: 101, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "pin0" } },
      { id: 102, view: "schematic", points: [[0,0],[100,100]], from: { part: 2, pin: "pin1" }, to: { part: 1, pin: "A0" } },
      { id: 103, view: "schematic", points: [[0,0],[100,100]], from: { part: 2, pin: "pin1" }, to: { part: 3, pin: "pin0" } },
      { id: 104, view: "schematic", points: [[0,0],[100,100]], from: { part: 3, pin: "pin1" }, to: { part: 1, pin: "GND" } },
      { id: 105, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D9" }, to: { part: 4, pin: "pin0" } },
      { id: 106, view: "schematic", points: [[0,0],[100,100]], from: { part: 4, pin: "pin1" }, to: { part: 5, pin: "anode" } },
      { id: 107, view: "schematic", points: [[0,0],[100,100]], from: { part: 5, pin: "cathode" }, to: { part: 1, pin: "GND_2" } },
    ],
  };

  const validated = validateElectronicsDocument(doc);
  assert.equal(validated.title, doc.title);
  assert.equal(validated.parts.length, 5);
});

test("security alarm buzzer document validation", () => {
  const doc = {
    format: "designElectronics",
    version: 1,
    title: "Arduino Uno Security Alarm with Buzzer & Pushbutton",
    parts: [
      {
        id: 1,
        type: "arduino_uno",
        label: "A1",
        props: { outputs: "", type: "Arduino Uno (Rev3)" },
        views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
        code: "void setup() {} void loop() {}",
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
      { id: 101, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D2" }, to: { part: 2, pin: "pin1" } },
      { id: 102, view: "schematic", points: [[0,0],[100,100]], from: { part: 2, pin: "pin3" }, to: { part: 1, pin: "GND" } },
      { id: 103, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D8" }, to: { part: 3, pin: "plus" } },
      { id: 104, view: "schematic", points: [[0,0],[100,100]], from: { part: 3, pin: "minus" }, to: { part: 1, pin: "GND_2" } },
      { id: 105, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D9" }, to: { part: 4, pin: "pin0" } },
      { id: 106, view: "schematic", points: [[0,0],[100,100]], from: { part: 4, pin: "pin1" }, to: { part: 5, pin: "anode" } },
      { id: 107, view: "schematic", points: [[0,0],[100,100]], from: { part: 5, pin: "cathode" }, to: { part: 1, pin: "GND_3" } },
    ],
  };

  const validated = validateElectronicsDocument(doc);
  assert.equal(validated.title, doc.title);
  assert.equal(validated.parts.length, 5);
});

test("74hc595 shift register document validation", () => {
  const parts = [
    {
      id: 1,
      type: "arduino_uno",
      label: "A1",
      props: { outputs: "", type: "Arduino Uno (Rev3)" },
      views: { breadboard: { at: [0, 0] }, schematic: { at: [0, 0] }, pcb: { at: [0, 0] } },
      code: "void setup() {} void loop() {}",
    },
    {
      id: 2,
      type: "74hc595",
      label: "U1",
      props: {},
      views: { breadboard: { at: [1800, 400] }, schematic: { at: [1800, 400] }, pcb: { at: [1800, 400] } },
    },
  ];

  const wires = [
    { id: 101, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D11" }, to: { part: 2, pin: "pin14" } },
    { id: 102, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D8" }, to: { part: 2, pin: "pin12" } },
    { id: 103, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "D12" }, to: { part: 2, pin: "pin11" } },
    { id: 104, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "pin16" } },
    { id: 105, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "GND" }, to: { part: 2, pin: "pin8" } },
    { id: 106, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "5V" }, to: { part: 2, pin: "pin10" } },
    { id: 107, view: "schematic", points: [[0,0],[100,100]], from: { part: 1, pin: "GND" }, to: { part: 2, pin: "pin13" } },
  ];

  // 8 output pins of 74HC595: Q0=pin15, Q1=pin1, Q2=pin2, Q3=pin3, Q4=pin4, Q5=pin5, Q6=pin6, Q7=pin7
  const qPins = ["pin15", "pin1", "pin2", "pin3", "pin4", "pin5", "pin6", "pin7"];
  let wireId = 200;
  for (let i = 0; i < 8; i++) {
    const resId = 10 + i * 2;
    const ledId = 11 + i * 2;
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
      { id: wireId++, view: "schematic", points: [[0,0],[100,100]], from: { part: 2, pin: qPins[i] }, to: { part: resId, pin: "pin0" } },
      { id: wireId++, view: "schematic", points: [[0,0],[100,100]], from: { part: resId, pin: "pin1" }, to: { part: ledId, pin: "anode" } },
      { id: wireId++, view: "schematic", points: [[0,0],[100,100]], from: { part: ledId, pin: "cathode" }, to: { part: 1, pin: "GND_2" } }
    );
  }

  const doc = {
    format: "designElectronics",
    version: 1,
    title: "Arduino Uno 8-LED Running Lights with 74HC595 Shift Register",
    parts,
    wires,
  };

  const validated = validateElectronicsDocument(doc);
  assert.equal(validated.title, doc.title);
  assert.equal(validated.parts.length, 18);
});
