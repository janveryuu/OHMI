import { validateArduinoSketch, type SketchValidationResult } from './arduino.ts';

export interface TutorialStep {
  step: number; // 1 to 24
  title?: string;
  instruction: string;
  why: string;
  check: string;
  code?: string;
  sourceReference?: { page?: number; excerpt?: string };
}

export interface TutorialComponent {
  name: string;
  quantity: number | string;
  notes?: string;
}

export interface TutorialResult {
  status: 'tutorial' | 'needs_clarification' | 'unsupported';
  title?: string;
  objective?: string;
  components?: TutorialComponent[];
  steps?: TutorialStep[];
  code?: string;
  clarificationQuestions?: string[];
  notes?: string;
  answer?: string;
  arduinoValidation?: SketchValidationResult;
}

export const MAX_TUTORIAL_STEPS = 24;
export const MIN_TUTORIAL_STEPS = 1;

/**
 * Parses and strictly validates a tutorial result payload.
 */
export function validateTutorialResult(data: unknown): { valid: boolean; result?: TutorialResult; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Tutorial payload must be an object' };
  }

  const obj = data as Record<string, any>;
  const status = obj.status;

  if (status !== 'tutorial' && status !== 'needs_clarification' && status !== 'unsupported') {
    return { valid: false, error: 'Tutorial status must be "tutorial", "needs_clarification", or "unsupported"' };
  }

  if (status === 'unsupported') {
    return {
      valid: true,
      result: {
        status: 'unsupported',
        notes: typeof obj.notes === 'string' ? obj.notes : 'This circuit or assignment cannot be built with the supported tutorial guide.',
        answer: typeof obj.answer === 'string' ? obj.answer : obj.notes
      }
    };
  }

  if (status === 'needs_clarification') {
    const questions = Array.isArray(obj.clarificationQuestions)
      ? obj.clarificationQuestions.filter(q => typeof q === 'string' && q.trim().length > 0)
      : [];
    if (questions.length === 0 && !obj.notes && !obj.answer) {
      return { valid: false, error: 'needs_clarification must include clarification questions or explanation notes' };
    }
    return {
      valid: true,
      result: {
        status: 'needs_clarification',
        title: typeof obj.title === 'string' ? obj.title : undefined,
        clarificationQuestions: questions,
        notes: typeof obj.notes === 'string' ? obj.notes : undefined,
        answer: typeof obj.answer === 'string' ? obj.answer : (questions.join('\n') || obj.notes)
      }
    };
  }

  // status === 'tutorial'
  const steps = obj.steps;
  if (!Array.isArray(steps) || steps.length < MIN_TUTORIAL_STEPS || steps.length > MAX_TUTORIAL_STEPS) {
    return { valid: false, error: `Tutorial must have between ${MIN_TUTORIAL_STEPS} and ${MAX_TUTORIAL_STEPS} ordered steps` };
  }

  const validatedSteps: TutorialStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s || typeof s !== 'object') {
      return { valid: false, error: `Step at index ${i} is not an object` };
    }
    const expectedStepNum = i + 1;
    const rawNum = typeof s.step === 'number' ? s.step : Number(s.step);
    const stepNum = Number.isFinite(rawNum) ? rawNum : expectedStepNum;
    if (stepNum !== expectedStepNum) {
      return { valid: false, error: `Step numbers must be strictly sequential (expected ${expectedStepNum}, got ${stepNum})` };
    }

    const instruction = typeof s.instruction === 'string' && s.instruction.trim()
      ? s.instruction.trim()
      : (typeof s.action === 'string' && s.action.trim() ? s.action.trim() : (typeof s.title === 'string' ? s.title.trim() : ''));
    const why = typeof s.why === 'string' && s.why.trim()
      ? s.why.trim()
      : (typeof s.reason === 'string' && s.reason.trim()
        ? s.reason.trim()
        : (typeof s.explanation === 'string' && s.explanation.trim()
          ? s.explanation.trim()
          : 'Ensures proper circuit operation and component protection.'));
    const check = typeof s.check === 'string' && s.check.trim()
      ? s.check.trim()
      : (typeof s.verification === 'string' && s.verification.trim()
        ? s.verification.trim()
        : (typeof s.verify === 'string' && s.verify.trim()
          ? s.verify.trim()
          : 'Verify connection against the circuit diagram before powering on.'));

    if (!instruction) {
      return { valid: false, error: `Step ${expectedStepNum} is missing an instruction` };
    }

    validatedSteps.push({
      step: expectedStepNum,
      title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : undefined,
      instruction,
      why,
      check,
      code: typeof s.code === 'string' && s.code.trim() ? s.code.trim() : undefined,
      sourceReference: s.sourceReference && typeof s.sourceReference === 'object' ? {
        page: typeof s.sourceReference.page === 'number' ? s.sourceReference.page : undefined,
        excerpt: typeof s.sourceReference.excerpt === 'string' ? s.sourceReference.excerpt : undefined
      } : undefined
    });
  }

  // Validate components
  const rawComponents = obj.components;
  const validatedComponents: TutorialComponent[] = [];
  if (Array.isArray(rawComponents)) {
    for (const c of rawComponents) {
      if (c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim()) {
        validatedComponents.push({
          name: c.name.trim(),
          quantity: c.quantity !== undefined ? c.quantity : 1,
          notes: typeof c.notes === 'string' ? c.notes.trim() : undefined
        });
      }
    }
  }

  // Optional code validation
  let arduinoValidation: SketchValidationResult | undefined;
  const sketchCode = typeof obj.code === 'string' && obj.code.trim() ? obj.code.trim() : undefined;
  if (sketchCode) {
    arduinoValidation = validateArduinoSketch(sketchCode);
  }

  return {
    valid: true,
    result: {
      status: 'tutorial',
      title: typeof obj.title === 'string' ? obj.title.trim() : 'Circuit Assembly Guide',
      objective: typeof obj.objective === 'string' ? obj.objective.trim() : undefined,
      components: validatedComponents,
      steps: validatedSteps,
      code: sketchCode,
      notes: typeof obj.notes === 'string' ? obj.notes : undefined,
      answer: typeof obj.answer === 'string' ? obj.answer : undefined,
      arduinoValidation
    }
  };
}

/**
 * Extracts and parses a JSON tutorial payload from text that may contain markdown fences.
 */
export function extractTutorialJson(raw: string): unknown {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch { /* proceed */ }

  // Match ```json ... ```
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch { /* proceed */ }
  }

  // Match first { to last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch { /* proceed */ }
  }

  return null;
}
