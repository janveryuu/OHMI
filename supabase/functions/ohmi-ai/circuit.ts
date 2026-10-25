import { Buffer } from 'node:buffer';
import { validateCircuitImage } from './image.ts';
import { buildCircuitCheckSystemInstruction } from './tutor-policy.ts';
import type {
  CircuitRequestV2,
  CircuitEvidence,
  CircuitCheckResult,
  CircuitFinding,
  CircuitComparison,
  CircuitStep,
  EvidenceReference,
  CircuitImageItem
} from '../../../src/backend/contracts.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

const REQUEST_ALLOWED_KEYS = new Set([
  'version',
  'operation',
  'requestId',
  'language',
  'mode',
  'message',
  'images',
  'code',
  'board',
  'calculation',
  'simulation',
  'assignmentId',
  'assignmentAnalysisId',
  'requirementText',
  'previousCheckId',
  'conversationId',
  'accountId'
]);

const RESULT_ALLOWED_KEYS = new Set([
  'schemaVersion',
  'status',
  'summary',
  'findings',
  'unknowns',
  'questions',
  'comparisons',
  'steps',
  'codeSuggestion',
  'limitations'
]);

export function validateCircuitRequest(value: unknown): CircuitRequestV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid request: body must be a JSON object.');
  }
  const obj = value as Record<string, unknown>;

  // Reject unknown keys
  for (const key of Object.keys(obj)) {
    if (!REQUEST_ALLOWED_KEYS.has(key)) {
      throw new Error(`Invalid request: unknown field "${key}".`);
    }
  }

  if (obj.version !== 2) {
    throw new Error('Unsupported contract version. Expected version 2.');
  }

  if (obj.operation !== 'circuit_check') {
    throw new Error('Invalid operation. Expected "circuit_check".');
  }

  if (typeof obj.requestId !== 'string' || !UUID_REGEX.test(obj.requestId)) {
    throw new Error('A valid UUID requestId is required.');
  }

  if (!['english', 'filipino', 'taglish'].includes(String(obj.language))) {
    throw new Error('Invalid language preference.');
  }

  if (!['check', 'follow_up'].includes(String(obj.mode))) {
    throw new Error('Invalid mode. Expected "check" or "follow_up".');
  }

  if (typeof obj.message !== 'string' || !obj.message.trim() || obj.message.length > 2000) {
    throw new Error('Message must be a string between 1 and 2,000 characters.');
  }

  if (!['uno-r3', 'unknown'].includes(String(obj.board))) {
    throw new Error('Invalid board declaration.');
  }

  // Validate images array
  if (!Array.isArray(obj.images)) {
    throw new Error('Images must be an array.');
  }
  if (obj.images.length > 2) {
    throw new Error('At most two images (overview and detail) are permitted.');
  }

  const validatedImages: CircuitImageItem[] = [];
  const seenImageIds = new Set<string>();
  let totalDecodedBytes = 0;
  let totalPixels = 0;

  for (const img of obj.images) {
    if (!img || typeof img !== 'object' || Array.isArray(img)) {
      throw new Error('Each image item must be an object.');
    }
    const imgObj = img as Record<string, unknown>;
    const imgKeys = Object.keys(imgObj);
    for (const k of imgKeys) {
      if (!['id', 'mimeType', 'data'].includes(k)) {
        throw new Error(`Invalid image field: "${k}".`);
      }
    }

    if (!['overview', 'detail'].includes(String(imgObj.id))) {
      throw new Error('Image id must be "overview" or "detail".');
    }
    const id = imgObj.id as 'overview' | 'detail';
    if (seenImageIds.has(id)) {
      throw new Error(`Duplicate image id "${id}".`);
    }
    seenImageIds.add(id);

    if (!['image/png', 'image/jpeg'].includes(String(imgObj.mimeType))) {
      throw new Error('Image mimeType must be "image/png" or "image/jpeg".');
    }
    const mimeType = imgObj.mimeType as 'image/png' | 'image/jpeg';

    if (typeof imgObj.data !== 'string') {
      throw new Error('Image data must be a base64 string.');
    }

    const cleanData = imgObj.data.trim();
    if (cleanData.startsWith('data:') || cleanData.startsWith('http://') || cleanData.startsWith('https://')) {
      throw new Error('Image data must be raw base64, not a data URL or web link.');
    }

    if (cleanData.length % 4 !== 0 || !BASE64_REGEX.test(cleanData)) {
      throw new Error('Malformed base64 image data.');
    }

    // Decode and validate image structures
    const decodedBuf = Buffer.from(cleanData, 'base64');
    if (decodedBuf.length === 0) {
      throw new Error('Empty image payload.');
    }
    if (decodedBuf.length > 4 * 1024 * 1024) {
      throw new Error(`Image "${id}" decoded size exceeds 4 MiB limit.`);
    }

    const validation = validateCircuitImage(new Uint8Array(decodedBuf));
    if (!validation.valid || !validation.mimeType) {
      throw new Error(`Invalid image "${id}": ${validation.error || 'corrupt image'}`);
    }
    if (validation.mimeType !== mimeType) {
      throw new Error(`Declared mimeType "${mimeType}" does not match detected format "${validation.mimeType}".`);
    }

    totalDecodedBytes += decodedBuf.length;
    totalPixels += validation.pixels ?? 0;

    validatedImages.push({
      id,
      mimeType,
      data: cleanData
    });
  }

  if (totalDecodedBytes > 4 * 1024 * 1024) {
    throw new Error(`Combined images size (${totalDecodedBytes} bytes) exceeds 4 MiB limit.`);
  }
  if (totalPixels > 4_000_000) {
    throw new Error(`Combined images resolution (${totalPixels} pixels) exceeds 4,000,000 pixel limit.`);
  }

  // Code validation
  if (obj.code !== undefined) {
    if (typeof obj.code !== 'string' || obj.code.length > 8000) {
      throw new Error('Code must be a string up to 8,000 characters.');
    }
  }

  // Mode rules
  const mode = obj.mode as 'check' | 'follow_up';
  if (mode === 'check') {
    const hasImage = validatedImages.length > 0;
    const hasCode = typeof obj.code === 'string' && obj.code.trim().length > 0;
    if (!hasImage && !hasCode) {
      throw new Error('A check request requires visual evidence (screenshot) or Arduino code.');
    }
  } else if (mode === 'follow_up') {
    if (!obj.previousCheckId || typeof obj.previousCheckId !== 'string' || !UUID_REGEX.test(obj.previousCheckId)) {
      throw new Error('Follow-up mode requires a valid UUID previousCheckId.');
    }
    if (validatedImages.length > 0) {
      throw new Error('Follow-up requests cannot include new images. Start a new check for new visual evidence.');
    }
  }

  // Simulation validation
  if (obj.simulation !== undefined) {
    if (typeof obj.simulation !== 'string' || obj.simulation.length > 2000) {
      throw new Error('Simulation diagnostics must be a string up to 2,000 characters.');
    }
  }

  // Assignment comparison rules: either (assignmentId + assignmentAnalysisId) OR requirementText, not both
  const hasAssignmentId = obj.assignmentId !== undefined;
  const hasAnalysisId = obj.assignmentAnalysisId !== undefined;
  const hasReqText = obj.requirementText !== undefined;

  if (hasAssignmentId || hasAnalysisId) {
    if (hasReqText) {
      throw new Error('Specify either assignment artifacts or requirementText, not both.');
    }
    if (!hasAssignmentId || typeof obj.assignmentId !== 'string' || !UUID_REGEX.test(obj.assignmentId)) {
      throw new Error('A valid UUID assignmentId is required when comparing assignment.');
    }
    if (!hasAnalysisId || typeof obj.assignmentAnalysisId !== 'string' || !UUID_REGEX.test(obj.assignmentAnalysisId)) {
      throw new Error('A valid UUID assignmentAnalysisId is required when comparing assignment.');
    }
  }

  if (hasReqText) {
    if (typeof obj.requirementText !== 'string' || obj.requirementText.length > 4000) {
      throw new Error('requirementText must be a string up to 4,000 characters.');
    }
  }

  if (obj.previousCheckId !== undefined) {
    if (typeof obj.previousCheckId !== 'string' || !UUID_REGEX.test(obj.previousCheckId)) {
      throw new Error('Invalid previousCheckId: must be a valid UUID.');
    }
  }

  if (obj.conversationId !== undefined) {
    if (typeof obj.conversationId !== 'string' || !UUID_REGEX.test(obj.conversationId)) {
      throw new Error('Invalid conversationId: must be a valid UUID.');
    }
  }

  if (obj.calculation !== undefined) {
    if (!obj.calculation || typeof obj.calculation !== 'object') {
      throw new Error('Invalid calculation payload.');
    }
  }

  return {
    version: 2,
    operation: 'circuit_check',
    requestId: obj.requestId as string,
    language: obj.language as 'english' | 'filipino' | 'taglish',
    mode,
    message: (obj.message as string).trim(),
    images: validatedImages,
    code: obj.code as string | undefined,
    board: obj.board as 'uno-r3' | 'unknown',
    calculation: obj.calculation as any,
    simulation: obj.simulation as string | undefined,
    assignmentId: obj.assignmentId as string | undefined,
    assignmentAnalysisId: obj.assignmentAnalysisId as string | undefined,
    requirementText: obj.requirementText as string | undefined,
    previousCheckId: obj.previousCheckId as string | undefined,
    conversationId: obj.conversationId as string | undefined,
    accountId: obj.accountId as string | undefined
  };
}

export function validateCircuitResult(value: unknown, evidence: CircuitEvidence): CircuitCheckResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid circuit check result: expected a JSON object.');
  }
  const obj = value as Record<string, unknown>;

  // Check allowlisted keys
  for (const key of Object.keys(obj)) {
    if (!RESULT_ALLOWED_KEYS.has(key)) {
      throw new Error(`Unknown key in circuit check result: "${key}".`);
    }
  }

  if (obj.schemaVersion !== 2) {
    throw new Error('Invalid schemaVersion: expected 2.');
  }

  if (!['reviewed', 'needs_clarification', 'unsupported'].includes(String(obj.status))) {
    throw new Error('Invalid status in circuit check result.');
  }
  const status = obj.status as 'reviewed' | 'needs_clarification' | 'unsupported';

  if (typeof obj.summary !== 'string' || !obj.summary.trim() || obj.summary.length > 800) {
    throw new Error('Summary must be a string between 1 and 800 characters.');
  }

  // Unknowns
  if (!Array.isArray(obj.unknowns) || obj.unknowns.length > 6) {
    throw new Error('unknowns must be an array of at most 6 strings.');
  }
  for (const item of obj.unknowns) {
    if (typeof item !== 'string' || item.length > 300) {
      throw new Error('Each unknown item must be a string up to 300 characters.');
    }
  }

  // Questions
  if (!Array.isArray(obj.questions) || obj.questions.length > 3) {
    throw new Error('questions must be an array of at most 3 strings.');
  }
  for (const q of obj.questions) {
    if (typeof q !== 'string' || q.length > 300) {
      throw new Error('Each question must be a string up to 300 characters.');
    }
  }
  if (status === 'needs_clarification' && obj.questions.length === 0) {
    throw new Error('Status "needs_clarification" requires at least one clarification question.');
  }

  // Limitations
  if (!Array.isArray(obj.limitations) || obj.limitations.length < 1 || obj.limitations.length > 6) {
    throw new Error('limitations must be an array of 1 to 6 strings.');
  }
  for (const lim of obj.limitations) {
    if (typeof lim !== 'string' || lim.length > 300) {
      throw new Error('Each limitation must be a string up to 300 characters.');
    }
  }

  // Status-specific invariants
  if (status === 'unsupported') {
    if (Array.isArray(obj.findings) && obj.findings.length > 0) {
      throw new Error('Status "unsupported" must have empty findings.');
    }
    if (Array.isArray(obj.comparisons) && obj.comparisons.length > 0) {
      throw new Error('Status "unsupported" must have empty comparisons.');
    }
    if (Array.isArray(obj.steps) && obj.steps.length > 0) {
      throw new Error('Status "unsupported" must have empty steps.');
    }
    if (obj.codeSuggestion !== undefined) {
      throw new Error('Status "unsupported" cannot include a code suggestion.');
    }
  }

  if (status === 'needs_clarification') {
    if (Array.isArray(obj.steps) && obj.steps.length > 0) {
      throw new Error('Status "needs_clarification" must have empty steps.');
    }
    if (obj.codeSuggestion !== undefined) {
      throw new Error('Status "needs_clarification" cannot include a code suggestion.');
    }
  }

  // Findings
  if (!Array.isArray(obj.findings) || obj.findings.length > 6) {
    throw new Error('findings must be an array of at most 6 entries.');
  }
  const findingIds = new Set<string>();
  const validatedFindings: CircuitFinding[] = [];

  for (const f of obj.findings) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      throw new Error('Each finding must be an object.');
    }
    const fObj = f as Record<string, unknown>;
    for (const k of Object.keys(fObj)) {
      if (!['id', 'severity', 'certainty', 'observation', 'why', 'action', 'evidence'].includes(k)) {
        throw new Error(`Unknown key in finding: "${k}".`);
      }
    }

    if (typeof fObj.id !== 'string' || !fObj.id.trim() || fObj.id.length > 64) {
      throw new Error('Finding id must be a string between 1 and 64 characters.');
    }
    if (findingIds.has(fObj.id)) {
      throw new Error(`Duplicate finding id "${fObj.id}".`);
    }
    findingIds.add(fObj.id);

    if (!['info', 'warning', 'stop'].includes(String(fObj.severity))) {
      throw new Error('Finding severity must be "info", "warning", or "stop".');
    }
    if (!['observed', 'possible'].includes(String(fObj.certainty))) {
      throw new Error('Finding certainty must be "observed" or "possible".');
    }

    if (typeof fObj.observation !== 'string' || !fObj.observation.trim() || fObj.observation.length > 500) {
      throw new Error('Finding observation must be a string between 1 and 500 characters.');
    }
    if (typeof fObj.why !== 'string' || !fObj.why.trim() || fObj.why.length > 500) {
      throw new Error('Finding why must be a string between 1 and 500 characters.');
    }
    if (typeof fObj.action !== 'string' || !fObj.action.trim() || fObj.action.length > 500) {
      throw new Error('Finding action must be a string between 1 and 500 characters.');
    }

    if (!Array.isArray(fObj.evidence) || fObj.evidence.length < 1 || fObj.evidence.length > 3) {
      throw new Error('Finding evidence must contain 1 to 3 evidence references.');
    }
    const validatedRefs: EvidenceReference[] = [];
    for (const ref of fObj.evidence) {
      validatedRefs.push(validateEvidenceReference(ref, evidence));
    }

    validatedFindings.push({
      id: fObj.id,
      severity: fObj.severity as 'info' | 'warning' | 'stop',
      certainty: fObj.certainty as 'observed' | 'possible',
      observation: fObj.observation,
      why: fObj.why,
      action: fObj.action,
      evidence: validatedRefs
    });
  }

  // Comparisons
  if (!Array.isArray(obj.comparisons) || obj.comparisons.length > 8) {
    throw new Error('comparisons must be an array of at most 8 entries.');
  }
  const validatedComparisons: CircuitComparison[] = [];
  for (const c of obj.comparisons) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      throw new Error('Each comparison must be an object.');
    }
    const cObj = c as Record<string, unknown>;
    for (const k of Object.keys(cObj)) {
      if (!['requirementId', 'status', 'explanation', 'evidence'].includes(k)) {
        throw new Error(`Unknown key in comparison: "${k}".`);
      }
    }

    if (typeof cObj.requirementId !== 'string' || !cObj.requirementId) {
      throw new Error('Comparison requirementId is required.');
    }
    if (!evidence.requirementIds || !evidence.requirementIds.includes(cObj.requirementId)) {
      throw new Error(`Comparison references unknown requirementId "${cObj.requirementId}".`);
    }

    if (!['supported', 'possible_mismatch', 'not_observable'].includes(String(cObj.status))) {
      throw new Error('Comparison status must be "supported", "possible_mismatch", or "not_observable".');
    }

    if (typeof cObj.explanation !== 'string' || cObj.explanation.length > 400) {
      throw new Error('Comparison explanation must be a string up to 400 characters.');
    }

    if (!Array.isArray(cObj.evidence) || cObj.evidence.length > 3) {
      throw new Error('Comparison evidence must be an array of at most 3 items.');
    }
    const validatedCompRefs: EvidenceReference[] = [];
    for (const ref of cObj.evidence) {
      validatedCompRefs.push(validateEvidenceReference(ref, evidence));
    }

    validatedComparisons.push({
      requirementId: cObj.requirementId,
      status: cObj.status as 'supported' | 'possible_mismatch' | 'not_observable',
      explanation: cObj.explanation,
      evidence: validatedCompRefs
    });
  }

  // Steps
  if (!Array.isArray(obj.steps) || obj.steps.length > 8) {
    throw new Error('steps must be an array of at most 8 entries.');
  }
  const validatedSteps: CircuitStep[] = [];
  for (let i = 0; i < obj.steps.length; i++) {
    const s = obj.steps[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      throw new Error('Each step must be an object.');
    }
    const sObj = s as Record<string, unknown>;
    for (const k of Object.keys(sObj)) {
      if (!['step', 'instruction', 'why', 'check', 'findingId'].includes(k)) {
        throw new Error(`Unknown key in step: "${k}".`);
      }
    }

    if (sObj.step !== i + 1) {
      throw new Error(`Step index must be sequential 1-based. Expected ${i + 1}, got ${sObj.step}.`);
    }

    if (typeof sObj.instruction !== 'string' || !sObj.instruction.trim() || sObj.instruction.length > 500) {
      throw new Error(`Step ${i + 1} instruction must be between 1 and 500 characters.`);
    }
    if (typeof sObj.why !== 'string' || !sObj.why.trim() || sObj.why.length > 500) {
      throw new Error(`Step ${i + 1} why must be between 1 and 500 characters.`);
    }
    if (typeof sObj.check !== 'string' || !sObj.check.trim() || sObj.check.length > 500) {
      throw new Error(`Step ${i + 1} check must be between 1 and 500 characters.`);
    }

    if (sObj.findingId !== undefined) {
      if (typeof sObj.findingId !== 'string' || !findingIds.has(sObj.findingId)) {
        throw new Error(`Step ${i + 1} references unknown findingId "${sObj.findingId}".`);
      }
    }

    validatedSteps.push({
      step: sObj.step,
      instruction: sObj.instruction,
      why: sObj.why,
      check: sObj.check,
      findingId: sObj.findingId as string | undefined
    });
  }

  // Code suggestion
  let codeSuggestion: { code: string; explanation: string } | undefined;
  if (obj.codeSuggestion !== undefined) {
    if (!obj.codeSuggestion || typeof obj.codeSuggestion !== 'object' || Array.isArray(obj.codeSuggestion)) {
      throw new Error('codeSuggestion must be an object.');
    }
    const csObj = obj.codeSuggestion as Record<string, unknown>;
    for (const k of Object.keys(csObj)) {
      if (!['code', 'explanation'].includes(k)) {
        throw new Error(`Unknown key in codeSuggestion: "${k}".`);
      }
    }
    if (typeof csObj.code !== 'string' || csObj.code.length > 8000) {
      throw new Error('codeSuggestion code must be a string up to 8,000 characters.');
    }
    if (typeof csObj.explanation !== 'string' || csObj.explanation.length > 800) {
      throw new Error('codeSuggestion explanation must be a string up to 800 characters.');
    }
    codeSuggestion = {
      code: csObj.code,
      explanation: csObj.explanation
    };
  }

  return {
    schemaVersion: 2,
    status,
    summary: obj.summary,
    findings: validatedFindings,
    unknowns: obj.unknowns as string[],
    questions: obj.questions as string[],
    comparisons: validatedComparisons,
    steps: validatedSteps,
    codeSuggestion,
    limitations: obj.limitations as string[]
  };
}

export function validateEvidenceReference(ref: unknown, evidence: CircuitEvidence): EvidenceReference {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    throw new Error('Evidence reference must be an object.');
  }
  const r = { ...(ref as Record<string, unknown>) };

  if (!r.kind) {
    if (typeof r.type === 'string' && ['image', 'code', 'requirement', 'simulation', 'prior_check'].includes(r.type)) {
      r.kind = r.type;
    } else if ('imageId' in r || 'location' in r) {
      r.kind = 'image';
    } else if ('startLine' in r || 'endLine' in r) {
      r.kind = 'code';
    } else if ('requirementId' in r) {
      r.kind = 'requirement';
    } else if ('excerpt' in r) {
      r.kind = 'simulation';
    } else if ('findingId' in r) {
      r.kind = 'prior_check';
    }
  }

  if (r.kind === 'image') {
    if (!r.imageId && evidence.imageIds.length === 1) {
      r.imageId = evidence.imageIds[0];
    }
    if (!['overview', 'detail'].includes(String(r.imageId))) {
      throw new Error('Image evidence reference imageId must be "overview" or "detail".');
    }
    const imageId = r.imageId as 'overview' | 'detail';
    if (!evidence.imageIds.includes(imageId)) {
      throw new Error(`Image evidence references unsupplied imageId "${imageId}".`);
    }
    if (typeof r.location !== 'string' || !r.location.trim() || r.location.length > 160) {
      r.location = typeof r.location === 'string' && r.location.trim() ? r.location.trim().slice(0, 160) : 'Visible circuit component or wiring';
    }
    return { kind: 'image', imageId, location: r.location as string };
  }

  if (r.kind === 'code') {
    if (!evidence.codeLineCount || evidence.codeLineCount <= 0) {
      throw new Error('Code evidence referenced but no code was provided in request.');
    }
    if (typeof r.startLine !== 'number' || !Number.isInteger(r.startLine) || r.startLine < 1) {
      throw new Error('Code evidence startLine must be an integer >= 1.');
    }
    if (typeof r.endLine !== 'number' || !Number.isInteger(r.endLine) || r.endLine < r.startLine) {
      throw new Error('Code evidence endLine must be an integer >= startLine.');
    }
    if (r.endLine > evidence.codeLineCount) {
      throw new Error(`Code evidence line ${r.endLine} exceeds supplied source line count (${evidence.codeLineCount}).`);
    }
    if (r.endLine - r.startLine > 20) {
      throw new Error('Code evidence line range cannot exceed 20 lines.');
    }
    return { kind: 'code', startLine: r.startLine, endLine: r.endLine };
  }

  if (r.kind === 'requirement') {
    if (typeof r.requirementId !== 'string' || !r.requirementId) {
      throw new Error('Requirement evidence requires a requirementId.');
    }
    if (!evidence.requirementIds || !evidence.requirementIds.includes(r.requirementId)) {
      throw new Error(`Requirement evidence references unknown requirementId "${r.requirementId}".`);
    }
    return { kind: 'requirement', requirementId: r.requirementId };
  }

  if (r.kind === 'simulation') {
    if (!evidence.simulationText || !evidence.simulationText.trim()) {
      throw new Error('Simulation evidence referenced but no simulation output was provided.');
    }
    if (typeof r.excerpt !== 'string' || !r.excerpt.trim() || r.excerpt.length > 160) {
      throw new Error('Simulation excerpt must be between 1 and 160 characters.');
    }
    if (!evidence.simulationText.includes(r.excerpt)) {
      throw new Error(`Simulation excerpt "${r.excerpt}" is not found in supplied simulation output.`);
    }
    return { kind: 'simulation', excerpt: r.excerpt };
  }

  if (r.kind === 'prior_check') {
    if (typeof r.findingId !== 'string' || !r.findingId) {
      throw new Error('Prior check evidence requires a findingId.');
    }
    if (!evidence.priorFindingIds || !evidence.priorFindingIds.includes(r.findingId)) {
      throw new Error(`Prior check evidence references unknown findingId "${r.findingId}".`);
    }
    return { kind: 'prior_check', findingId: r.findingId };
  }

  throw new Error(typeof r.kind === 'string'
    ? 'Evidence reference kind must be image, code, requirement, simulation, or prior_check.'
    : 'Evidence reference is missing its kind (image, code, requirement, simulation, or prior_check).');
}

export function buildCircuitPrompt(req: CircuitRequestV2, evidence: CircuitEvidence): { systemInstruction: string; userPrompt: string } {
  const systemInstruction = `${buildCircuitCheckSystemInstruction(req.language)}

Every evidenceReference MUST include a kind discriminator and the fields for that kind:
- {"kind": "image", "imageId": "overview", "location": "precise visible location, 1-160 chars"}; only supplied image IDs: ${JSON.stringify(evidence.imageIds)}.
- {"kind": "code", "startLine": 1, "endLine": 1}; only when code supplied, within ${evidence.codeLineCount || 0} lines, range difference <=20.
- {"kind": "requirement", "requirementId": "supplied ID"}; only IDs ${JSON.stringify(evidence.requirementIds || [])}.
- {"kind": "simulation", "excerpt": "exact supplied substring, 1-160 chars"}; only when simulation supplied.
- {"kind": "prior_check", "findingId": "supplied prior finding ID"}; only IDs ${JSON.stringify(evidence.priorFindingIds || [])}.
Never invent a source, omit kind, or infer electrical verification from an image. Use empty evidence with explicit uncertainty where appropriate.
Keep explanations concise and the entire JSON complete within the output budget.

CircuitCheckResult schema:
{
  "schemaVersion": 2,
  "status": "reviewed" | "needs_clarification" | "unsupported",
  "summary": "1-800 chars overview summary",
  "findings": [
    {
      "id": "finding-1",
      "severity": "info" | "warning" | "stop",
      "certainty": "observed" | "possible",
      "observation": "1-500 chars",
      "why": "1-500 chars",
      "action": "1-500 chars",
      "evidence": [ evidenceReference ]
    }
  ],
  "unknowns": ["up to 6 strings, each max 300 chars"],
  "questions": ["up to 3 strings, each max 300 chars"],
  "comparisons": [
    {
      "requirementId": "id",
      "status": "supported" | "possible_mismatch" | "not_observable",
      "explanation": "max 400 chars",
      "evidence": [ evidenceReference ]
    }
  ],
  "steps": [
    {
      "step": 1,
      "instruction": "1-500 chars",
      "why": "1-500 chars",
      "check": "1-500 chars",
      "findingId": "optional finding id"
    }
  ],
  "codeSuggestion": { "code": "string", "explanation": "string" },
  "limitations": ["1 to 6 strings explaining limitations of image/code review"]
}`;

  let userPrompt = `Student Question / Message:\n${req.message}\n\nDeclared Board: ${req.board === 'uno-r3' ? 'Arduino UNO R3' : 'Unknown / Unspecified board'}`;

  if (req.code) {
    userPrompt += `\n\nArduino Code (${evidence.codeLineCount || 0} lines):\n\`\`\`cpp\n${req.code}\n\`\`\``;
  }
  if (req.simulation) {
    userPrompt += `\n\nSimulation Diagnostics / Serial Output:\n"""\n${req.simulation}\n"""`;
  }
  if (evidence.requirements && evidence.requirements.length > 0) {
    userPrompt += `\n\nStated Assignment Requirements to compare against:\n${evidence.requirements.map(r => `[${r.id}] (${r.kind || 'requirement'}): ${r.text}`).join('\n')}\n(For each requirement ID, evaluate with "supported", "possible_mismatch", or "not_observable" in the "comparisons" array and cite evidence.)`;
  } else if (evidence.requirementIds && evidence.requirementIds.length > 0) {
    userPrompt += `\n\nStated Assignment Requirement IDs to compare against:\n${evidence.requirementIds.map(id => `- ${id}`).join('\n')}\n(For each requirement ID, evaluate with "supported", "possible_mismatch", or "not_observable" in the "comparisons" array and cite evidence.)`;
  }
  if (req.requirementText) {
    userPrompt += `\n\nStated Manual Requirements (User-provided, unverified):\n"""\n${req.requirementText}\n"""`;
  }

  return { systemInstruction, userPrompt };
}

