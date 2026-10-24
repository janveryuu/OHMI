const steps = [
  {
    title: "Meet your components",
    detail:
      "Start with a simple LED circuit. Lay out each component so you can identify it before making connections.",
    tip: "The longer leg of a typical LED is the anode (+). The flat side often marks the cathode (-). Check the component datasheet.",
    task: "I can identify each component.",
  },
  {
    title: "Place the LED",
    detail:
      "With power disconnected, place the LED legs in separate breadboard rows. Legs in the same connected row would bypass the LED.",
    tip: "Breadboard groups are connected internally. The center gap separates the two sides.",
    task: "My LED legs are in separate rows.",
  },
  {
    title: "Add a current-limiting resistor",
    detail:
      "Connect a 330 Ω resistor in series with the LED. For this example, assume a 5 V source and a red LED with an approximate 2 V forward drop.",
    tip: "Example calculation: I = (5 V - 2 V) / 330 Ω ≈ 9 mA. Actual current depends on the LED and supply.",
    task: "My resistor is in series with the LED.",
  },
  {
    title: "Complete the path",
    detail:
      "Connect supply positive to the resistor, the resistor to the LED anode, and the LED cathode to ground. Keep the supply disconnected while wiring.",
    tip: "Trace the whole loop with your finger before connecting power. Never connect an LED directly across the supply.",
    task: "I traced the complete series path.",
  },
  {
    title: "Review, then try it",
    detail:
      "Check polarity and connections. In a simulator, start simulation. For real hardware, ask your instructor to review the circuit before powering it.",
    tip: "If it does not light, disconnect power before changing anything. Recheck LED polarity and breadboard rows.",
    task: "I reviewed my circuit and completed the lesson.",
  },
];
export const curatedGuide = {
  status: "tutorial",
  title: "Your first LED circuit",
  objective:
    "Follow a curated example using a 5 V supply, red LED and 330 ohm series resistor. Confirm actual component ratings.",
  components: [
    {
      name: "Red LED",
      quantity: 1,
      notes: "Example forward voltage approximately 2 V; verify the datasheet.",
    },
    { name: "330 ohm resistor", quantity: 1 },
    { name: "Breadboard", quantity: 1 },
    { name: "5 V supply", quantity: 1 },
    { name: "Jumper wires", quantity: "as needed" },
  ],
  steps: steps.map((item, index) => ({
    step: index + 1,
    title: item.title,
    instruction: item.detail,
    why: item.tip,
    check: item.task,
  })),
  notes:
    "Curated educational example. Student-marked progress is not proof of electrical safety or mastery.",
};
