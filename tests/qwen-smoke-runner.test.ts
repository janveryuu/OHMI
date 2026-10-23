import { describe, it, expect } from 'vitest';
import {
  evaluateReadiness,
  checkAdmissionLimits,
  buildSyntheticPdfData,
  runSmokeStage,
  type SmokeLedger
} from './qwen-smoke-runner.ts';

describe('Milestone Q2: Stage A Smoke Runner & Readiness Verification', () => {
  it('correctly reports readiness blockers when Qwen credentials or confirmations are absent', () => {
    const readiness = evaluateReadiness();
    expect(readiness.q1TestsPassed).toBe(true);
    expect(readiness.allReady).toBe(false);
    expect(readiness.blockers.length).toBeGreaterThan(0);
    
    // Must flag key replacement, Qwen API key, base URL, and Free Quota Only protections
    const blockersText = readiness.blockers.join(' ');
    expect(blockersText).toContain('QWEN_API_KEY');
    expect(blockersText).toContain('Free Quota Only');
    expect(blockersText).toContain('revoked and replaced');
  });

  it('enforces admission limits (6/min, 10/operator/day, 40/project/day)', () => {
    const now = Date.now();
    const ledger: SmokeLedger = { version: 1, entries: [] };

    // Under limit -> allowed
    expect(checkAdmissionLimits(ledger, 'test-op', now).allowed).toBe(true);

    // 6 in the last minute -> rejects
    for (let i = 0; i < 6; i++) {
      ledger.entries.push({
        timestamp: new Date(now - 10_000 * i).toISOString(),
        operatorId: 'test-op',
        requestId: `req-${i}`,
        provider: 'qwen',
        model: 'qwen3.8-flash',
        operation: 'circuit_check',
        fixtureId: 'qwen-05',
        success: true
      });
    }
    const minCheck = checkAdmissionLimits(ledger, 'test-op', now);
    expect(minCheck.allowed).toBe(false);
    expect(minCheck.reason).toContain('6 calls per minute');

    // Reset ledger to spread across 2 hours, but 10 for same operator -> operator limit hit
    ledger.entries = [];
    for (let i = 0; i < 10; i++) {
      ledger.entries.push({
        timestamp: new Date(now - 100_000 * (i + 1)).toISOString(),
        operatorId: 'test-op',
        requestId: `req-op-${i}`,
        provider: 'qwen',
        model: 'qwen3.8-flash',
        operation: 'circuit_check',
        fixtureId: 'qwen-05',
        success: true
      });
    }
    const opCheck = checkAdmissionLimits(ledger, 'test-op', now);
    expect(opCheck.allowed).toBe(false);
    expect(opCheck.reason).toContain('10 calls per operator');

    // Different operator should pass operator check, but if total hits 40 -> project limit hit
    expect(checkAdmissionLimits(ledger, 'different-op', now).allowed).toBe(true);

    for (let i = 10; i < 40; i++) {
      ledger.entries.push({
        timestamp: new Date(now - 100_000 * (i + 1)).toISOString(),
        operatorId: `op-${i}`,
        requestId: `req-proj-${i}`,
        provider: 'qwen',
        model: 'qwen3.8-flash',
        operation: 'circuit_check',
        fixtureId: 'qwen-05',
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

  it('refuses live generation and reports stopped lanes when readiness is incomplete', async () => {
    const runResult = await runSmokeStage({ dryRun: true });
    expect(runResult.readiness.allReady).toBe(false);
    expect(runResult.results).toHaveLength(0);
    expect(runResult.stoppedLanes.length).toBe(3);
    expect(runResult.stoppedLanes[0]).toContain('blocked: readiness checks incomplete');
  });
});
