/**
 * Arduino Reference Registry & Verification rules for OHMI tutoring.
 * Hardware reference: Arduino UNO Rev3 (ATmega328P).
 */

export interface BoardSpec {
  name: string;
  microcontroller: string;
  operatingVoltage: number;    // 5V
  inputVoltageRecommended: [number, number]; // [7, 12]V
  digitalIoPins: number;        // 14
  pwmPins: number[];            // [3, 5, 6, 9, 10, 11]
  analogInputPins: number;      // 6 (A0-A5)
  dcCurrentPerIoPinMaxMa: number; // 20mA (40mA absolute max)
  dcCurrent3v3PinMa: number;    // 50mA
  serialPins: { rx: number; tx: number }; // { rx: 0, tx: 1 }
  builtInLedPin: number;        // 13
}

export const ARDUINO_UNO_R3: BoardSpec = {
  name: 'Arduino Uno R3',
  microcontroller: 'ATmega328P',
  operatingVoltage: 5.0,
  inputVoltageRecommended: [7.0, 12.0],
  digitalIoPins: 14,
  pwmPins: [3, 5, 6, 9, 10, 11],
  analogInputPins: 6,
  dcCurrentPerIoPinMaxMa: 20.0,
  dcCurrent3v3PinMa: 50.0,
  serialPins: { rx: 0, tx: 1 },
  builtInLedPin: 13
};

export interface SketchValidationResult {
  valid: boolean;
  hasSetup: boolean;
  hasLoop: boolean;
  warnings: string[];
  declaredPins: number[];
}

export function validateArduinoSketch(code: string): SketchValidationResult {
  if (!code || typeof code !== 'string') {
    return { valid: false, hasSetup: false, hasLoop: false, warnings: ['Empty or invalid code provided'], declaredPins: [] };
  }

  const hasSetup = /void\s+setup\s*\(\s*\)/.test(code);
  const hasLoop = /void\s+loop\s*\(\s*\)/.test(code);
  const warnings: string[] = [];

  if (!hasSetup) {
    warnings.push('Missing void setup() function.');
  }
  if (!hasLoop) {
    warnings.push('Missing void loop() function.');
  }

  const declaredPins: number[] = [];
  const pinModeMatches = code.matchAll(/pinMode\s*\(\s*(\d+|[A-Z0-9_]+)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)/g);
  for (const m of pinModeMatches) {
    const pinStr = m[1]!;
    const pinNum = parseInt(pinStr, 10);
    if (!isNaN(pinNum)) {
      declaredPins.push(pinNum);
      if (pinNum === 0 || pinNum === 1) {
        warnings.push(`Pin ${pinNum} is used for Serial communication (RX/TX). Using it for GPIO may interfere with USB programming or Serial debugging.`);
      }
    }
  }

  const digitalWriteMatches = code.matchAll(/digitalWrite\s*\(\s*(\d+|[A-Z0-9_]+)\s*,/g);
  for (const m of digitalWriteMatches) {
    const pinNum = parseInt(m[1]!, 10);
    if (!isNaN(pinNum) && (pinNum === 0 || pinNum === 1) && !warnings.some(w => w.includes(`Pin ${pinNum}`))) {
      warnings.push(`Pin ${pinNum} is used for Serial communication (RX/TX). Using it for GPIO may interfere with USB programming or Serial debugging.`);
    }
  }

  return {
    valid: hasSetup && hasLoop,
    hasSetup,
    hasLoop,
    warnings,
    declaredPins
  };
}
