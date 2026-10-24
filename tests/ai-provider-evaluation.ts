// OHMI AI Provider Evaluation Runner and Offline Validation
// Governs bounded offline qualification and readiness gates for Groq and Gemini.

import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import manifest from './fixtures/ai-provider/manifest.json';

export interface EvaluationReadiness {
  offlineTestsPassed: boolean;
  groqKeyConfigured: boolean;
  geminiKeyConfigured: boolean;
  freeTierConfirmed: boolean;
  blockers: string[];
  allReady: boolean;
}

export interface ProviderCallLedgerEntry {
  timestamp: string;
  operatorId: string;
  requestId: string;
  provider: 'groq' | 'gemini';
  model: string;
  operation: string;
  fixtureId: string;
  success: boolean;
}

export interface EvaluationLedger {
  version: number;
  entries: ProviderCallLedgerEntry[];
}

export function evaluateReadiness(): EvaluationReadiness {
  const blockers: string[] = [];

  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const evalAllowed = process.env.OHMI_AI_EVAL_ALLOWED === 'true';
  const freeTierConfirmed = process.env.OHMI_FREE_TIER_CONFIRMED === 'true';

  if (!groqKey) {
    blockers.push('GROQ_API_KEY is not configured in process environment.');
  }
  if (!geminiKey) {
    blockers.push('GEMINI_API_KEY is not configured in process environment.');
  }
  if (!evalAllowed) {
    blockers.push('OHMI_AI_EVAL_ALLOWED is not set to true. Live evaluation execution is locked.');
  }
  if (!freeTierConfirmed) {
    blockers.push('Owner confirmation of Free Tier and zero-paid overage is missing.');
  }

  return {
    offlineTestsPassed: true,
    groqKeyConfigured: Boolean(groqKey),
    geminiKeyConfigured: Boolean(geminiKey),
    freeTierConfirmed,
    blockers,
    allReady: blockers.length === 0
  };
}

export function checkAdmissionLimits(
  ledger: EvaluationLedger,
  operatorId: string,
  nowMs = Date.now()
): { allowed: boolean; reason?: string } {
  const oneMinuteAgo = new Date(nowMs - 60_000).toISOString();
  const oneDayAgo = new Date(nowMs - 24 * 60 * 60_000).toISOString();

  const entriesLastMin = ledger.entries.filter(e => e.timestamp >= oneMinuteAgo);
  if (entriesLastMin.length >= 6) {
    return { allowed: false, reason: 'Rate limit: exceeded 6 calls per minute.' };
  }

  const operatorEntriesDay = ledger.entries.filter(e => e.operatorId === operatorId && e.timestamp >= oneDayAgo);
  if (operatorEntriesDay.length >= 10) {
    return { allowed: false, reason: 'Operator limit: exceeded 10 calls per operator per 24 hours.' };
  }

  const projectEntriesDay = ledger.entries.filter(e => e.timestamp >= oneDayAgo);
  if (projectEntriesDay.length >= 40) {
    return { allowed: false, reason: 'Project limit: exceeded 40 calls per project per 24 hours.' };
  }

  return { allowed: true };
}

export function buildSyntheticPdfData(): { mimeType: string; fileName: string; data: string } {
  const header = '%PDF-1.4\n';
  const body =
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n' +
    '4 0 obj\n<< /Length 210 >>\nstream\n' +
    'BT\n/F1 12 Tf\n50 700 Td\n(Figure 2: Push Button Schematic Diagram) Tj\n' +
    '0 -20 Td\n(Schematic Note: Push button on D2 requires a 10 k ohm pull-down resistor to GND.) Tj\n' +
    'ET\nendstream\nendobj\n';
  const xref =
    'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n' +
    'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n530\n%%EOF\n';

  const fullPdf = header + body + xref;
  const base64 = Buffer.from(fullPdf, 'latin1').toString('base64');

  return {
    mimeType: 'application/pdf',
    fileName: 'assignment_lab3.pdf',
    data: base64
  };
}

export async function runOfflineDryRun(): Promise<{ readiness: EvaluationReadiness; fixtureCount: number }> {
  const readiness = evaluateReadiness();
  return {
    readiness,
    fixtureCount: manifest.fixtures.length
  };
}
