import type { CircuitEvidence } from '../../../src/backend/contracts.ts';

const text = { type: 'string' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const list = (items: unknown, maxItems: number) => ({ type: 'array', items, maxItems });
const choice = (values: string[]) => ({ type: 'string', enum: values });

// Shape constraints help the producer; local validators still enforce grounding and semantics.
export function circuitResponseSchema(_evidence: CircuitEvidence): Record<string, unknown> {
  const evidenceItem = object({
    kind: choice(['image', 'code', 'requirement', 'simulation', 'prior_check']),
    imageId: text,
    location: text,
    startLine: { type: 'integer' },
    endLine: { type: 'integer' },
    requirementId: text,
    excerpt: text,
    findingId: text
  }, ['kind']);
  const evidenceList = list(evidenceItem, 6);
  return object({
    schemaVersion: { type: 'integer', enum: [2] },
    status: choice(['reviewed', 'needs_clarification', 'unsupported']), summary: text,
    findings: list(object({ id: text, severity: choice(['info', 'warning', 'stop']), certainty: choice(['observed', 'possible']), observation: text, why: text, action: text, evidence: evidenceList }), 6),
    unknowns: list(text, 6), questions: list(text, 3),
    comparisons: list(object({ requirementId: text, status: choice(['supported', 'possible_mismatch', 'not_observable']), explanation: text, evidence: evidenceList }), 12),
    steps: list(object({ step: { type: 'integer' }, instruction: text, why: text, check: text, findingId: text }, ['step', 'instruction', 'why', 'check']), 12),
    codeSuggestion: object({ code: text, explanation: text }), limitations: { ...list(text, 6), minItems: 1 }
  }, ['schemaVersion', 'status', 'summary', 'findings', 'unknowns', 'questions', 'comparisons', 'steps', 'limitations']);
}

export const tutorialResponseSchema = object({
  status: choice(['tutorial', 'needs_clarification', 'unsupported']), title: text, objective: text,
  components: list(object({ name: text, quantity: { type: 'integer', minimum: 1 }, notes: text }, ['name', 'quantity']), 32),
  steps: list(object({ step: { type: 'integer', minimum: 1, maximum: 24 }, instruction: text, why: text, check: text, code: text }, ['step', 'instruction', 'why', 'check']), 24),
  code: text, clarificationQuestions: list(text, 6), notes: text
}, ['status', 'steps']);
