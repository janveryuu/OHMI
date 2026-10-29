export type Kind = "battery" | "led" | "resistor" | "switch" | "arduino";
export type Part = {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  value: number;
  closed: boolean;
  label?: string;
  color?: string;
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
  arduino: {
    label: "Arduino Uno",
    image: "arduino-uno",
    pins: ["p", "n"],
    names: ["5V", "GND"],
    detail:
      "Microcontroller board supplying regulated 5 V and GND power rails for circuits.",
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
export function newPart(
  kind: Kind,
  id: string,
  x: number,
  y: number,
  extra?: { label?: string; color?: string; value?: number },
): Part {
  return {
    id,
    kind,
    x,
    y,
    value:
      extra?.value !== undefined
        ? extra.value
        : kind === "battery" || kind === "arduino"
          ? 5
          : kind === "resistor"
            ? 330
            : 2,
    closed: false,
    ...(extra?.label ? { label: extra.label } : {}),
    ...(extra?.color ? { color: extra.color } : {}),
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
      typeof c.closed !== "boolean" ||
      (c.label !== undefined && (typeof c.label !== "string" || c.label.length > 40)) ||
      (c.color !== undefined && (typeof c.color !== "string" || !["red", "yellow", "green", "blue"].includes(c.color.toLowerCase())))
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
    parts: p.parts.map(({ id, kind, x, y, value, closed, label, color }) => ({
      id,
      kind,
      x,
      y,
      value,
      closed,
      ...(label ? { label: label.trim().slice(0, 40) } : {}),
      ...(color ? { color: color.toLowerCase() } : {}),
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

export function buildTrafficLightProject(): Project {
  const p = emptyProject();
  p.name = "Arduino Traffic Light (3 LEDs)";
  const arduino = newPart("arduino", "arduino-uno", 48, 216, { label: "Arduino Uno" });
  const rRed = newPart("resistor", "resistor-red", 288, 48, { label: "220 Ω (Red)", value: 220 });
  const rYellow = newPart("resistor", "resistor-yellow", 288, 216, { label: "220 Ω (Yellow)", value: 220 });
  const rGreen = newPart("resistor", "resistor-green", 288, 384, { label: "220 Ω (Green)", value: 220 });

  const ledRed = newPart("led", "led-red", 528, 48, { label: "Red LED", color: "red" });
  const ledYellow = newPart("led", "led-yellow", 528, 216, { label: "Yellow LED", color: "yellow" });
  const ledGreen = newPart("led", "led-green", 528, 384, { label: "Green LED", color: "green" });

  p.parts = [arduino, rRed, rYellow, rGreen, ledRed, ledYellow, ledGreen];
  p.wires = [
    { id: "wire-5v-red", from: { part: "arduino-uno", pin: "p" }, to: { part: "resistor-red", pin: "a" } },
    { id: "wire-red-res-led", from: { part: "resistor-red", pin: "b" }, to: { part: "led-red", pin: "a" } },
    { id: "wire-red-gnd", from: { part: "led-red", pin: "k" }, to: { part: "arduino-uno", pin: "n" } },

    { id: "wire-5v-yellow", from: { part: "arduino-uno", pin: "p" }, to: { part: "resistor-yellow", pin: "a" } },
    { id: "wire-yellow-res-led", from: { part: "resistor-yellow", pin: "b" }, to: { part: "led-yellow", pin: "a" } },
    { id: "wire-yellow-gnd", from: { part: "led-yellow", pin: "k" }, to: { part: "arduino-uno", pin: "n" } },

    { id: "wire-5v-green", from: { part: "arduino-uno", pin: "p" }, to: { part: "resistor-green", pin: "a" } },
    { id: "wire-green-res-led", from: { part: "resistor-green", pin: "b" }, to: { part: "led-green", pin: "a" } },
    { id: "wire-green-gnd", from: { part: "led-green", pin: "k" }, to: { part: "arduino-uno", pin: "n" } },
  ];
  return p;
}

export function isTrafficLightMatch(msgText: string, userText?: string): boolean {
  const combined = `${userText || ""} ${msgText || ""}`.toLowerCase();

  // Negative guards for unrelated hardware and purely conceptual questions
  if (
    combined.includes("hc-sr04") ||
    combined.includes("ultrasonic") ||
    combined.includes("potentiometer") ||
    combined.includes("servo") ||
    combined.includes("ohm's law") ||
    combined.includes("ohms law") ||
    (combined.includes("why is a traffic light") &&
      !/build|wire|connect|code|sketch|playground|workspace/i.test(combined))
  ) {
    return false;
  }

  const hasTrafficLight =
    combined.includes("traffic light") ||
    combined.includes("traffic-light") ||
    combined.includes("traffic lights");

  const hasCircuitOrBuildIntent =
    /\b(?:build|make|create|wire|wiring|circuit|code|sketch|playground|workspace|connect|setup|set\s+up|project|simulate|tinkercad|gawa|buo|ikabit)\b/i.test(
      combined,
    ) ||
    combined.includes("circuit");

  const hasArduino = combined.includes("arduino");

  const hasArduinoAndLeds =
    hasArduino &&
    (combined.includes("three led") ||
      combined.includes("3 led") ||
      combined.includes("3 leds") ||
      combined.includes("three leds") ||
      combined.includes("traffic") ||
      (combined.includes("led") && hasCircuitOrBuildIntent));

  // General Arduino circuit building or coding request
  const hasArduinoBuild = hasArduino && hasCircuitOrBuildIntent;

  // Explicit user playground intent in circuit context or direct intent
  const hasPlaygroundIntent =
    /\b(?:playground|play\s*ground|workspace|electronic\s*workspace|electronics\s*workspace)\b/i.test(combined) &&
    !/\b(?:what\s+is|explain|info\s+about)\b/i.test(combined);

  return (
    hasArduinoAndLeds ||
    (hasTrafficLight && (hasCircuitOrBuildIntent || combined.includes("arduino") || combined.includes("led"))) ||
    hasArduinoBuild ||
    hasPlaygroundIntent
  );
}
