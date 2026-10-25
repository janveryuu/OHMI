import { describe, it, expect } from 'vitest';
import manifest from './fixtures/ai-provider/manifest.json';
import { extractTutorialJson, validateTutorialResult } from '../supabase/functions/ohmi-ai/tutorial.ts';
import { validateCircuitResult, validateCircuitRequest } from '../supabase/functions/ohmi-ai/circuit.ts';
import { calculateLedResistor } from '../supabase/functions/ohmi-ai/calculations.ts';
import type { CircuitEvidence } from '../src/backend/contracts.ts';
import {
  evaluateReadiness,
  checkAdmissionLimits,
  buildSyntheticPdfData,
  runOfflineDryRun,
  type EvaluationLedger
} from './ai-provider-evaluation.ts';

describe('Milestone M1 & M6: AI Provider Evaluation Fixtures and Matrix Qualification', () => {
  it('contains exactly 12 synthetic evaluation cases', () => {
    expect(manifest.totalCases).toBe(12);
    expect(manifest.fixtures).toHaveLength(12);
  });

  it('adheres to balanced language distribution (4 English, 4 Filipino, 4 Taglish)', () => {
    const counts: Record<string, number> = { english: 0, filipino: 0, taglish: 0 };
    for (const f of manifest.fixtures) {
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

    for (const f of manifest.fixtures) {
      const content = f.mockResponse.choices[0]!.message.content;
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });

  it('qualifies tutorial fixtures against strict tutorial schema validator', () => {
    const tutorialFixtures = manifest.fixtures.filter(f => f.operation === 'tutorial');
    expect(tutorialFixtures.length).toBeGreaterThanOrEqual(3);

    for (const f of tutorialFixtures) {
      const rawText = f.mockResponse.choices[0]!.message.content;
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
    const circuitFixtures = manifest.fixtures.filter(f => f.operation === 'circuit_check');
    expect(circuitFixtures.length).toBeGreaterThanOrEqual(3);

    for (const f of circuitFixtures) {
      const req = validateCircuitRequest(f.request);
      expect(req.version).toBe(2);
      expect(req.operation).toBe('circuit_check');

      const rawText = f.mockResponse.choices[0]!.message.content;
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
    const calcFixture = manifest.fixtures.find(f => f.id === 'ai-provider-02')!;
    expect(calcFixture).toBeDefined();

    const ops = calcFixture.request.calculation!.operands;
    const calcResult = calculateLedResistor(ops);
    expect(calcResult.valid).toBe(true);
    expect(calcResult.values?.idealResistance).toBe(150);
    expect(calcResult.values?.recommendedE12).toBe(150);
    expect(calcResult.values?.actualCurrent).toBe(0.02);
    expect(calcResult.values?.resistorPower).toBeCloseTo(0.06, 5);

    const content = calcFixture.mockResponse.choices[0]!.message.content;
    expect(content).toContain('150 Ω');
    expect(content).toContain('20.0 mA');
  });

  it('correctly reports readiness blockers when provider credentials or confirmations are absent', () => {
    const origGemini = process.env.GEMINI_API_KEY;
    const origGroq = process.env.GROQ_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GROQ_API_KEY;
      const readiness = evaluateReadiness();
      expect(readiness.offlineTestsPassed).toBe(true);
      expect(readiness.allReady).toBe(false);
      expect(readiness.blockers.length).toBeGreaterThan(0);

      const blockersText = readiness.blockers.join(' ');
      expect(blockersText).toContain('GROQ_API_KEY');
      expect(blockersText).toContain('GEMINI_API_KEY');
      expect(blockersText).toContain('OHMI_AI_EVAL_ALLOWED');
    } finally {
      if (origGemini !== undefined) process.env.GEMINI_API_KEY = origGemini;
      if (origGroq !== undefined) process.env.GROQ_API_KEY = origGroq;
    }
  });

  it('enforces admission limits (6/min, 10/operator/day, 40/project/day)', () => {
    const now = Date.now();
    const ledger: EvaluationLedger = { version: 1, entries: [] };

    expect(checkAdmissionLimits(ledger, 'test-op', now).allowed).toBe(true);

    for (let i = 0; i < 6; i++) {
      ledger.entries.push({
        timestamp: new Date(now - 10_000 * i).toISOString(),
        operatorId: 'test-op',
        requestId: `req-${i}`,
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        operation: 'chat',
        fixtureId: 'ai-provider-01',
        success: true
      });
    }
    const minCheck = checkAdmissionLimits(ledger, 'test-op', now);
    expect(minCheck.allowed).toBe(false);
    expect(minCheck.reason).toContain('6 calls per minute');

    ledger.entries = [];
    for (let i = 0; i < 10; i++) {
      ledger.entries.push({
        timestamp: new Date(now - 100_000 * (i + 1)).toISOString(),
        operatorId: 'test-op',
        requestId: `req-op-${i}`,
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        operation: 'chat',
        fixtureId: 'ai-provider-01',
        success: true
      });
    }
    const opCheck = checkAdmissionLimits(ledger, 'test-op', now);
    expect(opCheck.allowed).toBe(false);
    expect(opCheck.reason).toContain('10 calls per operator');

    expect(checkAdmissionLimits(ledger, 'different-op', now).allowed).toBe(true);

    for (let i = 10; i < 40; i++) {
      ledger.entries.push({
        timestamp: new Date(now - 100_000 * (i + 1)).toISOString(),
        operatorId: `op-${i}`,
        requestId: `req-proj-${i}`,
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        operation: 'chat',
        fixtureId: 'ai-provider-01',
        success: true
      });
    }
    const projCheck = checkAdmissionLimits(ledger, 'different-op', now);
    expect(projCheck.allowed).toBe(false);
    expect(projCheck.reason).toContain('40 calls per project');
  });

  it('generates valid synthetic PDF containing schematic pull-down fact', () => {
    const pdf = buildSyntheticPdfData();
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.fileName).toBe('assignment_lab3.pdf');
    expect(pdf.data.length).toBeGreaterThan(100);

    const decoded = Buffer.from(pdf.data, 'base64').toString('latin1');
    expect(decoded).toContain('Figure 2: Push Button Schematic Diagram');
    expect(decoded).toContain('10 k');
  });

  it('runs offline dry run safely without making live provider calls', async () => {
    const dryRun = await runOfflineDryRun();
    expect(dryRun.fixtureCount).toBe(12);
    expect(dryRun.readiness.allReady).toBe(false);
  });
});
