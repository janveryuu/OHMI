// OHMI AI Provider Policy & Route Resolver
// Enforces workflow-based provider routing:
// - GroqCloud: text-only conversational Ask OHMI & Playground help (openai/gpt-oss-120b)
// - Google Gemini: multimodal PDF, image, tutorial & circuit review (gemini-3.8-flash)
// Zero client model/provider overrides. Zero cross-provider fallback.

export type AiProvider = 'groq' | 'gemini';
export type AiWorkflow = 'chat' | 'pdf' | 'image' | 'tutorial' | 'circuit_check' | 'analysis_followup';

export const GEMINI_PRODUCTION_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_GROQ_CHAT_MODEL = 'openai/gpt-oss-120b';
export const ALLOWED_GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] as const;

export interface ResolvedRoute {
  provider: AiProvider;
  model: string;
  workflow: AiWorkflow;
}

export interface RouteResolutionContext {
  circuitAnalysisId?: string | null;
  hasArtifactReference?: boolean;
}

export function sanitizeErrorMessage(message: string, secretKey?: string): string {
  let clean = message;
  if (secretKey && secretKey.length >= 8) {
    clean = clean.split(secretKey).join('[REDACTED_KEY]');
  }
  // Generic bearer token redaction
  clean = clean.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
  // Redact signed storage URLs with sensitive query params
  clean = clean.replace(/https:\/\/[^\s"'<>]+\?[^\s"'<>]*token=[^\s"'<>]+/gi, '[REDACTED_URL]');
  clean = clean.replace(/https:\/\/[^\s"'<>]+\?[^\s"'<>]*sig=[^\s"'<>]+/gi, '[REDACTED_URL]');
  return clean;
}

export function resolveAiRoute(
  operation: string,
  context?: RouteResolutionContext,
  configuredGroqModel?: string
): ResolvedRoute {
  // Multimodal & structured analysis workflows route exclusively to Gemini
  if (operation === 'pdf') {
    return { provider: 'gemini', model: GEMINI_PRODUCTION_MODEL, workflow: 'pdf' };
  }
  if (operation === 'image') {
    return { provider: 'gemini', model: GEMINI_PRODUCTION_MODEL, workflow: 'image' };
  }
  if (operation === 'tutorial') {
    return { provider: 'gemini', model: GEMINI_PRODUCTION_MODEL, workflow: 'tutorial' };
  }
  if (operation === 'circuit_check') {
    return { provider: 'gemini', model: GEMINI_PRODUCTION_MODEL, workflow: 'circuit_check' };
  }

  // Follow-up chat anchored to a prior multimodal circuit analysis stays with Gemini
  if (operation === 'chat' && (context?.circuitAnalysisId || context?.hasArtifactReference)) {
    return { provider: 'gemini', model: GEMINI_PRODUCTION_MODEL, workflow: 'analysis_followup' };
  }

  // Standard text/code chat (including Playground help) routes to Groq
  const groqModel =
    configuredGroqModel && (ALLOWED_GROQ_MODELS as readonly string[]).includes(configuredGroqModel)
      ? configuredGroqModel
      : DEFAULT_GROQ_CHAT_MODEL;

  return { provider: 'groq', model: groqModel, workflow: 'chat' };
}

export interface RouteReadiness {
  enabled: boolean;
  reason?: string;
}

export function checkRouteReadiness(
  route: ResolvedRoute,
  env: {
    OHMI_AI_ENABLED?: string;
    OHMI_GROQ_CHAT_ENABLED?: string;
    OHMI_GEMINI_MULTIMODAL_ENABLED?: string;
    GROQ_API_KEY?: string;
    GEMINI_API_KEY?: string;
  }
): RouteReadiness {
  // Master kill-switch check
  if (env.OHMI_AI_ENABLED !== 'true') {
    return { enabled: false, reason: 'AI generation is paused project-wide (OHMI_AI_ENABLED != true).' };
  }

  if (route.provider === 'groq') {
    if (env.OHMI_GROQ_CHAT_ENABLED !== 'true') {
      return { enabled: false, reason: 'Conversational Ask OHMI is paused (OHMI_GROQ_CHAT_ENABLED != true).' };
    }
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY.trim().length === 0) {
      return { enabled: false, reason: 'Groq API key is not configured.' };
    }
    return { enabled: true };
  }

  if (route.provider === 'gemini') {
    if (env.OHMI_GEMINI_MULTIMODAL_ENABLED !== 'true') {
      return { enabled: false, reason: 'Multimodal circuit analysis is paused (OHMI_GEMINI_MULTIMODAL_ENABLED != true).' };
    }
    if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.trim().length === 0) {
      return { enabled: false, reason: 'Gemini API key is not configured.' };
    }
    return { enabled: true };
  }

  return { enabled: false, reason: `Unknown provider '${(route as { provider: string }).provider}'.` };
}
