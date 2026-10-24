import { emptyProject, newPart, type Project } from "./model.ts";
import { evaluate } from "./engine.ts";
export const missions = [
  {
    id: "led",
    title: "Your first light",
    objective:
      "Connect the supply, resistor and LED into one safe series loop.",
    explanation:
      "The resistor limits current. Conventional current goes from supply positive through the resistor and LED back to negative. The LED anode faces positive.",
    hints: [
      "Start at the supply + terminal. Which component limits current?",
      "Connect supply + to resistor A. Connect resistor B to LED A +.",
      "Finish the loop: LED K − to supply −. Check the circuit for an expected-light result.",
    ],
  },
  {
    id: "repair",
    title: "Find the hidden issue",
    objective:
      "Fix a connected LED circuit whose resistor allows too much current.",
    explanation:
      "At 5 V with a 2 V LED, a 10 Ω resistor would predict 300 mA. A 330 Ω resistor reduces the estimate to about 9.09 mA, below this model’s 20 mA LED limit.",
    hints: [
      "Check the circuit first. Read the damage warning.",
      "Select the resistor and inspect its resistance. Use I = (V − 2) / R.",
      "Set resistance to 330 Ω, then check again. The expected current is about 9.09 mA.",
    ],
  },
  {
    id: "switch",
    title: "You are in control",
    objective:
      "Check the LED off with an open switch, then on with a closed switch.",
    explanation:
      "An open switch breaks the only current path. Closing it completes the loop. Both states must be checked on the same circuit to finish this mission.",
    hints: [
      "The circuit starts with its switch open. Check this state first.",
      "Select the switch. Choose Close switch, then check the circuit again.",
      "Both checks must use a safe series circuit. Keep the 330 Ω resistor and correct LED polarity.",
    ],
  },
] as const;
export function startMission(id: string, completed: string[] = []): Project {
  const p = emptyProject();
  p.mission = id;
  p.name = missions.find((m) => m.id === id)?.title || p.name;
  p.completed = completed;
  p.parts = [
    newPart("battery", "supply", 48, 72),
    newPart("resistor", "resistor", 336, 72),
    newPart("led", "led", 624, 72),
  ];
  if (id === "led") return p;
  p.wires = [
    {
      id: "supply-resistor",
      from: { part: "supply", pin: "p" },
      to: { part: "resistor", pin: "a" },
    },
    {
      id: "resistor-led",
      from: { part: "resistor", pin: "b" },
      to: { part: "led", pin: "a" },
    },
    {
      id: "return",
      from: { part: "led", pin: "k" },
      to: { part: "supply", pin: "n" },
    },
  ];
  if (id === "repair") p.parts[1].value = 10;
  if (id === "switch") {
    p.parts.push(newPart("switch", "switch", 336, 336));
    p.wires[2] = {
      id: "return",
      from: { part: "led", pin: "k" },
      to: { part: "switch", pin: "a" },
    };
    p.wires.push({
      id: "switch-supply",
      from: { part: "switch", pin: "b" },
      to: { part: "supply", pin: "n" },
    });
  }
  return p;
}
export function missionProgress(p: Project) {
  const result = evaluate(p),
    safe = ["lit", "open"].includes(result.status),
    hasSwitch = p.parts.some((c) => c.kind === "switch");
  const steps =
    p.mission === "switch"
      ? [
          {
            label: "A safe series circuit with a switch",
            done: safe && hasSwitch,
          },
          {
            label: "Check with switch open: LED off",
            done: safe && p.switchSeen.includes("open"),
          },
          {
            label: "Check with switch closed: LED on",
            done: safe && p.switchSeen.includes("lit"),
          },
        ]
      : [
          {
            label: "Supply, resistor and LED placed",
            done: ["battery", "resistor", "led"].every((k) =>
              p.parts.some((c) => c.kind === k),
            ),
          },
          {
            label: "Complete loop with safe polarity and resistance",
            done: result.status === "lit",
          },
          {
            label: "LED expected to light within model limits",
            done: result.status === "lit",
          },
        ];
  return { steps, complete: !!p.mission && steps.every((s) => s.done) };
}
export function observeCheck(p: Project): Project {
  const result = evaluate(p);
  let next = {
    ...p,
    switchSeen:
      p.mission === "switch" &&
      p.parts.some((c) => c.kind === "switch") &&
      ["lit", "open"].includes(result.status)
        ? [...new Set([...p.switchSeen, result.status])]
        : [],
  };
  if (missionProgress(next).complete)
    next = { ...next, completed: [...new Set([...next.completed, p.mission])] };
  return next;
}
