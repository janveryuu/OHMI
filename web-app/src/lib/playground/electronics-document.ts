import catalog from "./electronics-catalog.json" with { type: "json" };
import {
  boundedJson,
  MAX_BYTES,
} from "../../../public/vendor/design-electronics/protocol.mjs";

export const ELECTRONICS_ENGINE = catalog.upstream;
export type ElectronicsDocument = Record<string, unknown> & {
  format: "designElectronics";
  version: 1;
  title: string;
  parts: Record<string, unknown>[];
  wires: Record<string, unknown>[];
};
const known = new Map<string, Set<string>>();
for (const entry of catalog.entries) {
  const pins = known.get(entry.type) || new Set<string>();
  for (const pin of entry.pins) pins.add(pin);
  known.set(entry.type, pins);
}
const fail = (reason: string): never => {
  throw new Error(
    "The request contains an invalid electronics document: " + reason,
  );
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail("expected an object.");
const array = (value: unknown, max: number): unknown[] =>
  Array.isArray(value) && value.length <= max
    ? value
    : fail("too many or missing items.");
const text = (value: unknown, max = 65536): string =>
  typeof value === "string" && value.length <= max
    ? value
    : fail("invalid text.");
const integer = (value: unknown, min = 1, max = 10000000): number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max
    ? value
    : fail("invalid identifier or count.");
const point = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some(
      (n) =>
        typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1000000,
    )
  )
    fail("invalid geometry.");
};
const views = new Set(["breadboard", "schematic", "pcb"]);
const countProp = (
  props: Record<string, unknown>,
  key: string,
  fallback: number,
  max: number,
) => {
  const value = props[key] === undefined ? fallback : Number(props[key]);
  return integer(value, 1, max);
};
function partPins(
  type: string,
  props: Record<string, unknown>,
  embedded: Map<string, Set<string>>,
) {
  if (type === "ic_dip") {
    const n = countProp(props, "pins", 8, 64);
    return new Set(
      Array.from(
        { length: Math.max(4, Math.min(64, n + (n % 2))) },
        (_, i) => "pin" + (i + 1),
      ),
    );
  }
  if (type === "header_male" || type === "header_female")
    return new Set(
      Array.from(
        { length: countProp(props, "pins", 4, 40) },
        (_, i) => "pin" + (i + 1),
      ),
    );
  if (type === "connector") {
    const rows = countProp(props, "rows", 2, 4),
      cols = countProp(props, "pins per row", 5, 60),
      pins = new Set<string>();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const numbering = props.numbering || "Odd/Even";
        const order =
          numbering === "Odd/Even"
            ? c * rows + r
            : numbering === "Counter-clockwise" && rows === 2
              ? r === 1
                ? c
                : 2 * cols - 1 - c
              : r * cols + c;
        const label = String(numbering).startsWith("Row letter first")
          ? String.fromCharCode(65 + r) + (c + 1)
          : String(numbering).startsWith("Row letter last")
            ? c + 1 + String.fromCharCode(65 + r)
            : String(order + 1);
        pins.add("pin" + label);
      }
    if (props.extra && props.extra !== "None")
      pins.add(props.extra === "Shield" ? "SH" : "MP");
    return pins;
  }
  if (type === "breadboard") {
    const size = props.size || "half+",
      cols = size === "full+" ? 63 : size === "mini" ? 17 : 30,
      pins = new Set<string>();
    for (const row of "abcdefghij")
      for (let i = 1; i <= cols; i++) pins.add(row + i);
    if (size !== "mini")
      for (const rail of ["tp", "tn", "bp", "bn"])
        for (
          let i = 1;
          i <=
          Array.from({ length: cols - 2 }, (_, i) => i + 1).filter(
            (i) => i % 6 !== 0,
          ).length;
          i++
        )
          pins.add(rail + i);
    return pins;
  }
  return (
    known.get(type) ||
    embedded.get(type) ||
    fail("unknown part type; include its bounded native library definition.")
  );
}

export function validateElectronicsDocument(raw: unknown): ElectronicsDocument {
  try {
    boundedJson(raw, MAX_BYTES);
  } catch {
    return fail("document exceeds supported JSON bounds (1 MiB).");
  }
  const doc = object(raw);
  if (doc.format !== "designElectronics" || doc.version !== 1)
    fail("unsupported format or version.");
  if (!text(doc.title, 80).trim()) fail("a title is required.");
  if (doc.uid !== undefined) text(doc.uid, 128);
  const parts = array(doc.parts, 200),
    wires = array(doc.wires, 800),
    ids = new Set<number>(),
    embedded = new Map<string, Set<string>>();
  for (const value of array(doc.library ?? [], 200)) {
    const definition = object(value),
      type = text(definition.type, 128);
    if (!type || embedded.has(type)) fail("duplicate or missing library type.");
    const pins = new Set<string>();
    for (const value of array(definition.pins ?? [], 1000)) {
      const pin = object(value),
        id = text(pin.id, 128);
      if (!id || pins.has(id)) fail("invalid custom terminal identifier.");
      pins.add(id);
      for (const view of views) if (pin[view] !== undefined) point(pin[view]);
    }
    for (const bus of array(definition.buses ?? [], 1000))
      for (const pin of array(bus, 1000))
        if (!pins.has(text(pin, 128)))
          fail("custom bus references an unknown terminal.");
    const graphics = object(definition.graphics ?? {});
    for (const [view, values] of Object.entries(graphics)) {
      if (!views.has(view)) fail("unknown graphics view.");
      for (const value of array(values, 5000)) {
        const primitive = object(value);
        if (
          !["line", "rect", "circle", "arc", "text", "poly"].includes(
            text(primitive.k, 10),
          )
        )
          fail("unsupported custom graphic.");
        for (const key of ["a", "b", "c", "at"])
          if (primitive[key] !== undefined) point(primitive[key]);
        if (primitive.pts !== undefined)
          for (const p of array(primitive.pts, 2000)) point(p);
      }
    }
    embedded.set(type, pins);
  }
  const terminals = new Map<number, Set<string>>();
  const claim = (id: unknown) => {
    const number = integer(id);
    if (ids.has(number)) fail("duplicate identifier.");
    ids.add(number);
    return number;
  };
  for (const value of parts) {
    const part = object(value),
      id = claim(part.id),
      type = text(part.type, 128),
      props = object(part.props ?? {});
    for (const [key, value] of Object.entries(props)) {
      text(key, 128);
      text(value, 65536);
    }
    if (part.code !== undefined) text(part.code, 65536);
    if (part.label !== undefined) text(part.label, 128);
    for (const [view, value] of Object.entries(object(part.views))) {
      if (!views.has(view)) fail("unknown part view.");
      const placement = object(value);
      point(placement.at);
      if (
        placement.rot !== undefined &&
        ![0, 90, 180, 270].includes(placement.rot as number)
      )
        fail("unsupported rotation.");
      for (const key of ["flip", "hidden"])
        if (placement[key] !== undefined && typeof placement[key] !== "boolean")
          fail("invalid placement flag.");
    }
    terminals.set(id, partPins(type, props, embedded));
  }
  for (const value of wires) {
    const wire = object(value);
    claim(wire.id);
    if (!views.has(text(wire.view, 12))) fail("unknown wire view.");
    const points = array(wire.points, 2000);
    if (points.length < 2) fail("wire needs two points.");
    for (const p of points) point(p);
    for (const key of ["from", "to"])
      if (wire[key] !== undefined) {
        const ref = object(wire[key]);
        if (!terminals.get(integer(ref.part))?.has(text(ref.pin, 128)))
          fail("wire references an unknown terminal.");
      }
  }
  for (const value of array(doc.notes_ ?? [], 200)) {
    const note = object(value);
    claim(note.id);
    if (!views.has(text(note.view, 12))) fail("unknown note view.");
    point(note.at);
    if (note.size !== undefined) point(note.size);
    text(note.text);
  }
  if (doc.nextId !== undefined && integer(doc.nextId) <= Math.max(0, ...ids))
    fail("next identifier would collide.");
  return structuredClone(doc) as ElectronicsDocument;
}
