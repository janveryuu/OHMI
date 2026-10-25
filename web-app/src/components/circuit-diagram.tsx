"use client";
import Image from "next/image";
import { useState } from "react";

export function CircuitDiagram({ step = 0 }: { step?: number }) {
  return (
    <figure className="circuit-diagram">
      <svg
        viewBox="0 0 600 260"
        role="img"
        aria-labelledby="circuit-title circuit-desc"
      >
        <title id="circuit-title">Example LED series circuit</title>
        <desc id="circuit-desc">
          A five volt DC source connects through a 330 ohm resistor and an LED
          to ground. Power must be disconnected while wiring.
        </desc>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M90 190V80H220M300 80H390M433 80H510V190H90" />
          <path d="M220 65H300V95H220Z" />
          <path d="M390 58L426 80L390 102ZM433 58V102" />
          <path d="M442 46L460 28M450 58L468 40M452 28H460V36M460 40H468V48" />
          <circle cx="90" cy="135" r="23" fill="var(--card)" />
          <path d="M83 127H97M90 120V134M83 145H97M510 190V205M494 205H526M500 213H520M506 221H514" />
        </g>
        <g
          fill="currentColor"
          fontFamily="inherit"
          fontSize="16"
          textAnchor="middle"
        >
          <text x="90" y="242">
            5 V DC
          </text>
          <text x="260" y="126">
            330 Ω
          </text>
          <text x="410" y="140">
            Red LED
          </text>
          <text x="510" y="246">
            Ground
          </text>
        </g>
        {step > 0 && (
          <circle
            cx={[90, 410, 260, 510, 90][step] || 90}
            cy="80"
            r="7"
            fill="var(--primary)"
          />
        )}
      </svg>
      <figcaption>
        Example schematic, not a wiring verification. Disconnect power before
        making changes.
      </figcaption>
    </figure>
  );
}

const COMPONENT_PATTERNS: Array<{
  id: string;
  name: string;
  keywords: RegExp;
  hint: string;
}> = [
  {
    id: "arduino-uno",
    name: "Arduino Uno R3",
    keywords: /\b(arduino|uno|microcontroller|atmega|pin\s*\d+|analogread|digitalwrite)\b/i,
    hint: "5V, 3.3V, GND power pins; D0–D13 digital I/O; A0–A5 analog inputs",
  },
  {
    id: "breadboard",
    name: "Solderless Breadboard",
    keywords: /\b(breadboard|tie[- ]points?|rails?|terminal[- ]strip)\b/i,
    hint: "Power rails connect vertically; terminal strips connect horizontally in rows of 5",
  },
  {
    id: "resistor",
    name: "Fixed Resistor",
    keywords: /\b(resistor|ohm|kiloohm|Ω|kΩ|330|220|10k|1k|4\.7k|current[- ]limiting)\b/i,
    hint: "Non-polarized; color bands indicate resistance and tolerance",
  },
  {
    id: "rgb-led",
    name: "RGB LED",
    keywords: /\b(rgb[- ]led|common[- ](anode|cathode))\b/i,
    hint: "Longest pin is common (anode/cathode); R, G, B pins connect through current-limiting resistors",
  },
  {
    id: "led",
    name: "Light Emitting Diode (LED)",
    keywords: /\b(led|light[- ]emitting|anode|cathode)\b/i,
    hint: "Polarized: Long leg is Anode (+), flat edge with short leg is Cathode (-)",
  },
  {
    id: "pushbutton",
    name: "Momentary Pushbutton",
    keywords: /\b(push[- ]?button|tactile[- ]switch|button|press)\b/i,
    hint: "Diagonal legs connect when pressed; use pull-up or pull-down resistor",
  },
  {
    id: "potentiometer",
    name: "Rotary Potentiometer",
    keywords: /\b(potentiometer|pot|variable[- ]resistor|wiper)\b/i,
    hint: "Outer pins connect to VCC and GND; center wiper pin outputs variable analog voltage",
  },
  {
    id: "servo",
    name: "Servo Motor (Micro SG90)",
    keywords: /\b(servo|sg90|motor[- ]angle|sweep|servomotor)\b/i,
    hint: "Brown/Black = GND, Red = +5V, Orange/Yellow = PWM signal pin",
  },
  {
    id: "dc-motor",
    name: "DC Motor",
    keywords: /\b(dc[- ]motor|gear[- ]motor|h[- ]bridge|l293d)\b/i,
    hint: "Requires flyback diode and transistor or driver chip to handle inductive kickback",
  },
  {
    id: "ultrasonic",
    name: "Ultrasonic Distance Sensor (HC-SR04)",
    keywords: /\b(ultrasonic|hc[- ]sr04|sonar|echo|trigger|distance[- ]sensor)\b/i,
    hint: "Pins: VCC (5V), Trig (pulse trigger), Echo (receive echo), GND",
  },
  {
    id: "battery",
    name: "DC Power Supply / Battery",
    keywords: /\b(battery|9v|5v|power[- ]supply|voltage[- ]source|vcc|gnd)\b/i,
    hint: "Red = Positive (+), Black = Ground / Negative (-); verify supply voltage before connecting",
  },
  {
    id: "capacitor",
    name: "Capacitor",
    keywords: /\b(capacitor|capacitance|uf|microfarad|smoothing|decoupling)\b/i,
    hint: "Electrolytics are polarized (stripe marks negative lead); ceramics are non-polarized",
  },
  {
    id: "diode",
    name: "Semiconductor Diode",
    keywords: /\b(diode|rectifier|1n4001|1n4007|1n4148)\b/i,
    hint: "Silver/black stripe marks the Cathode (-); current flows from Anode to Cathode",
  },
  {
    id: "npn-transistor",
    name: "NPN BJT Transistor",
    keywords: /\b(transistor|npn|2n2222|2n3904|bjt|collector|base|emitter)\b/i,
    hint: "Pins: Collector, Base, Emitter; Base current controls collector-emitter conduction",
  },
  {
    id: "photoresistor",
    name: "Photoresistor (LDR)",
    keywords: /\b(photoresistor|ldr|light[- ]sensor|photocell)\b/i,
    hint: "Resistance decreases with increasing light; wire in voltage divider with fixed resistor",
  },
  {
    id: "piezo",
    name: "Piezo Buzzer",
    keywords: /\b(buzzer|piezo|speaker|sounder|tone|beeper)\b/i,
    hint: "Long leg / (+) connects to digital pin or PWM; short leg connects to GND",
  },
  {
    id: "switch",
    name: "Slide / Toggle Switch",
    keywords: /\b(spdt|toggle[- ]switch|slide[- ]switch|spst)\b/i,
    hint: "Center common pin connects to one of two outer contacts depending on switch position",
  },
  {
    id: "temperature",
    name: "Temperature Sensor (TMP36 / LM35)",
    keywords: /\b(temperature|tmp36|lm35|thermistor|temp[- ]sensor)\b/i,
    hint: "Flat face forward: Pin 1 = 5V, Pin 2 = Vout (analog signal), Pin 3 = GND",
  },
  {
    id: "multimeter",
    name: "Digital Multimeter",
    keywords: /\b(multimeter|voltmeter|ammeter|measure|dmm|probe)\b/i,
    hint: "Measure voltage in parallel; measure current in series; measure resistance with power off",
  },
  {
    id: "wires",
    name: "Jumper Wires",
    keywords: /\b(jumper|wire|wires|lead|leads|connection)\b/i,
    hint: "Standard convention: Red for power (+5V/VCC), Black for ground (GND)",
  },
];

export interface StepVisualProps {
  step?: number;
  title?: string;
  instruction?: string;
  why?: string;
  check?: string;
  code?: string;
  component?: string;
  isCuratedLed?: boolean;
}

export function StepVisual({
  step = 0,
  title = "",
  instruction = "",
  why = "",
  check = "",
  code = "",
  component = "",
  isCuratedLed = false,
}: StepVisualProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (isCuratedLed) {
    return <CircuitDiagram step={step} />;
  }

  // Detect component from step text
  const combinedText = `${component} ${title} ${instruction} ${why} ${check} ${code}`;
  const matched = COMPONENT_PATTERNS.find((item) =>
    item.keywords.test(combinedText),
  );

  if (matched && !imgFailed) {
    return (
      <figure className="step-visual-card">
        <div className="step-visual-inner">
          <div className="step-visual-image-wrap">
            <Image
              src={`/app/library/${matched.id}.webp`}
              alt={`Illustration of ${matched.name}`}
              width={480}
              height={360}
              className="step-visual-image"
              onError={() => setImgFailed(true)}
            />
          </div>
          <div className="step-visual-details">
            <div className="between">
              <span className="badge">Component Focus</span>
              <span className="step-visual-tag">Step {step + 1}</span>
            </div>
            <h4>{matched.name}</h4>
            <p className="small muted">{matched.hint}</p>
          </div>
        </div>
        <figcaption className="step-visual-caption">
          Suggested wiring reference, not a wiring verification. Disconnect power
          before making changes.
        </figcaption>
      </figure>
    );
  }

  // Fallback: Safe SVG schematic / verification checkpoint diagram
  return (
    <figure className="step-visual-card checkpoint-card">
      <div className="step-visual-schematic">
        <svg
          viewBox="0 0 600 180"
          role="img"
          aria-label="Circuit step verification checkpoint"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Solderless breadboard / rail outline */}
            <rect
              x="60"
              y="30"
              width="480"
              height="120"
              rx="12"
              fill="var(--card)"
              stroke="var(--border)"
            />
            {/* Power rail lines */}
            <line
              x1="90"
              y1="55"
              x2="510"
              y2="55"
              stroke="#ef4444"
              strokeDasharray="8 6"
            />
            <line
              x1="90"
              y1="70"
              x2="510"
              y2="70"
              stroke="#3b82f6"
              strokeDasharray="8 6"
            />
            {/* Breadboard tie points */}
            {[130, 190, 250, 310, 370, 430, 470].map((x) => (
              <g key={x}>
                <circle cx={x} cy="100" r="4" fill="var(--muted-foreground)" />
                <circle cx={x} cy="120" r="4" fill="var(--muted-foreground)" />
              </g>
            ))}
            {/* Active connection highlight */}
            <path
              d="M190 100 Q 250 80, 310 100"
              stroke="var(--primary)"
              strokeWidth="3.5"
            />
            <circle cx="190" cy="100" r="7" fill="var(--primary)" />
            <circle cx="310" cy="100" r="7" fill="var(--primary)" />
          </g>
          <g
            fill="currentColor"
            fontFamily="inherit"
            fontSize="14"
            textAnchor="middle"
          >
            <text x="300" y="24" fill="var(--muted-foreground)">
              Step {step + 1} Circuit Checkpoint
            </text>
            <text x="525" y="58" fill="#ef4444" fontSize="11">
              +V
            </text>
            <text x="525" y="73" fill="#3b82f6" fontSize="11">
              GND
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="step-visual-caption">
        Suggested wiring reference, not a wiring verification. Disconnect power
        before making changes.
      </figcaption>
    </figure>
  );
}
