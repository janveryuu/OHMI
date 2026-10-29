import { catalog, terminalKey, validateProject, type Part } from "./model.ts";
export type Evaluation = {
  status: "lit" | "off" | "open" | "incomplete" | "unsafe" | "unsupported";
  message: string;
  currentMa: number | null;
  resistorWatts: number | null;
  scope: string;
};
const scope =
  "Educational DC series model: one source, one red LED, series resistors and optional ideal switches. No breadboard, branches, transient effects or physical verification.";
export function evaluate(raw: unknown): Evaluation {
  const result = (
    status: Evaluation["status"],
    message: string,
    currentMa: number | null = null,
    resistorWatts: number | null = null,
  ): Evaluation => ({ status, message, currentMa, resistorWatts, scope });
  let p;
  try {
    p = validateProject(raw);
  } catch {
    return result(
      "unsupported",
      "This project contains invalid or unsupported component data.",
    );
  }
  if (!p.parts.length)
    return result(
      "incomplete",
      "Place a DC supply, a resistor and a red LED to begin.",
    );
  const supplies = p.parts.filter((c) => c.kind === "battery" || c.kind === "arduino"),
    leds = p.parts.filter((c) => c.kind === "led"),
    resistors = p.parts.filter((c) => c.kind === "resistor");
  if (supplies.length > 1)
    return result(
      "unsupported",
      "Only one DC source or Arduino Uno is supported. Multiple sources need a broader circuit model.",
    );
  if (supplies.length !== 1 || leds.length < 1)
    return result("incomplete", "Add one DC supply or Arduino Uno and at least one LED.");

  const supply = supplies[0];
  if (supply.value < 1.5 || supply.value > 12)
    return result(
      "unsafe",
      "Supply voltage is outside the supported 1.5–12 V range. Do not power this configuration.",
    );

  // Multi-LED traffic light evaluation
  if (leds.length > 1) {
    const parent = new Map<string, string>();
    for (const c of p.parts)
      for (const pin of catalog[c.kind].pins)
        parent.set(
          terminalKey({ part: c.id, pin }),
          terminalKey({ part: c.id, pin }),
        );
    const root = (key: string): string => {
      let n = key;
      while (parent.get(n) !== n) n = parent.get(n)!;
      return n;
    };
    for (const w of p.wires)
      parent.set(root(terminalKey(w.from)), root(terminalKey(w.to)));

    const ends = (c: Part) =>
      catalog[c.kind].pins.map((pin) => root(terminalKey({ part: c.id, pin })));

    const [positive, negative] = ends(supply);
    if (positive === negative)
      return result(
        "unsafe",
        "Short circuit across the supply. Remove the bypass connection before powering anything.",
      );

    for (const c of p.parts) {
      const e = ends(c);
      if (e[0] === e[1]) {
        return result(
          "unsafe",
          "A component is bypassed by wiring. Remove the short across its terminals.",
        );
      }
    }

    let totalCurrentMa = 0;
    let maxBranchPower = 0;

    for (const led of leds) {
      const ledAnode = root(terminalKey({ part: led.id, pin: "a" }));
      const ledCathode = root(terminalKey({ part: led.id, pin: "k" }));

      if (ledAnode === negative || ledCathode === positive) {
        return result(
          "unsafe",
          "Incorrect LED polarity. Connect the anode (A +) toward supply positive and cathode (K −) toward negative.",
        );
      }

      if (ledCathode !== negative) {
        return result(
          "incomplete",
          "The power path is open. Connect the cathode (K −) of each LED to negative / GND.",
        );
      }

      const branchResistors = resistors.filter((r) => {
        const [rA, rB] = ends(r);
        return (rA === ledAnode && rB === positive) || (rB === ledAnode && rA === positive);
      });

      if (!branchResistors.length) {
        if (ledAnode === positive) {
          return result(
            "unsafe",
            "Missing current-limiting resistor. Direct supply connection can damage the LED.",
          );
        }
        return result(
          "incomplete",
          "The power path is open. Each LED requires a current-limiting resistor connected to the 5 V / supply positive rail.",
        );
      }

      const branchR = branchResistors[0];
      if (branchR.value <= 0 || branchR.value > 1_000_000) {
        return result(
          "unsafe",
          "Use positive resistance up to 1 MΩ and standard current-limiting resistors.",
        );
      }

      const currentA = Math.max(0, (supply.value - 2) / branchR.value);
      const powerW = currentA * currentA * branchR.value;

      if (currentA > 0.02 + 1e-12 || powerW > 0.25) {
        return result(
          "unsafe",
          `Potential LED or resistor damage: estimated ${(currentA * 1000).toFixed(1)} mA on a branch exceeds 20 mA.`,
          currentA * 1000,
          powerW,
        );
      }

      totalCurrentMa += currentA * 1000;
      if (powerW > maxBranchPower) maxBranchPower = powerW;
    }

    const usedParts = new Set<string>([supply.id]);
    for (const led of leds) usedParts.add(led.id);
    for (const r of resistors) {
      const [rA, rB] = ends(r);
      if ((rA === positive || rB === positive) && leds.some((l) => ends(l)[0] === (rA === positive ? rB : rA))) {
        usedParts.add(r.id);
      }
    }

    if (usedParts.size !== p.parts.length) {
      return result(
        "incomplete",
        "Some components are outside the power path. Connect or remove them before checking.",
      );
    }

    const avgCurrentMa = totalCurrentMa / leds.length;
    return result(
      "lit",
      `Arduino Traffic Light active! All ${leds.length} LEDs are protected by current-limiting resistors and safely powered at ~${avgCurrentMa.toFixed(1)} mA per branch.`,
      avgCurrentMa,
      maxBranchPower,
    );
  }
  if (
    resistors.some((c) => c.value <= 0 || c.value > 1_000_000) ||
    leds[0].value !== 2
  )
    return result(
      "unsafe",
      "Use positive resistance up to 1 MΩ and the supported 2 V red LED model.",
    );
  const parent = new Map<string, string>();
  for (const c of p.parts)
    for (const pin of catalog[c.kind].pins)
      parent.set(
        terminalKey({ part: c.id, pin }),
        terminalKey({ part: c.id, pin }),
      );
  const root = (key: string): string => {
    let n = key;
    while (parent.get(n) !== n) n = parent.get(n)!;
    return n;
  };
  for (const w of p.wires)
    parent.set(root(terminalKey(w.from)), root(terminalKey(w.to)));
  const ends = (c: Part) =>
    catalog[c.kind].pins.map((pin) => root(terminalKey({ part: c.id, pin })));
  const [positive, negative] = ends(supply);
  if (positive === negative)
    return result(
      "unsafe",
      "Short circuit across the supply. Remove the bypass connection before powering anything.",
    );
  const edges = p.parts
    .filter((c) => c.kind !== "battery" && c.kind !== "arduino")
    .map((c) => ({ part: c, nets: ends(c) }));
  if (edges.some((e) => e.nets[0] === e.nets[1]))
    return result(
      "unsafe",
      "A component is bypassed by wiring. Remove the short across its terminals.",
    );
  const degree = new Map<string, number>();
  for (const c of p.parts)
    for (const net of ends(c)) degree.set(net, (degree.get(net) || 0) + 1);
  if ([...degree.values()].some((d) => d > 2))
    return result(
      "unsupported",
      "This circuit has a branch or bypass. Only a single series loop is supported; no behavior is predicted.",
    );
  const visited = new Set<string>();
  let current = positive,
    reverse = false,
    open = false;
  while (current !== negative) {
    const next = edges.filter(
      (e) => !visited.has(e.part.id) && e.nets.includes(current),
    );
    if (next.length !== 1)
      return result(
        "incomplete",
        "The power path is open. Connect both terminals of every component into one loop.",
      );
    const edge = next[0],
      entry = edge.nets.indexOf(current);
    visited.add(edge.part.id);
    if (edge.part.kind === "led" && entry !== 0) reverse = true;
    if (edge.part.kind === "switch" && !edge.part.closed) open = true;
    current = edge.nets[entry === 0 ? 1 : 0];
  }
  if (visited.size !== edges.length)
    return result(
      "incomplete",
      "Some components are outside the power path. Connect or remove them before checking.",
    );
  if (!resistors.length)
    return result(
      "unsafe",
      "Missing current-limiting resistor. Direct supply connection can damage the LED.",
    );
  if (reverse)
    return result(
      "unsafe",
      "Incorrect LED polarity. Connect the anode (A +) toward supply positive and cathode (K −) toward negative. Reverse voltage may damage an LED.",
    );
  const resistance = resistors.reduce((sum, c) => sum + c.value, 0),
    currentA = Math.max(0, (supply.value - 2) / resistance),
    maxPower = Math.max(...resistors.map((c) => currentA * currentA * c.value));
  if (currentA > 0.02 + 1e-12 || maxPower > 0.25)
    return result(
      "unsafe",
      `Potential LED or resistor damage when closed: estimated ${(currentA * 1000).toFixed(1)} mA; highest resistor dissipation ${maxPower.toFixed(3)} W. Stay at or below 20 mA and 0.25 W.`,
      currentA * 1000,
      maxPower,
    );
  if (open)
    return result(
      "open",
      "Switch open: the path is interrupted, so the LED is off.",
      0,
      0,
    );
  if (supply.value <= 2)
    return result(
      "off",
      "Supply voltage does not exceed the model’s 2 V forward drop. The LED is off in this model.",
      0,
      0,
    );
  if (currentA < 0.001)
    return result(
      "off",
      "Estimated current is below 1 mA. Brightness is not predicted at this low current.",
      currentA * 1000,
      maxPower,
    );
  return result(
    "lit",
    `Closed series loop. The red LED is expected to light at approximately ${(currentA * 1000).toFixed(2)} mA. Actual hardware varies.`,
    currentA * 1000,
    maxPower,
  );
}
