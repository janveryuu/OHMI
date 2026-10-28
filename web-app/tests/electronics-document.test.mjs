import { legacyFixture } from "./electronics-store-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateElectronicsDocument } from "../src/lib/playground/electronics-document.ts";
import { convertLegacyProject } from "../src/lib/playground/legacy-conversion.ts";
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../../docs/playground-upgrade/evidence/uno-blink.dez",
      import.meta.url,
    ),
    "utf8",
  ),
);
test("native document validation preserves editable code, catalog and geometry", () => {
  assert.deepEqual(validateElectronicsDocument(fixture), fixture);
  const copy = validateElectronicsDocument(fixture);
  copy.parts[0].code = "changed";
  assert.notEqual(fixture.parts[0].code, "changed");
});
test("native document boundary rejects truncation, references, geometry and unknown data", () => {
  for (const mutate of [
    (doc) => (doc.version = 2),
    (doc) => doc.parts.push(structuredClone(doc.parts[0])),
    (doc) => (doc.wires[0].from.pin = "INVALID"),
    (doc) => (doc.wires[0].from.part = 999),
    (doc) => (doc.parts[0].type = "UNKNOWN"),
    (doc) => (doc.parts[0].views.breadboard.at = [NaN, 0]),
    (doc) => (doc.parts[0].views.breadboard.rot = 45),
    (doc) => (doc.parts[0].code = "x".repeat(65537)),
    (doc) => (doc.wires[0].points = []),
    (doc) => (doc.nextId = 1),
    (doc) => doc.library[0].pins.push(doc.library[0].pins[0]),
    (doc) =>
      doc.library[0].graphics.breadboard.push({
        k: "script",
        text: "alert(1)",
      }),
  ]) {
    const doc = structuredClone(fixture);
    mutate(doc);
    assert.throws(() => validateElectronicsDocument(doc));
  }
});
test("explicit custom parts preserve bounded native primitives and validate their terminals", () => {
  const doc = {
    format: "designElectronics",
    version: 1,
    title: "Custom",
    parts: [
      {
        id: 1,
        type: "custom_probe",
        props: {},
        views: { breadboard: { at: [0, 0] } },
      },
    ],
    wires: [
      {
        id: 2,
        view: "breadboard",
        points: [
          [0, 0],
          [10, 10],
        ],
        from: { part: 1, pin: "signal" },
      },
    ],
    library: [
      {
        type: "custom_probe",
        pins: [{ id: "signal", breadboard: [0, 0] }],
        graphics: { breadboard: [{ k: "circle", c: [0, 0], r: 10 }] },
      },
    ],
    nextId: 3,
  };
  assert.deepEqual(validateElectronicsDocument(doc), doc);
  doc.wires[0].from.pin = "missing";
  assert.throws(() => validateElectronicsDocument(doc), /terminal/);
});
test("legacy conversion creates a copy, maps all four kinds and preserves mission metadata", () => {
  for (const closed of [false, true]) {
    const legacy = legacyFixture();
    legacy.parts[1].closed = closed;
    const before = structuredClone(legacy);
    const converted = convertLegacyProject(legacy);
    assert.deepEqual(legacy, before);
    assert.deepEqual(converted.legacySnapshot, before);
    assert.equal(converted.document.parts.length, 4);
    assert.equal(converted.document.wires.length, 12);
    assert.equal(
      converted.document.parts[1].props.position,
      closed ? "left" : "right",
    );
    assert.equal(converted.document.parts[0].props.voltage, "5V");
    assert.equal(converted.document.parts[2].props.resistance, "330");
    assert.deepEqual(converted.document.wires[0].from, {
      part: 1,
      pin: "plus",
    });
  }
  const invalid = legacyFixture();
  invalid.parts[0].value = -1;
  assert.throws(
    () => convertLegacyProject(invalid),
    /cannot be converted safely/,
  );
});
