export const navigation = [
  { href: "/", label: "Dashboard", icon: "House" },
  { href: "/ask", label: "Ask OHMI", icon: "MessageCircle" },
  { href: "/assignments", label: "Assignments", icon: "FolderOpen" },
  { href: "/checker", label: "Circuit Checker", icon: "ScanLine" },
  { href: "/guide", label: "Step-by-Step Guide", icon: "BookOpen" },
  {
    href: "/progress",
    label: "Learning Progress",
    icon: "ChartNoAxesCombined",
  },
  { href: "/settings", label: "Settings & Profile", icon: "Settings2" },
] as const;
export const steps = [
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
export const starterMessages = [
  {
    role: "assistant" as const,
    text: "Hi, I’m OHMI. What are you curious about today? Try asking why an LED needs a resistor.",
    id: "welcome",
  },
];
export const demoReply = (question: string, language: string) => {
  const prefix =
    language === "English"
      ? ""
      : "Language preference noted. Preset demo replies remain in English.\n\n";
  if (/resist|led|current|ohm/i.test(question))
    return (
      prefix +
      "An LED needs a resistor to limit current. Without one, too much current can damage it.\n\n**Try this example**\nFor a 5 V supply and a red LED with a 2 V forward drop:\n\n`R = (5 V - 2 V) / 0.009 A ≈ 333 Ω`\n\nA 330 Ω resistor is a nearby standard value. Check your LED’s ratings before using real hardware.\n\n**Think it through:** What would happen to the current if you increased the resistance?\n\nThis is a preset demonstration, not an AI response."
    );
  if (/code|arduino|blink/i.test(question))
    return (
      prefix +
      "**A first Arduino blink**\nThis preset example switches the built-in LED every second.\n\n```cpp\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}\n```\n\n`setup()` runs once. `loop()` repeats. Board LED pins can differ; check your board documentation.\n\nThis is a preset demonstration, not an AI response."
    );
  return (
    prefix +
    "**Let’s break it down**\nThis frontend demo has preset examples about LED resistors and Arduino blink. It cannot answer arbitrary questions or read attachments yet.\n\nTry “Why does an LED need a resistor?” or open the beginner guide. Your question stays in this session only."
  );
};
