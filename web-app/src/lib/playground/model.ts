export type Kind = "battery" | "led" | "resistor" | "switch";
export type Part = {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  value: number;
  closed: boolean;
};
export type Terminal = { part: string; pin: string };
export type Wire = { id: string; from: Terminal; to: Terminal };
export type Project = {
  version: 1;
  name: string;
  parts: Part[];
  wires: Wire[];
  mission: string;
  hints: number;
  completed: string[];
  switchSeen: string[];
};
export const catalog = {
  battery: {
    label: "DC supply",
    image: "battery",
    pins: ["p", "n"],
    names: ["+", "−"],
    detail: "Adjustable ideal DC source. Supported range: 1.5–12 V.",
  },
  resistor: {
    label: "Resistor",
    image: "resistor",
    pins: ["a", "b"],
    names: ["A", "B"],
    detail:
      "Limits series current. Model rating: 0.25 W. Direction does not matter.",
  },
  led: {
    label: "Red LED",
    image: "led",
    pins: ["a", "k"],
    names: ["A +", "K −"],
    detail:
      "Anode to positive; cathode to negative. Model: 2 V forward drop, 20 mA maximum.",
  },
  switch: {
    label: "Switch",
    image: "switch",
    pins: ["a", "b"],
    names: ["A", "B"],
    detail:
      "An ideal two-terminal switch. Open breaks the path; closed connects it.",
  },
} as const;
export function emptyProject(): Project {
  return {
    version: 1,
    name: "My LED experiment",
    parts: [],
    wires: [],
    mission: "",
    hints: 0,
    completed: [],
    switchSeen: [],
  };
}
export function newPart(kind: Kind, id: string, x: number, y: number): Part {
  return {
    id,
    kind,
    x,
    y,
    value: kind === "battery" ? 5 : kind === "resistor" ? 330 : 2,
    closed: false,
  };
}
export const terminalKey = (t: Terminal) => `${t.part}:${t.pin}`;
export function hasTerminal(p: Project, t: Terminal) {
  const part = p.parts.find((c) => c.id === t.part);
  return (
    !!part && (catalog[part.kind].pins as readonly string[]).includes(t.pin)
  );
}
export function connect(
  p: Project,
  from: Terminal,
  to: Terminal,
  id: string,
): Project {
  const a = terminalKey(from),
    b = terminalKey(to);
  if (!hasTerminal(p, from) || !hasTerminal(p, to) || a === b)
    throw new Error("Choose two different component terminals.");
  if (
    p.wires.some(
      (w) =>
        [terminalKey(w.from), terminalKey(w.to)].sort().join("|") ===
        [a, b].sort().join("|"),
    )
  )
    throw new Error("These terminals are already connected.");
  if (p.wires.length >= 80)
    throw new Error("This workbench supports up to 80 wires.");
  return { ...p, wires: [...p.wires, { id, from, to }] };
}
export function removePart(p: Project, id: string): Project {
  return {
    ...p,
    parts: p.parts.filter((c) => c.id !== id),
    wires: p.wires.filter((w) => w.from.part !== id && w.to.part !== id),
  };
}
export function snap(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value / 24) * 24));
}
export function terminalPoint(p: Part, pin: string) {
  return {
    x:
      p.x +
      ((catalog[p.kind].pins as readonly string[]).indexOf(pin) === 0
        ? 0
        : 144),
    y: p.y + 96,
  };
}
export function validateProject(raw: unknown): Project {
  const p = raw as Project;
  const invalid = () => {
    throw new Error("The request contains an invalid Playground project.");
  };
  if (
    !p ||
    p.version !== 1 ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 80 ||
    !Array.isArray(p.parts) ||
    p.parts.length > 40 ||
    !Array.isArray(p.wires) ||
    p.wires.length > 80
  )
    return invalid();
  const ids = new Set<string>();
  const id = (v: unknown) =>
    typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v);
  for (const c of p.parts) {
    if (
      !c ||
      !id(c.id) ||
      ids.has(c.id) ||
      !Object.hasOwn(catalog, c.kind) ||
      ![c.x, c.y, c.value].every(Number.isFinite) ||
      c.x < 0 ||
      c.x > 840 ||
      c.y < 0 ||
      c.y > 480 ||
      typeof c.closed !== "boolean"
    )
      return invalid();
    ids.add(c.id);
  }
  const pairs = new Set<string>();
  for (const w of p.wires) {
    if (
      !w ||
      !id(w.id) ||
      ids.has(w.id) ||
      !w.from ||
      !w.to ||
      !hasTerminal(p, w.from) ||
      !hasTerminal(p, w.to)
    )
      return invalid();
    const a = terminalKey(w.from),
      b = terminalKey(w.to),
      pair = [a, b].sort().join("|");
    if (a === b || pairs.has(pair)) return invalid();
    ids.add(w.id);
    pairs.add(pair);
  }
  const missions = ["led", "repair", "switch"];
  if (
    !["", ...missions].includes(p.mission) ||
    !Number.isInteger(p.hints) ||
    p.hints < 0 ||
    p.hints > 3 ||
    !Array.isArray(p.completed) ||
    p.completed.length > 3 ||
    p.completed.some((v) => !missions.includes(v)) ||
    !Array.isArray(p.switchSeen) ||
    p.switchSeen.length > 2 ||
    p.switchSeen.some((v) => !["open", "lit"].includes(v))
  )
    return invalid();
  // Return only known fields at the trust boundary.
  return {
    version: 1,
    name: p.name.trim(),
    parts: p.parts.map(({ id, kind, x, y, value, closed }) => ({
      id,
      kind,
      x,
      y,
      value,
      closed,
    })),
    wires: p.wires.map(({ id, from, to }) => ({
      id,
      from: { part: from.part, pin: from.pin },
      to: { part: to.part, pin: to.pin },
    })),
    mission: p.mission,
    hints: p.hints,
    completed: [...new Set(p.completed)],
    switchSeen: [...new Set(p.switchSeen)],
  };
}
