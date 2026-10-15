import { describe, expect, it } from 'vitest';
import { ARDUINO_BOARDS, validateArduinoSketch } from './arduino';

describe('Arduino Reference Registry and Sketch Validator', () => {
  it('has verified Arduino Uno Rev3 specifications', () => {
    const uno = ARDUINO_BOARDS['uno-r3']!;
    expect(uno.operatingVoltage).toBe(5.0);
    expect(uno.digitalIOPins).toBe(14);
    expect(uno.pwmPins).toEqual([3, 5, 6, 9, 10, 11]);
    expect(uno.maxCurrentPerIOPin).toBe(20);
    expect(uno.absoluteMaxCurrentPerIOPin).toBe(40);
    expect(uno.builtInLedPin).toBe(13);
  });

  it('validates a correct Arduino blink sketch', () => {
    const code = `
      // Standard LED Blink
      const int ledPin = 13;
      void setup() {
        pinMode(ledPin, OUTPUT);
      }
      void loop() {
        digitalWrite(ledPin, HIGH);
        delay(1000);
        digitalWrite(ledPin, LOW);
        delay(1000);
      }
    `;

    const result = validateArduinoSketch(code, { expectedPin: 13 });
    expect(result.valid).toBe(true);
    expect(result.hasSetup).toBe(true);
    expect(result.hasLoop).toBe(true);
    expect(result.delays).toEqual([1000, 1000]);
    expect(result.warnings).toHaveLength(0);
  });

  it('detects missing setup or loop functions', () => {
    const missingLoop = `
      void setup() {
        pinMode(13, OUTPUT);
      }
    `;
    const res = validateArduinoSketch(missingLoop);
    expect(res.valid).toBe(false);
    expect(res.hasSetup).toBe(true);
    expect(res.hasLoop).toBe(false);
    expect(res.warnings).toContain('Missing void loop() function.');
  });

  it('warns about using pins 0 and 1 for regular I/O', () => {
    const code = `
      void setup() {
        pinMode(0, OUTPUT);
      }
      void loop() {
        digitalWrite(0, HIGH);
      }
    `;
    const res = validateArduinoSketch(code);
    expect(res.valid).toBe(false);
    expect(res.warnings.some(w => w.includes('Serial'))).toBe(true);
  });
});
