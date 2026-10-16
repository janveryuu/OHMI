import { describe, it, expect } from 'vitest';
import {
  validateCircuitRequest,
  validateCircuitResult,
  validateEvidenceReference
} from './circuit.ts';
import type { CircuitEvidence } from '../../../src/backend/contracts.ts';

const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const baseValidRequest = () => ({
  version: 2,
  operation: 'circuit_check',
  requestId: '11111111-1111-4111-8111-111111111111',
  language: 'english',
  mode: 'check',
  message: 'Please review this circuit wiring and resistor values.',
  images: [
    {
      id: 'overview',
      mimeType: 'image/png',
      data: VALID_PNG_BASE64
    }
  ],
  code: 'void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n}\n',
  board: 'uno-r3',
  simulation: 'Serial output: circuit active'
});

const baseEvidence = (): CircuitEvidence => ({
  imageIds: ['overview'],
  codeLineCount: 6,
  requirementIds: ['req-1', 'req-2'],
  simulationText: 'Serial output: circuit active'
});

const baseValidResult = () => ({
  schemaVersion: 2,
  status: 'reviewed',
  summary: 'Circuit evidence inspected. LED series resistor is present with correct polarity.',
  findings: [
    {
      id: 'finding-1',
      severity: 'info',
      certainty: 'observed',
      observation: 'LED anode connects to pin 13 via 220 ohm resistor.',
      why: 'Current-limiting protects the LED from overcurrent.',
      action: 'Check that resistor value matches your LED voltage drop.',
      evidence: [
        { kind: 'image', imageId: 'overview', location: 'Breadboard column E rows 10-15' },
        { kind: 'code', startLine: 2, endLine: 2 }
      ]
    }
  ],
  unknowns: ['Resistor tolerance cannot be verified from image.'],
  questions: ['Are you using a red or blue LED?'],
  comparisons: [
    {
      requirementId: 'req-1',
      status: 'supported',
      explanation: 'Pin 13 connection is visible.',
      evidence: [{ kind: 'code', startLine: 2, endLine: 2 }]
    }
  ],
  steps: [
    {
      step: 1,
      instruction: 'Verify the LED resistor resistance before starting simulation.',
      why: 'Ensures current remains within safe limits.',
      check: 'Check colored bands or simulator component value.',
      findingId: 'finding-1'
    }
  ],
  limitations: ['Image review does not constitute electrical verification.']
});

describe('Circuit Check Request Validation (Version 2)', () => {
  it('accepts a valid check request with image, code, and simulation', () => {
    const req = baseValidRequest();
    const validated = validateCircuitRequest(req);
    expect(validated.version).toBe(2);
    expect(validated.operation).toBe('circuit_check');
    expect(validated.requestId).toBe('11111111-1111-4111-8111-111111111111');
    expect(validated.images.length).toBe(1);
  });

  it('rejects non-object or missing body', () => {
    expect(() => validateCircuitRequest(null)).toThrow(/body must be a JSON object/);
    expect(() => validateCircuitRequest([])).toThrow(/body must be a JSON object/);
    expect(() => validateCircuitRequest('string')).toThrow(/body must be a JSON object/);
  });

  it('rejects unknown request fields', () => {
    const req = { ...baseValidRequest(), maliciousField: 'hack' };
    expect(() => validateCircuitRequest(req)).toThrow(/unknown field "maliciousField"/);
  });

  it('rejects unsupported version or operation', () => {
    expect(() => validateCircuitRequest({ ...baseValidRequest(), version: 1 })).toThrow(/Expected version 2/);
    expect(() => validateCircuitRequest({ ...baseValidRequest(), operation: 'chat' })).toThrow(/Expected "circuit_check"/);
  });

  it('rejects invalid requestId', () => {
    expect(() => validateCircuitRequest({ ...baseValidRequest(), requestId: 'not-a-uuid' })).toThrow(/valid UUID requestId/);
  });

  it('rejects invalid language or board', () => {
    expect(() => validateCircuitRequest({ ...baseValidRequest(), language: 'spanish' })).toThrow(/Invalid language/);
    expect(() => validateCircuitRequest({ ...baseValidRequest(), board: 'mega2560' })).toThrow(/Invalid board/);
  });

  it('rejects empty or oversized message', () => {
    expect(() => validateCircuitRequest({ ...baseValidRequest(), message: '' })).toThrow(/Message must be/);
    expect(() => validateCircuitRequest({ ...baseValidRequest(), message: 'a'.repeat(2001) })).toThrow(/Message must be/);
  });

  it('rejects malformed or data URL base64', () => {
    const dataUrlReq = {
      ...baseValidRequest(),
      images: [{ id: 'overview', mimeType: 'image/png', data: `data:image/png;base64,${VALID_PNG_BASE64}` }]
    };
    expect(() => validateCircuitRequest(dataUrlReq)).toThrow(/raw base64, not a data URL/);

    const malformedReq = {
      ...baseValidRequest(),
      images: [{ id: 'overview', mimeType: 'image/png', data: 'not-valid-base64!' }]
    };
    expect(() => validateCircuitRequest(malformedReq)).toThrow(/Malformed base64/);
  });

  it('rejects duplicate image IDs', () => {
    const req = {
      ...baseValidRequest(),
      images: [
        { id: 'overview', mimeType: 'image/png', data: VALID_PNG_BASE64 },
        { id: 'overview', mimeType: 'image/png', data: VALID_PNG_BASE64 }
      ]
    };
    expect(() => validateCircuitRequest(req)).toThrow(/Duplicate image id "overview"/);
  });

  it('rejects check request with no visual evidence and no code', () => {
    const req = {
      ...baseValidRequest(),
      images: [],
      code: ''
    };
    expect(() => validateCircuitRequest(req)).toThrow(/requires visual evidence \(screenshot\) or Arduino code/);
  });

  it('accepts code-only check request', () => {
    const req = {
      ...baseValidRequest(),
      images: [],
      code: 'void setup() {}'
    };
    const validated = validateCircuitRequest(req);
    expect(validated.images.length).toBe(0);
    expect(validated.code).toBe('void setup() {}');
  });

  it('rejects follow-up mode with new images or missing previousCheckId', () => {
    // Missing previousCheckId
    expect(() => validateCircuitRequest({
      ...baseValidRequest(),
      mode: 'follow_up',
      images: []
    })).toThrow(/Follow-up mode requires a valid UUID previousCheckId/);

    // Follow-up carrying images
    expect(() => validateCircuitRequest({
      ...baseValidRequest(),
      mode: 'follow_up',
      previousCheckId: '22222222-2222-4222-8222-222222222222',
      images: [{ id: 'overview', mimeType: 'image/png', data: VALID_PNG_BASE64 }]
    })).toThrow(/Follow-up requests cannot include new images/);
  });

  it('enforces assignment comparison mutual exclusivity', () => {
    // Supplying both assignment artifacts and requirementText
    expect(() => validateCircuitRequest({
      ...baseValidRequest(),
      assignmentId: '33333333-3333-4333-8333-333333333333',
      assignmentAnalysisId: '44444444-4444-4444-8444-444444444444',
      requirementText: 'Connect LED to pin 13'
    })).toThrow(/either assignment artifacts or requirementText, not both/);

    // assignmentId without assignmentAnalysisId
    expect(() => validateCircuitRequest({
      ...baseValidRequest(),
      assignmentId: '33333333-3333-4333-8333-333333333333'
    })).toThrow(/assignmentAnalysisId is required/);
  });
});

describe('Circuit Check Result Validation (Version 2)', () => {
  it('accepts a valid reviewed result with verified evidence references', () => {
    const res = baseValidResult();
    const validated = validateCircuitResult(res, baseEvidence());
    expect(validated.schemaVersion).toBe(2);
    expect(validated.status).toBe('reviewed');
    expect(validated.findings.length).toBe(1);
    expect(validated.steps.length).toBe(1);
  });

  it('rejects unknown top-level result fields', () => {
    const res = { ...baseValidResult(), unexpectedExtra: true };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/Unknown key in circuit check result: "unexpectedExtra"/);
  });

  it('rejects status unsupported with non-empty findings or steps', () => {
    const res = {
      ...baseValidResult(),
      status: 'unsupported',
      findings: [{
        id: 'f-1',
        severity: 'info',
        certainty: 'observed',
        observation: 'x',
        why: 'y',
        action: 'z',
        evidence: [{ kind: 'image', imageId: 'overview', location: 'loc' }]
      }]
    };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/Status "unsupported" must have empty findings/);
  });

  it('rejects status needs_clarification without clarification questions', () => {
    const res = {
      ...baseValidResult(),
      status: 'needs_clarification',
      questions: [],
      steps: []
    };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/requires at least one clarification question/);
  });

  it('rejects code evidence reference overflowing supplied code lines', () => {
    const res = {
      ...baseValidResult(),
      findings: [
        {
          id: 'finding-1',
          severity: 'info',
          certainty: 'observed',
          observation: 'obs',
          why: 'why',
          action: 'act',
          evidence: [
            // Line 99 exceeds codeLineCount (6)
            { kind: 'code', startLine: 1, endLine: 99 }
          ]
        }
      ]
    };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/exceeds supplied source line count/);
  });

  it('rejects code evidence reference with range > 20 lines', () => {
    const evidenceWithBigCode: CircuitEvidence = {
      ...baseEvidence(),
      codeLineCount: 100
    };
    const res = {
      ...baseValidResult(),
      findings: [
        {
          id: 'finding-1',
          severity: 'info',
          certainty: 'observed',
          observation: 'obs',
          why: 'why',
          action: 'act',
          evidence: [
            { kind: 'code', startLine: 1, endLine: 35 } // 34 lines > 20 lines
          ]
        }
      ]
    };
    expect(() => validateCircuitResult(res, evidenceWithBigCode)).toThrow(/range cannot exceed 20 lines/);
  });

  it('rejects simulation excerpt not found in supplied diagnostics', () => {
    const res = {
      ...baseValidResult(),
      findings: [
        {
          id: 'finding-1',
          severity: 'info',
          certainty: 'observed',
          observation: 'obs',
          why: 'why',
          action: 'act',
          evidence: [
            { kind: 'simulation', excerpt: 'Nonexistent compiler error 404' }
          ]
        }
      ]
    };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/is not found in supplied simulation output/);
  });

  it('rejects comparison referencing unknown requirementId', () => {
    const res = {
      ...baseValidResult(),
      comparisons: [
        {
          requirementId: 'unknown-req-999',
          status: 'supported',
          explanation: 'expl',
          evidence: []
        }
      ]
    };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/references unknown requirementId "unknown-req-999"/);
  });

  it('rejects non-sequential step numbering', () => {
    const res = {
      ...baseValidResult(),
      steps: [
        { step: 2, instruction: 'inst', why: 'why', check: 'check' } // Expected step 1, not 2
      ]
    };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/Step index must be sequential 1-based/);
  });

  it('rejects step referencing unknown findingId', () => {
    const res = {
      ...baseValidResult(),
      steps: [
        { step: 1, instruction: 'inst', why: 'why', check: 'check', findingId: 'nonexistent-finding' }
      ]
    };
    expect(() => validateCircuitResult(res, baseEvidence())).toThrow(/references unknown findingId "nonexistent-finding"/);
  });

  it('rejects more than 6 findings or more than 8 steps', () => {
    const resWith7Findings = {
      ...baseValidResult(),
      findings: Array.from({ length: 7 }, (_, i) => ({
        id: `f-${i}`,
        severity: 'info',
        certainty: 'observed',
        observation: 'obs',
        why: 'why',
        action: 'act',
        evidence: [{ kind: 'image', imageId: 'overview', location: 'loc' }]
      }))
    };
    expect(() => validateCircuitResult(resWith7Findings, baseEvidence())).toThrow(/findings must be an array of at most 6 entries/);
  });
});
