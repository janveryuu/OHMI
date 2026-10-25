import type { CircuitEvidence } from '../../../src/backend/contracts.ts';

const text = { type: 'string' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const list = (items: unknown, maxItems: number) => ({ type: 'array', items, maxItems });
const choice = (values: string[]) => ({ type: 'string', enum: values });

// Shape constraints help the producer; local validators still enforce grounding and semantics.
export function circuitResponseSchema(evidence: CircuitEvidence): Record<string, unknown> {
  const variants: unknown[] = [];
  if (evidence.imageIds.length) variants.push(object({ kind: choice(['image']), imageId: choice(evidence.imageIds), location: text }));
  if (evidence.codeLineCount) variants.push(object({ kind: choice(['code']), startLine: { type: 'integer', minimum: 1 }, endLine: { type: 'integer', minimum: 1 } }));
  if (evidence.requirementIds?.length) variants.push(object({ kind: choice(['requirement']), requirementId: choice(evidence.requirementIds) }));
  if (evidence.simulationText) variants.push(object({ kind: choice(['simulation']), excerpt: text }));
  if (evidence.priorFindingIds?.length) variants.push(object({ kind: choice(['prior_check']), findingId: choice(evidence.priorFindingIds) }));
  const evidenceList = list(variants.length ? { anyOf: variants } : object({ kind: choice(['image']), imageId: text, location: text }), variants.length ? 6 : 0);
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
