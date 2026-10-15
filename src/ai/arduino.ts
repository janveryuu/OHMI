/**
 * Arduino Reference Registry and Sketch Validator for OHMI.
 * Primary reference: Arduino UNO Rev3 (ATmega328P) official documentation.
 */

export interface BoardSpec {
  name: string;
  microcontroller: string;
  operatingVoltage: number;    // Volts
  inputVoltageRecommended: [number, number]; // [min, max] Volts
  digitalIOPins: number;
  pwmPins: number[];
  analogInputPins: string[];
  maxCurrentPerIOPin: number;  // mA recommended
  absoluteMaxCurrentPerIOPin: number; // mA
  maxTotalCurrent: number;     // mA total Vcc/GND
  builtInLedPin: number;
  docUrl: string;
  checkedDate: string;
}

export const ARDUINO_BOARDS: Record<string, BoardSpec> = {
  'uno-r3': {
    name: 'Arduino Uno Rev3',
    microcontroller: 'ATmega328P',
    operatingVoltage: 5.0,
    inputVoltageRecommended: [7.0, 12.0],
    digitalIOPins: 14, // 0 to 13
    pwmPins: [3, 5, 6, 9, 10, 11],
    analogInputPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    maxCurrentPerIOPin: 20, // 20 mA continuous
    absoluteMaxCurrentPerIOPin: 40, // 40 mA peak damage threshold
    maxTotalCurrent: 200, // 200 mA through microcontroller package
    builtInLedPin: 13,
    docUrl: 'https://docs.arduino.cc/hardware/uno-rev3/',
    checkedDate: '2026-10-15'
  }
};

export interface SketchValidationOptions {
  board?: string;
  expectedPin?: number;
  requireSetupAndLoop?: boolean;
}

export interface SketchValidationResult {
  valid: boolean;
  hasSetup: boolean;
  hasLoop: boolean;
  pinModes: Array<{ pin: number | string; mode: string }>;
  digitalWrites: Array<{ pin: number | string; value: string }>;
  delays: number[];
  warnings: string[];
  error?: string;
}

/**
 * Validates basic Arduino C++ sketch structure against educational requirements.
 */
export function validateArduinoSketch(code: string, options: SketchValidationOptions = {}): SketchValidationResult {
  const { board = 'uno-r3', expectedPin, requireSetupAndLoop = true } = options;
  const boardSpec = ARDUINO_BOARDS[board] ?? ARDUINO_BOARDS['uno-r3']!;

  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip multi-line comments
    .replace(/\/\/.*$/gm, '');        // strip single-line comments

  const hasSetup = /\bvoid\s+setup\s*\(\s*\)/.test(cleanCode);
  const hasLoop = /\bvoid\s+loop\s*\(\s*\)/.test(cleanCode);

  const warnings: string[] = [];

  if (requireSetupAndLoop) {
    if (!hasSetup) warnings.push('Missing void setup() function.');
    if (!hasLoop) warnings.push('Missing void loop() function.');
  }

  // Extract pin variable definitions like "const int ledPin = 13;" or "#define LED 13"
  const pinConstants: Record<string, number> = {};
  const constRegex = /(?:const\s+(?:int|byte|uint8_t)\s+([A-Za-z0-9_]+)\s*=\s*(\d+)|#define\s+([A-Za-z0-9_]+)\s+(\d+))/g;
  let defMatch: RegExpExecArray | null;
  while ((defMatch = constRegex.exec(cleanCode)) !== null) {
    const name = defMatch[1] || defMatch[3];
    const rawVal = defMatch[2] || defMatch[4];
    if (name && rawVal) {
      const val = parseInt(rawVal, 10);
      if (!isNaN(val)) pinConstants[name] = val;
    }
  }

  // Extract pinMode declarations
  const pinModes: Array<{ pin: number | string; mode: string }> = [];
  const pinModeRegex = /\bpinMode\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pinModeRegex.exec(cleanCode)) !== null) {
    const rawPin = match[1] ?? '';
    const mode = match[2] ?? '';
    const resolved = pinConstants[rawPin] !== undefined
      ? pinConstants[rawPin]!
      : (/^\d+$/.test(rawPin) ? parseInt(rawPin, 10) : rawPin);
    pinModes.push({ pin: resolved, mode });
  }

  // Extract digitalWrite calls
  const digitalWrites: Array<{ pin: number | string; value: string }> = [];
  const digitalWriteRegex = /\bdigitalWrite\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  while ((match = digitalWriteRegex.exec(cleanCode)) !== null) {
    const rawPin = match[1] ?? '';
    const value = match[2] ?? '';
    const resolved = pinConstants[rawPin] !== undefined
      ? pinConstants[rawPin]!
      : (/^\d+$/.test(rawPin) ? parseInt(rawPin, 10) : rawPin);
    digitalWrites.push({ pin: resolved, value });
  }

  // Extract delay calls (ms)
  const delays: number[] = [];
  const delayRegex = /\bdelay\s*\(\s*(\d+)\s*\)/g;
  while ((match = delayRegex.exec(cleanCode)) !== null) {
    if (match[1]) delays.push(parseInt(match[1], 10));
  }

  // Check expected pin if provided
  if (expectedPin !== undefined) {
    const pinConfigured = pinModes.some(p => p.pin === expectedPin || p.pin === `LED_BUILTIN` && expectedPin === boardSpec.builtInLedPin);
    if (!pinConfigured) {
      warnings.push(`Expected pin ${expectedPin} to be configured with pinMode() in setup().`);
    }
  }

  // Check for pins 0 and 1 usage (Serial TX/RX)
  const usesSerialPins = pinModes.some(p => p.pin === 0 || p.pin === 1) || digitalWrites.some(p => p.pin === 0 || p.pin === 1);
  if (usesSerialPins) {
    warnings.push('Pins 0 and 1 are used for Serial communication (RX/TX); using them for LEDs or sensors can disrupt uploading or serial debugging.');
  }

  const valid = (!requireSetupAndLoop || (hasSetup && hasLoop)) && warnings.length === 0;

  return {
    valid,
    hasSetup,
    hasLoop,
    pinModes,
    digitalWrites,
    delays,
    warnings
  };
}
