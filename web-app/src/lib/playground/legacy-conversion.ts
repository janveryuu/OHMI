import { validateProject } from "./model.ts";
import definitions from "./legacy-native-parts.json" with { type: "json" };
import { validateElectronicsDocument } from "./electronics-document.ts";

const pins = {
  battery: { p: "plus", n: "minus" },
  resistor: { a: "pin0", b: "pin1" },
  led: { a: "anode", k: "cathode" },
  switch: { a: "common", b: "a" },
};
export function convertLegacyProject(raw: unknown) {
  const legacy = validateProject(raw),
    idMap = new Map(legacy.parts.map((part, index) => [part.id, index + 1]));
  let nextId = legacy.parts.length + 1;
  const parts = legacy.parts.map((part) => {
    if (
      (part.kind === "battery" && (part.value < 1.5 || part.value > 12)) ||
      (part.kind === "resistor" &&
        (part.value <= 0 || part.value > 10000000)) ||
      (part.kind === "led" && part.value !== 2)
    )
      throw new Error(
        "The request contains legacy electrical values that cannot be converted safely. Keep using the original Playground.",
      );
    const props =
      part.kind === "battery"
        ? { voltage: String(part.value) + "V" }
        : part.kind === "resistor"
          ? { resistance: String(part.value) }
          : part.kind === "switch"
            ? { position: part.closed ? "left" : "right" }
            : { color: "Red" };
    return {
      id: idMap.get(part.id)!,
      type: part.kind,
      label: part.kind + " " + idMap.get(part.id),
      props,
      views: Object.fromEntries(
        ["breadboard", "schematic", "pcb"].map((view) => [
          view,
          { at: [part.x * 10, part.y * 10] },
        ]),
      ),
    };
  });
  const wires = legacy.wires.flatMap((wire) =>
    ["breadboard", "schematic", "pcb"].map((view) => {
      const terminal = (ref: typeof wire.from) => {
        const original = legacy.parts.find((part) => part.id === ref.part)!;
        const pin =
          pins[original.kind][
            ref.pin as keyof (typeof pins)[typeof original.kind]
          ];
        const definition = definitions.find(
          (definition) => definition.type === original.kind,
        )!;
        const native = definition.pins.find((terminal) => terminal.id === pin)!;
        const offset = native[view as "breadboard" | "schematic" | "pcb"];
        return {
          ref: { part: idMap.get(ref.part)!, pin },
          point: [original.x * 10 + offset[0], original.y * 10 + offset[1]],
        };
      };
      const from = terminal(wire.from),
        to = terminal(wire.to);
      return {
        id: nextId++,
        view,
        points: [from.point, to.point],
        from: from.ref,
        to: to.ref,
      };
    }),
  );
  return {
    document: validateElectronicsDocument({
      format: "designElectronics",
      version: 1,
      title: legacy.name,
      parts,
      wires,
      nextId,
      notes_: [],
      library: structuredClone(definitions),
    }),
    legacySnapshot: structuredClone(legacy),
  };
}
