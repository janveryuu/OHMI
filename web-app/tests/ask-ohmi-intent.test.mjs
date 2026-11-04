import test from "node:test";
import assert from "node:assert/strict";
import { parseCircuitIntent, generateCircuit } from "../src/lib/playground/circuit-generator.ts";
import { isTrafficLightMatch } from "../src/lib/playground/model.ts";

test("1. Casual greetings do NOT trigger circuit generation", () => {
  const greetings = [
    "Hi OHMI",
    "hi",
    "Hello!",
    "hey ohmi",
    "Kumusta OHMI!",
    "kamusta po",
    "Good morning OHMI",
    "sup",
    "thank you so much",
    "Salamat!",
    "okay cool",
  ];

  for (const greeting of greetings) {
    const intent = parseCircuitIntent(greeting);
    assert.equal(
      intent.isCircuitRequest,
      false,
      `Expected greeting "${greeting}" to NOT trigger circuit request`
    );

    // Negative guard also holds on isTrafficLightMatch
    assert.equal(
      isTrafficLightMatch("Hello! I am OHMI, your circuit buddy.", greeting),
      false,
      `Expected isTrafficLightMatch to be false for greeting "${greeting}"`
    );
  }
});

test("2. Conceptual questions and explanations do NOT trigger circuit generation", () => {
  const questions = [
    "What is a resistor?",
    "Ano ang resistor?",
    "Explain how an Arduino works",
    "What is an LED?",
    "How does a traffic light work?",
    "Can you explain how a traffic light circuit works?",
    "What is a potentiometer?",
    "What is an LDR photoresistor?",
    "What is a buzzer?",
    "How does a capacitor work?",
    "Ano ang difference ng series at parallel?",
    "Tell me about Arduino Uno",
    "Why does an LED need a resistor?",
    "Calculate the current for 5V and 220 ohms",
    "Why is my LED not turning on?",
  ];

  for (const q of questions) {
    const intent = parseCircuitIntent(q);
    assert.equal(
      intent.isCircuitRequest,
      false,
      `Expected question "${q}" to NOT trigger circuit request`
    );

    assert.equal(
      isTrafficLightMatch("A traffic light uses red, yellow, and green lights.", q),
      false,
      `Expected isTrafficLightMatch to be false for question "${q}"`
    );
  }
});

test("3. Asking to view or show code does NOT trigger breadboard circuit card", () => {
  const codeQueries = [
    "Show Arduino code",
    "Show me the code",
    "Give me the Arduino code",
    "View code please",
    "arduino code",
    "c++ code",
  ];

  for (const query of codeQueries) {
    const intent = parseCircuitIntent(query);
    assert.equal(
      intent.isCircuitRequest,
      false,
      `Expected code query "${query}" to NOT trigger breadboard circuit request`
    );
  }
});

test("4. Assistant response text never pollutes student intent", () => {
  const assistantReplies = [
    "Hello! I am OHMI, your circuit buddy. I can help you build Arduino circuits or explain how components work.",
    "A resistor limits current to protect an LED from burning out in an Arduino circuit.",
    "An Arduino Uno is a microcontroller board with digital pins D0 to D13 and analog pins A0 to A5.",
    "In a traffic light circuit, red, yellow, and green LEDs turn on sequentially using pins 8, 9, and 10.",
  ];

  const studentQueries = [
    "Hi OHMI",
    "What is a resistor?",
    "Explain how an Arduino works",
    "How does a traffic light work?",
  ];

  for (const studentText of studentQueries) {
    for (const reply of assistantReplies) {
      const intent = parseCircuitIntent(studentText, reply);
      assert.equal(
        intent.isCircuitRequest,
        false,
        `Student query "${studentText}" should NOT be triggered by assistant text "${reply}"`
      );
    }
  }
});

test("5. Explicit circuit-building requests DO trigger accurate circuit generation", () => {
  // Test 5A: Build Arduino with 5 LEDs
  const fiveLeds = parseCircuitIntent("Build an Arduino with five LEDs");
  assert.equal(fiveLeds.isCircuitRequest, true);
  assert.equal(fiveLeds.controller, "arduino");
  assert.equal(fiveLeds.ledCount, 5);
  assert.equal(fiveLeds.colors.length, 5);
  const fiveCircuit = generateCircuit(fiveLeds);
  assert.ok(fiveCircuit.document.parts.length >= 11); // Uno + 5 LEDs + 5 resistors
  assert.ok(fiveCircuit.arduinoCode.includes("OUTPUT"));

  // Test 5B: Build Arduino with 6 LEDs
  const sixLeds = parseCircuitIntent("build me an arduino with six LEDs");
  assert.equal(sixLeds.isCircuitRequest, true);
  assert.equal(sixLeds.controller, "arduino");
  assert.equal(sixLeds.ledCount, 6);
  const sixCircuit = generateCircuit(sixLeds);
  assert.ok(sixCircuit.document.parts.length >= 13); // Uno + 6 LEDs + 6 resistors

  // Test 5C: Build Traffic Light
  const traffic = parseCircuitIntent("Build an Arduino traffic light with red, yellow, and green LEDs");
  assert.equal(traffic.isCircuitRequest, true);
  assert.equal(traffic.circuitType, "traffic_light");
  assert.equal(traffic.ledCount, 3);
  assert.deepEqual(traffic.colors, ["Red", "Yellow", "Green"]);
  const trafficCircuit = generateCircuit(traffic);
  assert.ok(trafficCircuit.arduinoCode.includes("RED_PIN"));
  assert.ok(trafficCircuit.arduinoCode.includes("YELLOW_PIN"));
  assert.ok(trafficCircuit.arduinoCode.includes("GREEN_PIN"));

  // Test 5D: Battery circuit with switch and LEDs
  const battery = parseCircuitIntent("Make a 9V battery circuit with switch and two LEDs");
  assert.equal(battery.isCircuitRequest, true);
  assert.equal(battery.controller, "battery");
  assert.equal(battery.ledCount, 2);
  assert.equal(battery.hasSwitch, true);
  assert.equal(battery.batteryVoltage, "9V");
  const batteryCircuit = generateCircuit(battery);
  assert.equal(batteryCircuit.document.parts.some((p) => p.type === "battery"), true);
  assert.equal(batteryCircuit.document.parts.some((p) => p.type === "switch"), true);
});

test("6. Tagalog / Filipino build prompts trigger circuit generation", () => {
  const filipinoBuild = parseCircuitIntent("Gumawa ng Arduino circuit na may tatlong LED");
  assert.equal(filipinoBuild.isCircuitRequest, true);
  assert.equal(filipinoBuild.controller, "arduino");

  const filipinoKabit = parseCircuitIntent("Ikabit ang pushbutton sa Arduino Uno pin D2");
  assert.equal(filipinoKabit.isCircuitRequest, true);
});
