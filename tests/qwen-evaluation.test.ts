import { describe, it, expect } from 'vitest';
import qwenManifest from './fixtures/qwen/manifest.json';
import { extractTutorialJson, validateTutorialResult } from '../supabase/functions/ohmi-ai/tutorial.ts';
import { validateCircuitResult, validateCircuitRequest } from '../supabase/functions/ohmi-ai/circuit.ts';
import { calculateLedResistor } from '../supabase/functions/ohmi-ai/calculations.ts';
import type { CircuitEvidence } from '../src/backend/contracts.ts';

describe('Milestone Q1: Offline Qwen Evaluation Fixtures and Matrix Qualification', () => {
  it('contains exactly 12 synthetic evaluation cases', () => {
    expect(qwenManifest.totalCases).toBe(12);
    expect(qwenManifest.fixtures).toHaveLength(12);
  });

  it('adheres to balanced language distribution (4 English, 4 Filipino, 4 Taglish)', () => {
    const counts: Record<string, number> = { english: 0, filipino: 0, taglish: 0 };
    for (const f of qwenManifest.fixtures) {
      counts[f.language] = (counts[f.language] || 0) + 1;
    }
    expect(counts.english).toBe(4);
    expect(counts.filipino).toBe(4);
    expect(counts.taglish).toBe(4);
  });

  it('strictly enforces zero claims of electrical verification across all mock responses', () => {
    const forbiddenPatterns = [
      /electrically verified/i,
      /certified safe/i,
      /hardware compiled/i,
      /certified circuit schematic/i
    ];

    for (const f of qwenManifest.fixtures) {
      const content = f.mockQwenResponse.choices[0]!.message.content;
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });

  it('qualifies tutorial fixtures against strict tutorial schema validator', () => {
    const tutorialFixtures = qwenManifest.fixtures.filter(f => f.operation === 'tutorial');
    expect(tutorialFixtures.length).toBeGreaterThanOrEqual(3);

    for (const f of tutorialFixtures) {
      const rawText = f.mockQwenResponse.choices[0]!.message.content;
      const parsed = extractTutorialJson(rawText);
      expect(parsed).not.toBeNull();
      const val = validateTutorialResult(parsed);
      expect(val.valid).toBe(true);
      expect(val.result).toBeDefined();
      expect(val.result?.status).toBe('tutorial');
      expect(val.result?.steps?.length).toBeGreaterThan(0);
      for (const step of val.result!.steps!) {
        expect(step.instruction.trim().length).toBeGreaterThan(0);
        expect(step.why.trim().length).toBeGreaterThan(0);
        expect(step.check.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('qualifies circuit_check fixtures against strict V2 circuit check validator', () => {
    const circuitFixtures = qwenManifest.fixtures.filter(f => f.operation === 'circuit_check');
    expect(circuitFixtures.length).toBeGreaterThanOrEqual(3);

    for (const f of circuitFixtures) {
      const req = validateCircuitRequest(f.request);
      expect(req.version).toBe(2);
      expect(req.operation).toBe('circuit_check');

      const rawText = f.mockQwenResponse.choices[0]!.message.content;
      const parsed = JSON.parse(rawText);
      const evidence: CircuitEvidence = {
        imageIds: req.images.map(img => img.id),
        codeLineCount: req.code ? req.code.split('\n').length : 0,
        requirementIds: f.request.requirementText ? ['req-1'] : [],
        priorFindingIds: []
      };

      const result = validateCircuitResult(parsed, evidence);
      expect(result.schemaVersion).toBe(2);
      expect(['reviewed', 'needs_clarification']).toContain(result.status);
      expect(result.findings.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('verifies deterministic LED calculation helper matches fixture calculation', () => {
    const calcFixture = qwenManifest.fixtures.find(f => f.id === 'qwen-02')!;
    expect(calcFixture).toBeDefined();

    const ops = calcFixture.request.calculation!.operands;
    const calcResult = calculateLedResistor(ops);
    expect(calcResult.valid).toBe(true);
    expect(calcResult.values?.idealResistance).toBe(150);
    expect(calcResult.values?.recommendedE12).toBe(150);
    expect(calcResult.values?.actualCurrent).toBe(0.02);
    expect(calcResult.values?.resistorPower).toBeCloseTo(0.06, 5);

    const content = calcFixture.mockQwenResponse.choices[0]!.message.content;
    expect(content).toContain('150 Ω');
    expect(content).toContain('20.0 mA');
    expect(content).toContain('60 mW');
  });

  it('verifies mandatory uncertainty and clarification on ambiguous fixtures', () => {
    const abstentionFixtures = qwenManifest.fixtures.filter(
      f => f.category === 'clarification_abstention' || f.category === 'uncertain_wiring'
    );
    expect(abstentionFixtures.length).toBe(2);

    for (const f of abstentionFixtures) {
      const content = f.mockQwenResponse.choices[0]!.message.content;
      const hasClarificationOrUnknown =
        content.includes('kailangan') ||
        content.includes('clarification') ||
        content.includes('Hindi ganap na matiyak') ||
        content.includes('kalabuan');
      expect(hasClarificationOrUnknown).toBe(true);
    }
  });
});
