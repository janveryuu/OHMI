import { describe, expect, it } from 'vitest';
import {
  calculateLedResistor,
  calculateOhmsLaw,
  calculateSeriesResistance,
  calculateParallelResistance,
  calculateResistorPower,
  formatResistance,
  formatCurrent,
  formatVoltage,
  formatPower,
  findNearestE12
} from './calculations';

describe('Deterministic Electronics Calculations', () => {
  describe('LED Current-Limiting Resistor', () => {
    it('accurately calculates 5V supply with 2V red LED and 220 ohm reference check', () => {
      // (5V - 2V) / 220Ω = 13.636... mA
      const res = calculateLedResistor({
        supplyVoltage: 5,
        forwardVoltage: 2,
        targetCurrent: 3 / 220 // ~0.01363636 A
      });

      expect(res.valid).toBe(true);
      expect(res.values.voltageDrop).toBe(3);
      expect(res.values.idealResistance).toBeCloseTo(220, 4);
      expect(res.values.recommendedE12).toBe(220);
      expect(res.formatted.idealResistance).toBe('220 Ω');
      expect(res.formatted.recommendedResistor).toBe('220 Ω');
      expect(res.formatted.actualCurrent).toBe('13.64 mA');
    });

    it('calculates for standard 5V, 2V LED, 15mA target', () => {
      const res = calculateLedResistor({
        supplyVoltage: 5,
        forwardVoltage: 2,
        targetCurrent: 0.015 // 15mA
      });

      expect(res.valid).toBe(true);
      expect(res.values.voltageDrop).toBe(3);
      expect(res.values.idealResistance).toBeCloseTo(200, 4);
      expect(res.values.recommendedE12).toBe(220); // 220 is closest E12
      expect(res.formatted.idealResistance).toBe('200 Ω');
      expect(res.formatted.recommendedResistor).toBe('220 Ω');
      expect(res.formatted.actualCurrent).toBe('13.64 mA');
      expect(res.formatted.powerDissipation).toBe('45 mW');
    });

    it('rejects Vf >= Vs or non-positive values', () => {
      expect(calculateLedResistor({ supplyVoltage: 3, forwardVoltage: 3.2, targetCurrent: 0.02 }).valid).toBe(false);
      expect(calculateLedResistor({ supplyVoltage: 5, forwardVoltage: 5, targetCurrent: 0.02 }).valid).toBe(false);
      expect(calculateLedResistor({ supplyVoltage: -5, forwardVoltage: 2, targetCurrent: 0.02 }).valid).toBe(false);
      expect(calculateLedResistor({ supplyVoltage: 5, forwardVoltage: -2, targetCurrent: 0.02 }).valid).toBe(false);
      expect(calculateLedResistor({ supplyVoltage: 5, forwardVoltage: 2, targetCurrent: 0 }).valid).toBe(false);
      expect(calculateLedResistor({ supplyVoltage: NaN, forwardVoltage: 2, targetCurrent: 0.02 }).valid).toBe(false);
    });
  });

  describe("Ohm's Law", () => {
    it('calculates V from I and R', () => {
      const res = calculateOhmsLaw({ current: 0.02, resistance: 220 });
      expect(res.valid).toBe(true);
      expect(res.values.voltage).toBeCloseTo(4.4, 4);
      expect(res.formatted.voltage).toBe('4.4 V');
    });

    it('calculates I from V and R', () => {
      const res = calculateOhmsLaw({ voltage: 5, resistance: 1000 });
      expect(res.valid).toBe(true);
      expect(res.values.current).toBe(0.005);
      expect(res.formatted.current).toBe('5 mA');
    });

    it('calculates R from V and I', () => {
      const res = calculateOhmsLaw({ voltage: 3.3, current: 0.01 });
      expect(res.valid).toBe(true);
      expect(res.values.resistance).toBe(330);
      expect(res.formatted.resistance).toBe('330 Ω');
    });

    it('rejects invalid operand counts or non-finite inputs', () => {
      expect(calculateOhmsLaw({ voltage: 5 }).valid).toBe(false);
      expect(calculateOhmsLaw({ voltage: 5, current: 0.01, resistance: 500 }).valid).toBe(false);
      expect(calculateOhmsLaw({ voltage: 5, resistance: 0 }).valid).toBe(false);
      expect(calculateOhmsLaw({ voltage: 5, resistance: -100 }).valid).toBe(false);
    });
  });

  describe('Series and Parallel Resistance', () => {
    it('calculates series resistance correctly', () => {
      const res = calculateSeriesResistance({ resistors: [220, 330, 470] });
      expect(res.valid).toBe(true);
      expect(res.values.totalResistance).toBe(1020);
      expect(res.formatted.totalResistance).toBe('1.02 kΩ');
    });

    it('calculates parallel resistance correctly', () => {
      // 1000Ω and 1000Ω in parallel = 500Ω
      const res = calculateParallelResistance({ resistors: [1000, 1000] });
      expect(res.valid).toBe(true);
      expect(res.values.totalResistance).toBe(500);
      expect(res.formatted.totalResistance).toBe('500 Ω');
    });

    it('rejects invalid series/parallel inputs', () => {
      expect(calculateSeriesResistance({ resistors: [100] }).valid).toBe(false);
      expect(calculateSeriesResistance({ resistors: [100, -50] }).valid).toBe(false);
      expect(calculateParallelResistance({ resistors: [100] }).valid).toBe(false);
      expect(calculateParallelResistance({ resistors: [100, 0] }).valid).toBe(false);
    });
  });

  describe('Power Dissipation', () => {
    it('calculates power from V and I', () => {
      const res = calculateResistorPower({ voltage: 5, current: 0.02 });
      expect(res.valid).toBe(true);
      expect(res.values.power).toBe(0.1);
      expect(res.formatted.power).toBe('100 mW');
    });

    it('calculates power from I and R (P = I²R)', () => {
      const res = calculateResistorPower({ current: 0.02, resistance: 220 });
      expect(res.valid).toBe(true);
      expect(res.values.power).toBeCloseTo(0.088, 5);
      expect(res.formatted.power).toBe('88 mW');
    });
  });

  describe('Unit Formatting & E12 Series', () => {
    it('formats units correctly without duplicate unit suffixes', () => {
      expect(formatResistance(220)).toBe('220 Ω');
      expect(formatResistance(4700)).toBe('4.7 kΩ');
      expect(formatResistance(1000000)).toBe('1 MΩ');

      expect(formatCurrent(0.015)).toBe('15 mA');
      expect(formatCurrent(0.00005)).toBe('50 µA');
      expect(formatCurrent(1.5)).toBe('1.5 A');

      expect(formatVoltage(5)).toBe('5 V');
      expect(formatVoltage(3.3)).toBe('3.3 V');
    });

    it('finds nearest E12 resistor accurately', () => {
      expect(findNearestE12(195)).toBe(180); // or 220 depending on distance
      expect(findNearestE12(215)).toBe(220);
      expect(findNearestE12(980)).toBe(1000);
      expect(findNearestE12(4600)).toBe(4700);
    });
  });
});
