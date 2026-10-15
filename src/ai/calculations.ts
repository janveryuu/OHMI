/**
 * Pure deterministic engineering calculations for OHMI electronics tutoring.
 * All internal math uses standard SI base units (Volts, Amperes, Ohms, Watts).
 */

export type CalculationType = 'ohms_law' | 'led_resistor' | 'series_resistance' | 'parallel_resistance' | 'resistor_power';

export interface OhmsLawInput {
  voltage?: number;    // V
  current?: number;    // A
  resistance?: number; // Ω
}

export interface LedResistorInput {
  supplyVoltage: number;    // Vs in Volts
  forwardVoltage: number;   // Vf in Volts
  targetCurrent: number;    // I in Amperes (e.g. 0.015 for 15mA)
}

export interface ResistanceInput {
  resistors: number[];      // Array of resistances in Ohms
}

export interface ResistorPowerInput {
  voltage?: number;         // V
  current?: number;         // A
  resistance?: number;      // Ω
}

export interface CalculationResult {
  operation: CalculationType;
  valid: boolean;
  values: Record<string, number>;
  formatted: Record<string, string>;
  notes?: string;
  error?: string;
}

export function formatResistance(ohms: number): string {
  if (!Number.isFinite(ohms) || ohms < 0) return 'Invalid';
  if (ohms >= 1_000_000) return `${(ohms / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} MΩ`;
  if (ohms >= 1_000) return `${(ohms / 1_000).toFixed(2).replace(/\.?0+$/, '')} kΩ`;
  return `${ohms.toFixed(2).replace(/\.?0+$/, '')} Ω`;
}

export function formatCurrent(amperes: number): string {
  if (!Number.isFinite(amperes) || amperes < 0) return 'Invalid';
  if (amperes >= 1) return `${amperes.toFixed(3).replace(/\.?0+$/, '')} A`;
  if (amperes >= 0.001) return `${(amperes * 1_000).toFixed(2).replace(/\.?0+$/, '')} mA`;
  return `${(amperes * 1_000_000).toFixed(2).replace(/\.?0+$/, '')} µA`;
}

export function formatVoltage(volts: number): string {
  if (!Number.isFinite(volts)) return 'Invalid';
  return `${volts.toFixed(2).replace(/\.?0+$/, '')} V`;
}

export function formatPower(watts: number): string {
  if (!Number.isFinite(watts) || watts < 0) return 'Invalid';
  if (watts >= 1) return `${watts.toFixed(3).replace(/\.?0+$/, '')} W`;
  return `${(watts * 1_000).toFixed(2).replace(/\.?0+$/, '')} mW`;
}

/**
 * Standard E12 resistor series (multipliers from 1Ω up to 10MΩ).
 */
export const E12_VALUES = [
  1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2
];

export function findNearestE12(targetOhms: number, preferHigher = false): number {
  if (!Number.isFinite(targetOhms) || targetOhms <= 0) return 0;
  const exponent = Math.floor(Math.log10(targetOhms));
  const base = targetOhms / Math.pow(10, exponent);

  let closest: number = E12_VALUES[0]!;
  let minDiff = Infinity;

  for (const val of E12_VALUES) {
    const diff = Math.abs(base - val);
    if (diff < minDiff || (preferHigher && Math.abs(diff - minDiff) < 1e-9 && val > closest)) {
      minDiff = diff;
      closest = val;
    }
  }

  // Handle case where target is close to 10 * 10^exponent
  const diffToNextDecade = Math.abs(base - 10);
  let res = closest * Math.pow(10, exponent);
  if (diffToNextDecade < minDiff) {
    res = 10 * Math.pow(10, exponent);
  }

  // Clean floating point rounding errors e.g. 2.2 * 100 = 220.00000000000003
  return Number(res.toPrecision(7));
}

/**
 * Calculate single LED current-limiting resistor:
 * R = (Vs - Vf) / I
 */
export function calculateLedResistor(input: LedResistorInput): CalculationResult {
  const { supplyVoltage: Vs, forwardVoltage: Vf, targetCurrent: I } = input;

  if (!Number.isFinite(Vs) || !Number.isFinite(Vf) || !Number.isFinite(I)) {
    return { operation: 'led_resistor', valid: false, values: {}, formatted: {}, error: 'All inputs must be finite numbers' };
  }
  if (Vs <= 0) {
    return { operation: 'led_resistor', valid: false, values: {}, formatted: {}, error: 'Supply voltage must be positive' };
  }
  if (Vf <= 0) {
    return { operation: 'led_resistor', valid: false, values: {}, formatted: {}, error: 'LED forward voltage must be positive' };
  }
  if (Vf >= Vs) {
    return { operation: 'led_resistor', valid: false, values: {}, formatted: {}, error: 'Supply voltage must be greater than LED forward voltage' };
  }
  if (I <= 0) {
    return { operation: 'led_resistor', valid: false, values: {}, formatted: {}, error: 'Target current must be positive' };
  }

  const voltageDrop = Vs - Vf;
  const resistance = voltageDrop / I;
  const power = I * I * resistance;
  const recommendedE12 = findNearestE12(resistance, true);
  const actualCurrentWithE12 = voltageDrop / recommendedE12;

  return {
    operation: 'led_resistor',
    valid: true,
    values: {
      supplyVoltage: Vs,
      forwardVoltage: Vf,
      voltageDrop,
      targetCurrent: I,
      idealResistance: resistance,
      recommendedE12,
      actualCurrent: actualCurrentWithE12,
      resistorPower: power
    },
    formatted: {
      voltageDrop: formatVoltage(voltageDrop),
      idealResistance: formatResistance(resistance),
      recommendedResistor: formatResistance(recommendedE12),
      actualCurrent: formatCurrent(actualCurrentWithE12),
      powerDissipation: formatPower(power)
    },
    notes: `With a ${formatVoltage(Vs)} supply and ${formatVoltage(Vf)} LED forward voltage, the resistor drops ${formatVoltage(voltageDrop)}. Ideal resistance is ${formatResistance(resistance)}. Nearest standard resistor is ${formatResistance(recommendedE12)} (yielding ${formatCurrent(actualCurrentWithE12)}).`
  };
}

/**
 * Calculate Ohm's law: V = I * R
 * Provide any 2 to find the 3rd.
 */
export function calculateOhmsLaw(input: OhmsLawInput): CalculationResult {
  const { voltage: V, current: I, resistance: R } = input;
  const provided = [V !== undefined, I !== undefined, R !== undefined].filter(Boolean).length;

  if (provided !== 2) {
    return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Exactly two of Voltage, Current, or Resistance must be provided' };
  }

  let calcV = V;
  let calcI = I;
  let calcR = R;

  if (V !== undefined && I !== undefined) {
    if (!Number.isFinite(V) || !Number.isFinite(I)) {
      return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Operands must be finite numbers' };
    }
    if (I === 0) {
      if (V === 0) {
        return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Indeterminate resistance for zero voltage and zero current' };
      }
      return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Resistance is infinite for zero current with non-zero voltage (open circuit)' };
    }
    calcR = Math.abs(V / I);
  } else if (V !== undefined && R !== undefined) {
    if (!Number.isFinite(V) || !Number.isFinite(R)) {
      return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Operands must be finite numbers' };
    }
    if (R <= 0) {
      return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Resistance must be positive' };
    }
    calcI = V / R;
  } else if (I !== undefined && R !== undefined) {
    if (!Number.isFinite(I) || !Number.isFinite(R)) {
      return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Operands must be finite numbers' };
    }
    if (R <= 0) {
      return { operation: 'ohms_law', valid: false, values: {}, formatted: {}, error: 'Resistance must be positive' };
    }
    calcV = I * R;
  }

  const p = Math.abs((calcV ?? 0) * (calcI ?? 0));

  return {
    operation: 'ohms_law',
    valid: true,
    values: {
      voltage: calcV!,
      current: calcI!,
      resistance: calcR!,
      power: p
    },
    formatted: {
      voltage: formatVoltage(calcV!),
      current: formatCurrent(calcI!),
      resistance: formatResistance(calcR!),
      power: formatPower(p)
    }
  };
}

/**
 * Series resistance: Rs = R1 + R2 + ... + Rn
 */
export function calculateSeriesResistance(input: ResistanceInput): CalculationResult {
  const { resistors } = input;
  if (!Array.isArray(resistors) || resistors.length < 2) {
    return { operation: 'series_resistance', valid: false, values: {}, formatted: {}, error: 'At least two resistors required' };
  }
  for (const r of resistors) {
    if (!Number.isFinite(r) || r < 0) {
      return { operation: 'series_resistance', valid: false, values: {}, formatted: {}, error: 'Resistor values must be non-negative finite numbers' };
    }
  }

  const total = resistors.reduce((sum, r) => sum + r, 0);

  return {
    operation: 'series_resistance',
    valid: true,
    values: { totalResistance: total, count: resistors.length },
    formatted: { totalResistance: formatResistance(total) },
    notes: `Series equivalent of ${resistors.map(formatResistance).join(' + ')} = ${formatResistance(total)}`
  };
}

/**
 * Parallel resistance: 1/Rp = 1/R1 + 1/R2 + ... + 1/Rn
 */
export function calculateParallelResistance(input: ResistanceInput): CalculationResult {
  const { resistors } = input;
  if (!Array.isArray(resistors) || resistors.length < 2) {
    return { operation: 'parallel_resistance', valid: false, values: {}, formatted: {}, error: 'At least two resistors required' };
  }
  for (const r of resistors) {
    if (!Number.isFinite(r) || r <= 0) {
      return { operation: 'parallel_resistance', valid: false, values: {}, formatted: {}, error: 'Parallel resistor values must be positive non-zero numbers' };
    }
  }

  const sumInverse = resistors.reduce((sum, r) => sum + (1 / r), 0);
  const total = 1 / sumInverse;

  return {
    operation: 'parallel_resistance',
    valid: true,
    values: { totalResistance: total, count: resistors.length },
    formatted: { totalResistance: formatResistance(total) },
    notes: `Parallel equivalent of [${resistors.map(formatResistance).join(', ')}] = ${formatResistance(total)}`
  };
}

/**
 * Resistor power dissipation: P = V * I = I² * R = V² / R
 */
export function calculateResistorPower(input: ResistorPowerInput): CalculationResult {
  const { voltage: V, current: I, resistance: R } = input;
  let power: number | undefined;

  if (V !== undefined && I !== undefined && Number.isFinite(V) && Number.isFinite(I)) {
    power = Math.abs(V * I);
  } else if (I !== undefined && R !== undefined && Number.isFinite(I) && Number.isFinite(R) && R >= 0) {
    power = I * I * R;
  } else if (V !== undefined && R !== undefined && Number.isFinite(V) && Number.isFinite(R) && R > 0) {
    power = (V * V) / R;
  }

  if (power === undefined || !Number.isFinite(power)) {
    return { operation: 'resistor_power', valid: false, values: {}, formatted: {}, error: 'Invalid operands for power calculation' };
  }

  return {
    operation: 'resistor_power',
    valid: true,
    values: { power },
    formatted: { power: formatPower(power) }
  };
}
