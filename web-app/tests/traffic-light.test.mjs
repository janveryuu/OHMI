import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTrafficLightProject,
  validateProject,
  isTrafficLightMatch,
  newPart,
} from "../src/lib/playground/model.ts";
import { evaluate } from "../src/lib/playground/engine.ts";

test("buildTrafficLightProject returns a valid project with Arduino Uno and 3 LED branches", () => {
  const p = buildTrafficLightProject();
  const validated = validateProject(p);
  assert.equal(validated.name, "Arduino Traffic Light (3 LEDs)");
  assert.equal(validated.parts.length, 7);

  const arduino = validated.parts.find((c) => c.kind === "arduino");
  assert.ok(arduino, "Arduino Uno part must exist");
  assert.equal(arduino.value, 5);

  const resistors = validated.parts.filter((c) => c.kind === "resistor");
  assert.equal(resistors.length, 3);
  for (const r of resistors) {
    assert.equal(r.value, 220);
    assert.ok(r.label?.includes("220 Ω"));
  }

  const leds = validated.parts.filter((c) => c.kind === "led");
  assert.equal(leds.length, 3);
  const colors = leds.map((l) => l.color).sort();
  assert.deepEqual(colors, ["green", "red", "yellow"]);

  assert.equal(validated.wires.length, 9);
});

test("evaluate(buildTrafficLightProject()) lights up all 3 LEDs safely at ~13.6 mA", () => {
  const p = buildTrafficLightProject();
  const res = evaluate(p);
  assert.equal(res.status, "lit");
  assert.ok(res.currentMa && Math.abs(res.currentMa - 13.636) < 0.1);
  assert.ok(res.resistorWatts && res.resistorWatts < 0.1);
  assert.match(res.message, /Arduino Traffic Light active! All 3 LEDs are protected/i);
});

test("traffic light evaluation catches missing current-limiting resistor", () => {
  const p = buildTrafficLightProject();
  // Bypass resistor-red: connect 5V directly to led-red anode
  p.wires = p.wires.filter(
    (w) => w.id !== "wire-5v-red" && w.id !== "wire-red-res-led",
  );
  p.wires.push({
    id: "wire-direct-red",
    from: { part: "arduino-uno", pin: "p" },
    to: { part: "led-red", pin: "a" },
  });
  // Remove resistor-red from parts so it doesn't fail on unused parts check
  p.parts = p.parts.filter((c) => c.id !== "resistor-red");

  const res = evaluate(p);
  assert.equal(res.status, "unsafe");
  assert.match(res.message, /Missing current-limiting resistor/i);
});

test("traffic light evaluation catches reversed LED polarity", () => {
  const p = buildTrafficLightProject();
  const wireToAnode = p.wires.find((w) => w.id === "wire-red-res-led");
  const wireToCathode = p.wires.find((w) => w.id === "wire-red-gnd");
  assert.ok(wireToAnode && wireToCathode);
  wireToAnode.to.pin = "k";
  wireToCathode.from.pin = "a";

  const res = evaluate(p);
  assert.equal(res.status, "unsafe");
  assert.match(res.message, /Incorrect LED polarity/i);
});

test("traffic light evaluation reports open circuit if an LED cathode is not grounded", () => {
  const p = buildTrafficLightProject();
  // Disconnect green LED cathode wire
  p.wires = p.wires.filter((w) => w.id !== "wire-green-gnd");

  const res = evaluate(p);
  assert.equal(res.status, "incomplete");
  assert.match(res.message, /Connect the cathode/i);
});

test("traffic light evaluation flags dangerous short circuit across 5V and GND", () => {
  const p = buildTrafficLightProject();
  p.wires.push({
    id: "wire-short",
    from: { part: "arduino-uno", pin: "p" },
    to: { part: "arduino-uno", pin: "n" },
  });

  const res = evaluate(p);
  assert.equal(res.status, "unsafe");
  assert.match(res.message, /Short circuit across the supply/i);
});

test("traffic light evaluation catches excessive branch current if resistor is too low", () => {
  const p = buildTrafficLightProject();
  const redRes = p.parts.find((c) => c.id === "resistor-red");
  assert.ok(redRes);
  redRes.value = 10; // (5 - 2) / 10 = 300 mA > 20 mA

  const res = evaluate(p);
  assert.equal(res.status, "unsafe");
  assert.match(res.message, /exceeds 20 mA/i);
});

test("traffic light evaluation reports incomplete if unrouted spare parts exist", () => {
  const p = buildTrafficLightProject();
  p.parts.push(newPart("switch", "spare-switch", 100, 100));

  const res = evaluate(p);
  assert.equal(res.status, "incomplete");
  assert.match(res.message, /Some components are outside the power path/i);
});

test("isTrafficLightMatch correctly identifies traffic light building queries", () => {
  assert.equal(
    isTrafficLightMatch("I can help you build an Arduino traffic light with three LEDs.", "Build an Arduino traffic light with three LEDs"),
    true,
  );
  assert.equal(
    isTrafficLightMatch("Sure, here is how you build a traffic-light circuit.", "can you show me a traffic-light?"),
    true,
  );
  assert.equal(
    isTrafficLightMatch("Let's connect 3 LEDs to the Arduino Uno.", "Arduino with 3 leds"),
    true,
  );
  assert.equal(
    isTrafficLightMatch("We will set up an Arduino with three LEDs.", "three leds on arduino"),
    true,
  );

  // Negative matches
  assert.equal(
    isTrafficLightMatch("Ohm's law relates voltage, current and resistance: V = I * R.", "What is Ohm's law?"),
    false,
  );
  assert.equal(
    isTrafficLightMatch("Here is how to wire an ultrasonic sensor to Arduino.", "How to use HC-SR04 with Arduino?"),
    false,
  );
  assert.equal(
    isTrafficLightMatch("Connect the potentiometer signal pin to A0.", "Potentiometer reading"),
    false,
  );
  assert.equal(
    isTrafficLightMatch("Traffic lights use red for stop because red has the longest wavelength.", "Why is a traffic light red, yellow, and green?"),
    false,
  );
});

test("evaluate supports a single-LED series circuit powered by Arduino Uno", () => {
  const p = {
    version: 1,
    name: "Arduino Single LED",
    parts: [
      newPart("arduino", "uno", 48, 144),
      newPart("resistor", "r1", 288, 144, { value: 330 }),
      newPart("led", "led1", 528, 144),
    ],
    wires: [
      { id: "w1", from: { part: "uno", pin: "p" }, to: { part: "r1", pin: "a" } },
      { id: "w2", from: { part: "r1", pin: "b" }, to: { part: "led1", pin: "a" } },
      { id: "w3", from: { part: "led1", pin: "k" }, to: { part: "uno", pin: "n" } },
    ],
    mission: "",
    hints: 0,
    completed: [],
    switchSeen: [],
  };

  const res = evaluate(p);
  assert.equal(res.status, "lit");
  assert.ok(res.currentMa && Math.abs(res.currentMa - 9.09) < 0.1);
});

test("evaluate supports Arduino Uno with single LED and switch in both states", () => {
  const openSwitch = newPart("switch", "sw", 288, 288);
  openSwitch.closed = false;

  const p = {
    version: 1,
    name: "Arduino Switch Circuit",
    parts: [
      newPart("arduino", "uno", 48, 144),
      newPart("resistor", "r1", 288, 144, { value: 330 }),
      newPart("led", "led1", 528, 144),
      openSwitch,
    ],
    wires: [
      { id: "w1", from: { part: "uno", pin: "p" }, to: { part: "r1", pin: "a" } },
      { id: "w2", from: { part: "r1", pin: "b" }, to: { part: "sw", pin: "a" } },
      { id: "w3", from: { part: "sw", pin: "b" }, to: { part: "led1", pin: "a" } },
      { id: "w4", from: { part: "led1", pin: "k" }, to: { part: "uno", pin: "n" } },
    ],
    mission: "",
    hints: 0,
    completed: [],
    switchSeen: [],
  };

  const openRes = evaluate(p);
  assert.equal(openRes.status, "open");

  // Close switch
  p.parts[3].closed = true;
  const closedRes = evaluate(p);
  assert.equal(closedRes.status, "lit");
  assert.ok(closedRes.currentMa && Math.abs(closedRes.currentMa - 9.09) < 0.1);
});

test("traffic light project parts do not overlap on canvas workbench", () => {
  const p = buildTrafficLightProject();
  const box = (c) => ({
    left: c.x,
    right: c.x + 144,
    top: c.y,
    bottom: c.y + 144,
  });

  for (let i = 0; i < p.parts.length; i++) {
    for (let j = i + 1; j < p.parts.length; j++) {
      const a = box(p.parts[i]);
      const b = box(p.parts[j]);
      const overlaps = !(
        a.right <= b.left ||
        b.right <= a.left ||
        a.bottom <= b.top ||
        b.bottom <= a.top
      );
      assert.equal(
        overlaps,
        false,
        `Parts ${p.parts[i].id} and ${p.parts[j].id} overlap on canvas`,
      );
    }
  }
});

test("traffic light parts remain within the 1000x640 workbench canvas bounds", () => {
  const p = buildTrafficLightProject();
  for (const part of p.parts) {
    assert.ok(part.x >= 0, `Part ${part.id} x (${part.x}) must be >= 0`);
    assert.ok(part.y >= 0, `Part ${part.id} y (${part.y}) must be >= 0`);
    assert.ok(
      part.x + 144 <= 1000,
      `Part ${part.id} right edge (${part.x + 144}) exceeds world width 1000`,
    );
    assert.ok(
      part.y + 144 <= 640,
      `Part ${part.id} bottom edge (${part.y + 144}) exceeds world height 640`,
    );
  }
});

test("traffic light wiring routes each branch through 5V, resistor, LED, and GND", () => {
  const p = buildTrafficLightProject();
  const colors = ["red", "yellow", "green"];

  for (const color of colors) {
    const supplyWire = p.wires.find(
      (w) =>
        w.from.part === "arduino-uno" &&
        w.from.pin === "p" &&
        w.to.part === `resistor-${color}` &&
        w.to.pin === "a",
    );
    assert.ok(supplyWire, `Missing 5V supply wire for ${color} branch`);

    const seriesWire = p.wires.find(
      (w) =>
        w.from.part === `resistor-${color}` &&
        w.from.pin === "b" &&
        w.to.part === `led-${color}` &&
        w.to.pin === "a",
    );
    assert.ok(seriesWire, `Missing series resistor-to-LED wire for ${color} branch`);

    const gndWire = p.wires.find(
      (w) =>
        w.from.part === `led-${color}` &&
        w.from.pin === "k" &&
        w.to.part === "arduino-uno" &&
        w.to.pin === "n",
    );
    assert.ok(gndWire, `Missing GND return wire for ${color} branch`);
  }
});

test("getTrafficLightElectronicsDocument returns valid designElectronics document with Arduino, 3 resistors, 3 LEDs and C++ code", async () => {
  const { getTrafficLightElectronicsDocument } = await import(
    "../src/lib/playground/traffic-light-template.ts"
  );
  const doc = getTrafficLightElectronicsDocument();
  assert.equal(doc.format, "designElectronics");
  assert.equal(doc.version, 1);
  assert.equal(doc.title, "Arduino Traffic Light (3 LEDs)");

  const parts = doc.parts;
  const uno = parts.find((p) => p.type === "arduino_uno");
  assert.ok(uno, "Must contain Arduino Uno board");
  assert.ok(typeof uno.code === "string" && uno.code.includes("RED_PIN = 8"));
  assert.ok(uno.code.includes("YELLOW_PIN = 9"));
  assert.ok(uno.code.includes("GREEN_PIN = 10"));
  assert.ok(uno.code.includes("pinMode(RED_PIN, OUTPUT)"));

  const resistors = parts.filter((p) => p.type === "resistor");
  assert.equal(resistors.length, 3, "Must have 3 current-limiting resistors");
  for (const r of resistors) {
    assert.equal(r.props?.resistance, "330Ω");
  }

  const leds = parts.filter((p) => p.type === "led");
  assert.equal(leds.length, 3, "Must have 3 LEDs");
  const colors = leds.map((l) => l.props?.color).sort();
  assert.deepEqual(colors, ["Green", "Red", "Yellow"]);

  // Verify wires
  const wires = doc.wires;
  assert.ok(wires.length >= 18, "Must contain wires across views");
  const schematicWires = wires.filter((w) => w.view === "schematic");
  const breadboardWires = wires.filter((w) => w.view === "breadboard");
  assert.equal(schematicWires.length, 9, "Schematic must connect all 3 branches");
  assert.equal(breadboardWires.length, 9, "Breadboard must connect all 3 branches");

  // Check pin 8, 9, 10 are wired to resistors
  for (const pin of ["D8", "D9", "D10"]) {
    const wire = schematicWires.find(
      (w) => w.from.part === uno.id && w.from.pin === pin,
    );
    assert.ok(wire, `Uno pin ${pin} must be wired to a resistor`);
  }
});


