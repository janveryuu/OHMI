// Supabase Edge Function: ohmi-ai production request handler
// Approved routes: Gemini multimodal/structured, Groq conversational text.
// Dormosaur-style bounded chat failover, bounded memory/execution, strict Auth verification.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import { answerChat, providerConfigs, consumeChatBurst } from './copilot.ts';
import {
  calculateLedResistor,
  calculateOhmsLaw,
  calculateSeriesResistance,
  calculateParallelResistance,
  calculateResistorPower,
  type CalculationType,
  type CalculationResult
} from './calculations.ts';
import { validateArduinoSketch, type SketchValidationResult } from './arduino.ts';
import { validateCircuitImage } from './image.ts';
import { validatePdfDocument, verifyPageCitation } from './pdf.ts';
import { validateTutorialResult, extractTutorialJson } from './tutorial.ts';
import { circuitResponseSchema, tutorialResponseSchema } from './schemas.ts';
import { validateCircuitRequest, validateCircuitResult, buildCircuitPrompt } from './circuit.ts';
import {
  OHMI_TUTOR_VERSION,
  buildAskSystemInstruction,
  buildTutorialSystemInstruction
} from './tutor-policy.ts';
import type { CircuitRequestV2, CircuitEvidence, CircuitCheckResult } from '../../../src/backend/contracts.ts';

export const MODEL = GEMINI_PRODUCTION_MODEL;
export const MAX_BODY_BYTES = 64 * 1024; // 64 KiB
export const MAX_BODY_BYTES_V1 = 64 * 1024; // 64 KiB
export const MAX_BODY_BYTES_V2 = 6 * 1024 * 1024; // 6 MiB
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MiB
export const MAX_PDF_BYTES = 2 * 1024 * 1024; // 2 MiB
export const DEFAULT_TIMEOUT_MS = 24_000; // text route; structured/media routes have a 40s ceiling

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

export function errorResponse(code: string, message: string, status = 400, retryAfterSeconds?: number) {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json'
  };
  if (retryAfterSeconds) {
    headers['Retry-After'] = String(retryAfterSeconds);
  }
  return new Response(JSON.stringify({ ok: false, code, error: message, retryAfterSeconds }), {
    status,
    headers
  });
}

export async function sha256Hex(data: string): Promise<string> {
  const enc = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256BytesHex(bytes: Uint8Array): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

import {
  resolveAiRoute,
  checkRouteReadiness,
  sanitizeErrorMessage,
  GEMINI_PRODUCTION_MODEL,
  DEFAULT_GROQ_CHAT_MODEL,
  ALLOWED_GROQ_MODELS,
  type ResolvedRoute,
  type AiProvider
} from './provider-policy.ts';
import { abortable, readBoundedBody, ResponseSizeError, callGroqChatCompletions } from './groq.ts';

export interface AiHandlerDependencies {
  env?: {
    OHMI_COPILOT_PROVIDER?: string;
    OHMI_COPILOT_MODEL?: string;
    OHMI_COPILOT_GROQ_MODEL?: string;
    OHMI_COPILOT_GROQ_FALLBACK_MODEL?: string;
    OHMI_COPILOT_GEMINI_MODEL?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    GEMINI_API_KEY?: string;
    GEMINI_FREE_TIER_CONFIRMED?: string;
    GROQ_FREE_TIER_CONFIRMED?: string;
    GROQ_API_KEY?: string;
    GROQ_CHAT_MODEL?: string;
    GEMINI_MODEL?: string;
    OHMI_AI_ENABLED?: string;
    OHMI_GROQ_CHAT_ENABLED?: string;
    OHMI_GEMINI_MULTIMODAL_ENABLED?: string;
    OHMI_AI_PROVIDER?: string;
  };
  createClient?: typeof createClient;
  fetch?: typeof fetch;
  now?: () => number;
  deadline?: number;
  timings?: { last: number; stages: string[] };
}

const getEnv = (key: string, deps?: AiHandlerDependencies): string => {
  if (deps?.env && key in deps.env) {
    return deps.env[key as keyof typeof deps.env] || '';
  }
  if (typeof Deno !== 'undefined' && Deno.env) {
    return Deno.env.get(key) || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

export interface AiTransportRequest {
  provider: 'gemini' | 'groq';
  model: string;
  systemInstruction: string;
  promptText: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  images?: Array<{ mimeType: string; data: string }>;
  pdf?: { mimeType: string; data: string; fileName?: string };
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'text' | 'json_object';
  responseSchema?: Record<string, unknown>;
  geminiApiKey?: string;
  groqApiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface AiTransportResponse {
  ok: true;
  provider: 'gemini' | 'groq';
  model: string;
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
}

export interface AiTransportError {
  ok: false;
  provider: 'gemini' | 'groq';
  model: string;
  status: number;
  code: 'timeout' | 'rate_limit' | 'unavailable' | 'safety' | 'payload_too_large' | 'invalid_json' | 'quota_exhausted' | 'empty_answer' | 'provider_error' | 'truncated';
  message: string;
  retryAfterSeconds?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type AiTransportResult = AiTransportResponse | AiTransportError;

/**
 * Internal unified transport seam for ohmi-ai provider requests.
 * Adapts Gemini and Groq to a single contract returning visible text, model, usage,
 * and normalized error statuses without SDK auto-retries or cross-provider fallbacks.
 */
export async function callAiProviderTransport(req: AiTransportRequest): Promise<AiTransportResult> {
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = req.fetchFn || fetch;

  if (req.provider === 'groq') {
    const groqApiKey = (req.groqApiKey || '').trim();
    if (!groqApiKey) {
      return {
        ok: false,
        provider: 'groq',
        model: req.model,
        status: 500,
        code: 'provider_error',
        message: 'Groq API key is not configured.'
      };
    }

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (req.history && req.history.length > 0) {
      for (const h of req.history) {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: req.promptText });

    const groqRes = await callGroqChatCompletions({
      apiKey: groqApiKey,
      model: req.model,
      systemInstruction: req.systemInstruction,
      messages,
      maxTokens: req.maxTokens,
      timeoutMs,
      fetchFn
    });

    if (!groqRes.ok) {
      return {
        ok: false,
        provider: 'groq',
        model: req.model,
        status: groqRes.status,
        code: groqRes.code,
        message: groqRes.message,
        retryAfterSeconds: groqRes.retryAfterSeconds
      };
    }

    if (req.responseFormat === 'json_object' && groqRes.finishReason === 'length') {
      return { ok: false, provider: 'groq', model: req.model, status: 502, code: 'truncated', promptTokens: groqRes.promptTokens, completionTokens: groqRes.completionTokens, totalTokens: groqRes.totalTokens, message: 'Structured answer reached its token limit; no incomplete guide was saved.' };
    }
    return {
      ok: true,
      provider: 'groq',
      model: groqRes.model,
      text: groqRes.content,
      promptTokens: groqRes.promptTokens,
      completionTokens: groqRes.completionTokens,
      totalTokens: groqRes.totalTokens,
      finishReason: groqRes.finishReason
    };
  }

  // Gemini transport
  const geminiApiKey = (req.geminiApiKey || '').trim();
  if (!geminiApiKey) {
    return {
      ok: false,
      provider: 'gemini',
      model: req.model,
      status: 500,
      code: 'provider_error',
      message: 'Gemini API key is not configured.'
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const contents: any[] = [];
  if (req.history && req.history.length > 0) {
    for (const h of req.history) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    }
  }

  const userParts: any[] = [{ text: req.promptText }];
  if (req.images) {
    for (const img of req.images) {
      userParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      });
    }
  }
  if (req.pdf) {
    userParts.push({
      inlineData: {
        mimeType: req.pdf.mimeType,
        data: req.pdf.data
      }
    });
  }
  contents.push({ role: 'user', parts: userParts });

  let providerRes: Response;
  let responseText: string;
  try {
    providerRes = await abortable(fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.1,
          ...(!req.images?.length && !req.pdf ? { maxOutputTokens: req.maxTokens } : {}),
          thinkingConfig: {
            thinkingLevel: 'LOW',
            includeThoughts: false
          },
          ...(req.responseFormat === 'json_object' ? { responseMimeType: 'application/json' } : {}),
          ...(req.responseSchema ? { responseJsonSchema: req.responseSchema } : {})
        }
      }),
      signal: controller.signal
    }), controller.signal);
    responseText = await readBoundedBody(providerRes, 128 * 1024, controller.signal);
  } catch (err: unknown) {
    const timedOut = controller.signal.aborted;
    return {
      ok: false, provider: 'gemini', model: req.model,
      status: timedOut ? 504 : 502,
      code: timedOut ? 'timeout' : err instanceof ResponseSizeError ? 'payload_too_large' : 'provider_error',
      message: timedOut ? `AI provider timed out after ${timeoutMs / 1000} seconds.` : err instanceof ResponseSizeError ? err.message : 'Provider connection failed.'
    };
  } finally {
    clearTimeout(timer);
  }

  if (!providerRes.ok) {
    const status = providerRes.status;
    let errMsg = `Provider error ${status}`;
    try {
      const errJson = JSON.parse(responseText);
      errMsg = errJson?.error?.message || errMsg;
    } catch { /* empty */ }

    const cleanErr = sanitizeErrorMessage(errMsg, geminiApiKey);
    if (status === 429) {
      return {
        ok: false,
        provider: 'gemini',
        model: req.model,
        status: 429,
        code: 'rate_limit',
        message: cleanErr,
        retryAfterSeconds: 60
      };
    }
    if (status === 503 || status === 502) {
      return {
        ok: false,
        provider: 'gemini',
        model: req.model,
        status,
        code: 'unavailable',
        message: cleanErr,
        retryAfterSeconds: 60
      };
    }
    return {
      ok: false,
      provider: 'gemini',
      model: req.model,
      status: 502,
      code: 'provider_error',
      message: cleanErr
    };
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    return {
      ok: false,
      provider: 'gemini',
      model: req.model,
      status: 502,
      code: 'invalid_json',
      message: 'Provider returned malformed JSON.'
    };
  }

  const promptTokens = data.usageMetadata?.promptTokenCount;
  const candidateTokens = data.usageMetadata?.candidatesTokenCount;
  const hasUsage = typeof promptTokens === 'number' && typeof candidateTokens === 'number';
  const estimatedInput = Math.ceil(new TextEncoder().encode(req.systemInstruction + req.promptText + (req.history || []).map(m => m.content).join('')).byteLength / 2) + (req.images?.length || 0) * 4096 + (req.pdf ? 14048 : 0);
  const inputTokens = hasUsage ? promptTokens : Math.max(1, estimatedInput);
  const outputTokens = hasUsage ? candidateTokens : req.maxTokens;

  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;

  if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'BLOCKLIST') {
    return {
      ok: false,
      provider: 'gemini',
      model: req.model,
      status: 502,
      code: 'safety',
      message: `Provider safety block: ${finishReason}`
    };
  }

  if (finishReason === 'MAX_TOKENS' && req.responseFormat === 'json_object') {
    return { ok: false, provider: 'gemini', model: req.model, status: 502, code: 'truncated',
      promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: Math.max(inputTokens + outputTokens + (Number(data.usageMetadata?.thoughtsTokenCount) || 0), Number(data.usageMetadata?.totalTokenCount) || 0),
      message: 'Structured answer reached its token limit; no incomplete guide or review was saved.' };
  }

  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    return {
      ok: false,
      provider: 'gemini',
      model: req.model,
      status: 502,
      code: 'unavailable',
      message: `Provider response not complete: ${finishReason}`
    };
  }

  const rawParts = candidate?.content?.parts;
  let answerText = '';
  if (Array.isArray(rawParts)) {
    answerText = rawParts
      .filter((p: any) => p && typeof p.text === 'string' && !p.thought)
      .map((p: any) => p.text)
      .join('');
  } else if (typeof rawParts?.[0]?.text === 'string') {
    answerText = rawParts[0].text;
  }

  if (!answerText || !answerText.trim()) {
    return {
      ok: false,
      provider: 'gemini',
      model: req.model,
      status: 502,
      code: 'empty_answer',
      message: 'Provider returned empty candidate.'
    };
  }

  if (answerText.length > 17800 || new TextEncoder().encode(answerText).byteLength > 64 * 1024 - 200) {
    return { ok: false, provider: 'gemini', model: req.model, status: 502, code: 'payload_too_large', message: 'Visible answer exceeded its supported size.' };
  }
  return {
    ok: true,
    provider: 'gemini',
    model: req.model,
    text: answerText,
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens: Math.max(inputTokens + outputTokens + (Number(data.usageMetadata?.thoughtsTokenCount) || 0), Number(data.usageMetadata?.totalTokenCount) || 0),
    finishReason: finishReason || 'STOP'
  };
}

export async function handleAiRequest(req: Request, deps?: AiHandlerDependencies): Promise<Response> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  const backendFetch: typeof fetch = (input, init) => abortable(fetch(input, {
    ...init, signal: AbortSignal.any([controller.signal, ...(init?.signal ? [init.signal] : [])])
  }), controller.signal);
  const timings = { last: started, stages: [] as string[] };
  try {
    const response = await abortable(handleAiRequestWithinBudget(req, { ...deps, deadline: started + 50_000,
      timings,
      createClient: deps?.createClient || ((url, key, options) => createClient(url, key, { ...options,
        global: { ...options?.global, fetch: backendFetch } })) as typeof createClient
    }), controller.signal);
    response.headers.set('Server-Timing', [...timings.stages, `total;dur=${Date.now() - started}`].join(', '));
    return response;
  } catch (error) {
    if (error instanceof ResponseSizeError) return errorResponse('payload_too_large', 'Request body exceeds its supported byte limit.', 413);
    // A lost database acknowledgement is ambiguous: retain the UUID and recover, never regenerate.
    return errorResponse('request_uncertain', 'OHMI could not confirm completion. Check this request again before starting a new one.', 504);
  } finally { clearTimeout(timer); }
}

function markStage(deps: AiHandlerDependencies | undefined, name: string) {
  if (!deps?.timings) return;
  const now = Date.now();
  deps.timings.stages.push(`${name};dur=${now - deps.timings.last}`);
  deps.timings.last = now;
}

function chatEnvironment(deps?: AiHandlerDependencies) {
  return Object.fromEntries(['GROQ_API_KEY', 'GEMINI_API_KEY', 'OHMI_COPILOT_PROVIDER', 'OHMI_COPILOT_MODEL', 'OHMI_COPILOT_GROQ_MODEL', 'OHMI_COPILOT_GROQ_FALLBACK_MODEL', 'OHMI_COPILOT_GEMINI_MODEL'].map(key => [key, getEnv(key, deps) || undefined]));
}

function routeReadiness(route: ResolvedRoute, deps?: AiHandlerDependencies): Response | undefined {
  const readiness = checkRouteReadiness(route, {
    OHMI_AI_ENABLED: getEnv('OHMI_AI_ENABLED', deps),
    GEMINI_FREE_TIER_CONFIRMED: getEnv('GEMINI_FREE_TIER_CONFIRMED', deps),
    GROQ_FREE_TIER_CONFIRMED: getEnv('GROQ_FREE_TIER_CONFIRMED', deps),
    OHMI_GROQ_CHAT_ENABLED: getEnv('OHMI_GROQ_CHAT_ENABLED', deps),
    OHMI_GEMINI_MULTIMODAL_ENABLED: getEnv('OHMI_GEMINI_MULTIMODAL_ENABLED', deps),
    GROQ_API_KEY: getEnv('GROQ_API_KEY', deps), GEMINI_API_KEY: getEnv('GEMINI_API_KEY', deps)
  });
  if (!readiness.enabled) return errorResponse('unavailable', 'This AI route is paused or its credentials are unavailable. No generation was started.', 503);
}

function providerTimeout(structuredOrMedia: boolean, deps?: AiHandlerDependencies): number {
  return Math.max(1, Math.min(structuredOrMedia ? 40_000 : DEFAULT_TIMEOUT_MS, (deps?.deadline ?? Date.now() + 50_000) - Date.now() - 5_000));
}

async function handleAiRequestWithinBudget(req: Request, deps?: AiHandlerDependencies): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('invalid_request', 'Method not allowed. Use POST.', 405);
  }

  // Check Kill Switch
  const aiEnabled = getEnv('OHMI_AI_ENABLED', deps);
  if (aiEnabled !== 'true') {
    return errorResponse('unavailable', 'AI tutoring is currently unavailable. Server kill switch active.', 503);
  }

  // 1. Verify Supabase Auth JWT
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return errorResponse('auth_error', 'Missing authorization token.', 401);
  }

  const supabaseUrl = getEnv('SUPABASE_URL', deps);
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', deps);
  const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', deps);
  const geminiApiKey = getEnv('GEMINI_API_KEY', deps);
  const groqApiKey = getEnv('GROQ_API_KEY', deps);

  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse('server_error', 'Supabase backend configuration is missing.', 500);
  }

  const clientFactory = deps?.createClient || createClient;

  // User auth client
  const userClient = clientFactory(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user || user.is_anonymous) {
    return errorResponse('auth_error', 'Sign in to use the AI assistant.', 401);
  }

  markStage(deps, 'auth');

  // Service role client for atomic reservation & quota accounting
  const adminClient = clientFactory(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 2. Validate request body bounds
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES_V2) {
    return errorResponse('payload_too_large', 'Request body exceeds 6 MiB limit.', 413);
  }

  const rawBody = await readBoundedBody(new Response(req.body), MAX_BODY_BYTES_V2);
  if (rawBody.length > MAX_BODY_BYTES_V2) {
    return errorResponse('payload_too_large', 'Request body exceeds 6 MiB limit.', 413);
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse('invalid_request', 'Invalid JSON body.', 400);
  }

  if (body?.provider || body?.baseUrl) {
    return errorResponse('invalid_request', 'Client model/provider override is prohibited.', 400);
  }

  markStage(deps, 'body');
  if (body?.version === 2) {
    return handleCircuitCheckRequest(body, rawBody, user, token, adminClient, userClient, deps);
  }

  if (body?.version === 1) {
    if (contentLength > MAX_BODY_BYTES_V1 || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES_V1) {
      return errorResponse('payload_too_large', 'Request body exceeds 64 KiB limit.', 413);
    }
  } else {
    return errorResponse('invalid_request', 'Unsupported contract version. Expected version 1.', 400);
  }

  const {
    version,
    requestId,
    operation = 'chat',
    language = 'english',
    message = '',
    code,
    context = [],
    calculation,
    assignmentId,
    circuitAnalysisId,
    conversationId,
    historyThroughPosition
  } = body;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!requestId || !uuidRegex.test(requestId)) {
    return errorResponse('invalid_request', 'A valid UUID requestId is required.', 400);
  }

  if (circuitAnalysisId !== undefined && !uuidRegex.test(circuitAnalysisId)) {
    return errorResponse('invalid_request', 'Invalid circuitAnalysisId format.', 400);
  }

  if (operation === 'chat' && (assignmentId || body?.images || body?.pdf)) {
    return errorResponse('invalid_request', 'Chat operation cannot contain attachments. Use pdf or image operation.', 400);
  }

  let route = resolveAiRoute(operation, {
    circuitAnalysisId,
    hasArtifactReference: Boolean(circuitAnalysisId)
  }, getEnv('GROQ_CHAT_MODEL', deps));
  const plainChat = operation === 'chat' && !circuitAnalysisId;
  if (plainChat) {
    if (getEnv('OHMI_GROQ_CHAT_ENABLED', deps) === 'false') return errorResponse('unavailable', 'Chat is paused.', 503);
    const first = providerConfigs(chatEnvironment(deps))[0];
    if (first) route = { ...route, provider: first.provider, model: first.model };
  } else {
    const notReady = routeReadiness(route, deps);
    if (notReady) return notReady;
  }

  if (!['chat', 'image', 'pdf', 'tutorial'].includes(operation)) {
    return errorResponse('invalid_request', 'Invalid operation.', 400);
  }

  if (!['english', 'filipino', 'taglish'].includes(language)) {
    return errorResponse('invalid_request', 'Invalid language preference.', 400);
  }

  if (typeof message !== 'string' || message.length > 3000) {
    return errorResponse('invalid_request', 'Message must be a string up to 3,000 characters.', 400);
  }

  if (code !== undefined && (typeof code !== 'string' || code.length > 8000)) {
    return errorResponse('invalid_request', 'Code must be a string up to 8,000 characters.', 400);
  }

  if (assignmentId !== undefined && !uuidRegex.test(assignmentId)) {
    return errorResponse('invalid_request', 'Invalid assignmentId format.', 400);
  }

  if (conversationId !== undefined && !uuidRegex.test(conversationId)) {
    return errorResponse('invalid_request', 'Invalid conversationId format.', 400);
  }

  if (historyThroughPosition !== undefined) {
    if (typeof historyThroughPosition !== 'number' || !Number.isInteger(historyThroughPosition) || historyThroughPosition < 0) {
      return errorResponse('invalid_request', 'Invalid historyThroughPosition.', 400);
    }
  }

  // 3. Optional owned file retrieval (for image / pdf / assignment-backed tutorial)
  let inlineMediaPart: { inlineData: { mimeType: string; data: string } } | undefined;
  let fileHash = '';
  let extractedPdfPages: string[] = [];

  if (['image', 'pdf'].includes(operation) || (operation === 'tutorial' && assignmentId)) {
    if (!assignmentId) {
      return errorResponse('invalid_request', 'assignmentId is required for this operation.', 400);
    }

    const { data: assignment, error: assignErr } = await userClient
      .from('ohmi_assignments')
      .select('id, user_id, original_name, object_path, mime_type, size_bytes, status')
      .eq('id', assignmentId)
      .eq('user_id', user.id)
      .single();

    if (assignErr || !assignment) {
      return errorResponse('not_found', 'Assignment not found or unowned.', 404);
    }

    if (assignment.status !== 'ready') {
      return errorResponse('invalid_request', 'Assignment upload is not ready.', 400);
    }

    const isPdfFile = assignment.mime_type === 'application/pdf';
    const isImgFile = assignment.mime_type.startsWith('image/');

    // Operation-to-source MIME matching
    if (operation === 'image' && !isImgFile) {
      return errorResponse('invalid_request', 'Assignment file is not an image.', 400);
    }
    if (operation === 'pdf' && !isPdfFile) {
      return errorResponse('invalid_request', 'Assignment file is not a PDF.', 400);
    }
    if (operation === 'tutorial' && !isImgFile && !isPdfFile) {
      return errorResponse('invalid_request', 'Unsupported assignment file format.', 415);
    }

    if (isImgFile && assignment.size_bytes > MAX_IMAGE_BYTES) {
      return errorResponse('payload_too_large', 'Image size exceeds 4 MiB limit.', 413);
    }
    if (isPdfFile && assignment.size_bytes > MAX_PDF_BYTES) {
      return errorResponse('payload_too_large', 'PDF size exceeds 2 MiB limit.', 413);
    }

    // Download original bytes from private storage
    const { data: fileBlob, error: downloadErr } = await adminClient.storage
      .from('ohmi-assignments')
      .download(assignment.object_path);

    if (downloadErr || !fileBlob) {
      return errorResponse('not_found', 'Stored file object could not be retrieved.', 404);
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    // Direct raw byte hash (P4-7)
    fileHash = await sha256BytesHex(fileBytes);

    if (isImgFile) {
      const imgVal = validateCircuitImage(fileBytes);
      if (!imgVal.valid) {
        const isSizeErr = imgVal.error?.includes('exceed');
        return errorResponse(isSizeErr ? 'payload_too_large' : 'invalid_request', imgVal.error || 'Invalid image file.', isSizeErr ? 413 : 415);
      }
      inlineMediaPart = {
        inlineData: {
          mimeType: imgVal.mimeType!,
          data: Buffer.from(fileBytes).toString('base64')
        }
      };
    } else if (isPdfFile) {
      const pdfVal = await validatePdfDocument(fileBytes);
      if (!pdfVal.valid) {
        const isSizeErr = pdfVal.error?.includes('exceed');
        return errorResponse(isSizeErr ? 'payload_too_large' : 'invalid_request', pdfVal.error || 'Invalid PDF file.', isSizeErr ? 413 : 415);
      }
      extractedPdfPages = pdfVal.textByPage || [];
      inlineMediaPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: Buffer.from(fileBytes).toString('base64')
        }
      };
    }
  }

  markStage(deps, 'media');

  // 4. Deterministic calculations and Arduino checks
  let calculationResult: CalculationResult | undefined;
  if (calculation && typeof calculation === 'object') {
    const calcType = calculation.type as CalculationType;
    const ops = calculation.operands || {};
    if (calcType === 'led_resistor') {
      calculationResult = calculateLedResistor({ supplyVoltage: ops.supplyVoltage, forwardVoltage: ops.forwardVoltage, targetCurrent: ops.targetCurrent });
    } else if (calcType === 'ohms_law') {
      calculationResult = calculateOhmsLaw(ops);
    } else if (calcType === 'series_resistance') {
      calculationResult = calculateSeriesResistance({ resistors: ops.resistors });
    } else if (calcType === 'parallel_resistance') {
      calculationResult = calculateParallelResistance({ resistors: ops.resistors });
    } else if (calcType === 'resistor_power') {
      calculationResult = calculateResistorPower(ops);
    }
  }

  let arduinoValidation: SketchValidationResult | undefined;
  const sketchToValidate = code || (typeof message === 'string' && /void\s+setup/i.test(message) ? message : undefined);
  if (sketchToValidate) {
    arduinoValidation = validateArduinoSketch(sketchToValidate);
  }

  // 4b. Canonical context resolution (Milestone F3)
  let canonicalHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let watermark: number | undefined = undefined;

  if (conversationId && historyThroughPosition !== undefined) {
    const { data: convData, error: convErr } = await userClient
      .from('ohmi_conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (convErr || !convData) {
      return errorResponse('forbidden', 'Conversation not found or access denied.', 403);
    }

    const { data: maxPosData } = await adminClient
      .from('ohmi_messages')
      .select('position')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentHead = maxPosData?.position ?? 0;
    if (historyThroughPosition > currentHead) {
      return errorResponse('invalid_request', 'historyThroughPosition exceeds current conversation head.', 400);
    }

    watermark = historyThroughPosition;

    if (historyThroughPosition > 0) {
      const { data: candidateMsgs } = await adminClient
        .from('ohmi_messages')
        .select('role, content, position')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .lte('position', historyThroughPosition)
        .order('position', { ascending: false })
        .limit(24);

      if (Array.isArray(candidateMsgs) && candidateMsgs.length > 0) {
        const chronological = [...candidateMsgs].reverse();
        let totalChars = 0;
        const recentSubset: typeof chronological = [];
        for (let i = chronological.length - 1; i >= 0 && recentSubset.length < 24; i--) {
          const item = chronological[i];
          const content = (item.content || '').slice(0, 3000);
          if (totalChars + content.length > 16000) break;
          totalChars += content.length;
          recentSubset.unshift({ ...item, content });
        }

        if (recentSubset.length > 0 && recentSubset[0].role === 'assistant') {
          recentSubset.shift();
        }

        for (const m of recentSubset) {
          if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
            canonicalHistory.push({
              role: m.role,
              content: m.content
            });
          }
        }
      }
    }
  } else {
    // Legacy client context fallback
    if (Array.isArray(context)) {
      for (const item of context.slice(-24)) {
        if (item && typeof item.text === 'string' && (item.role === 'user' || item.role === 'assistant')) {
          canonicalHistory.push({
            role: item.role,
            content: item.text.slice(0, 3000)
          });
        }
      }
    }
  }

  let historyChars = 0;
  canonicalHistory = canonicalHistory.reverse().filter(m => { historyChars += m.content.length; return historyChars <= 16000; }).reverse();
  markStage(deps, 'context');

  // Canonical input hash including conversationId and history snapshot (P4-7 / F3)
  const inputHash = await sha256Hex(JSON.stringify({
    version: 1,
    provider: route.provider,
    model: route.model,
    operation,
    language,
    message: message.trim(),
    code: code?.trim() ?? '',
    calculation: calculation ?? null,
    assignmentId: assignmentId ?? '',
    circuitAnalysisId: circuitAnalysisId ?? '',
    conversationId: conversationId ?? '',
    historyThroughPosition: historyThroughPosition ?? null,
    fileHash,
    context: canonicalHistory
  }));

  // 5. Atomic Quota and In-flight Reservation
  const targetId = assignmentId || conversationId || null;
  const systemInstruction = operation === 'tutorial'
    ? buildTutorialSystemInstruction(language)
    : buildAskSystemInstruction(language, operation);
  const maxTokens = operation === 'tutorial' ? 4096 : operation === 'pdf' ? 3072 : operation === 'image' ? 2048 : 2560;
  const reserveKind = (operation === 'tutorial' && !assignmentId) ? 'chat' : operation;
  const reserveResult = await adminClient.rpc('ohmi_reserve_ai', {
    p_user_id: user.id,
    p_request_id: requestId,
    p_kind: reserveKind,
    p_estimated_tokens: null,
    p_target: targetId,
    p_hash: inputHash,
    p_language: language,
    p_model: route.model,
    p_conversation_id: conversationId || null
  });
  if (reserveResult.error) {
    const msg = reserveResult.error.message || 'AI request reservation failed.';
    if (/cooldown/i.test(msg)) {
      return errorResponse('rate_limit', 'AI provider is in cooldown. Please wait a minute and retry.', 429, 60);
    }
    if (/progress/i.test(msg)) {
      return errorResponse('rate_limit', 'An AI request is currently in progress. Please wait a few seconds.', 429, 10);
    }
    if (/limit/i.test(msg)) {
      return errorResponse('rate_limit', msg, 429, 60);
    }
    if (/replay does not match/i.test(msg)) {
      return errorResponse('conflict', 'RequestId already used with different parameters.', 409);
    }
    return errorResponse('invalid_request', msg, 400);
  }

  markStage(deps, 'reservation');
  const reservation = reserveResult.data;
  if (!reservation.fresh) {
    // Replay of existing request
    if (reservation.status === 'completed') {
      // P4-3 / P4-7: Restore exact original structured result
      let replayedResult: any = reservation.result_payload || null;

      if (!replayedResult && reservation.conversation_id) {
        const { data: msg } = await adminClient
          .from('ohmi_messages')
          .select('content, structured_result')
          .eq('request_id', requestId)
          .eq('role', 'assistant')
          .maybeSingle();

        if (msg?.structured_result) {
          replayedResult = msg.structured_result;
          if (!replayedResult.answer && msg?.content) {
            replayedResult.answer = msg.content;
          }
        } else if (msg?.content) {
          replayedResult = { status: 'answer', answer: msg.content };
        }
      }

      if (!replayedResult) return errorResponse('result_unavailable', 'The saved result is no longer available. No new generation was started.', 404);

      return jsonResponse({
        ok: true,
        requestId,
        accountId: user.id,
        operation,
        language,
        result: replayedResult,
        model: replayedResult.model || reservation.model || route.model,
        provider: replayedResult.provider || (reservation.model?.startsWith('gemini') ? 'gemini' : route.provider),
        ...(conversationId ? { conversationId, historyWatermark: watermark !== undefined ? watermark + 2 : undefined } : {})
      });
    }
    if (reservation.status === 'pending') {
      return errorResponse('in_progress', 'This request is currently being processed.', 429, 10);
    }
    return errorResponse('failed', 'This request previously failed. Please submit a new question.', 400);
  }

    // 6. Build prompt & invoke AI provider (zero automatic retries)


  if (plainChat && !consumeChatBurst(user.id)) {
    await adminClient.rpc('ohmi_fail_ai', { p_request_id: requestId, p_error_code: 'rate_limit', p_model: route.model, p_input_tokens: 0, p_output_tokens: 0, p_accounted_tokens: 0 });
    return errorResponse('rate_limit', 'Please wait a minute before trying again.', 429, 60);
  }
  const historyList = canonicalHistory;

  let promptText = message;
  if (code) {
    promptText += `\n\nArduino Code:\n\`\`\`cpp\n${code}\n\`\`\``;
  }
  if (calculationResult && calculationResult.valid) {
    promptText += `\n\n[Deterministic Calculation Verified Result]: ${JSON.stringify(calculationResult.formatted)}`;
  }
  if (arduinoValidation && arduinoValidation.warnings.length > 0) {
    promptText += `\n\n[Automated Arduino Checks]:\n${arduinoValidation.warnings.join('\n')}`;
  }
  if (circuitAnalysisId) {
    const { data: circuitArtifact } = await userClient
      .from('ohmi_analyses')
      .select('id, user_id, title, payload, artifact_kind')
      .eq('id', circuitAnalysisId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (circuitArtifact && circuitArtifact.artifact_kind === 'circuit_check') {
      const p = circuitArtifact.payload;
      const findings = Array.isArray(p?.findings)
        ? p.findings.slice(0, 5).map((f: any) => `${f.title || f.category}: ${f.message}`).join('; ')
        : '';
      promptText += `\n\n[Prior Circuit Review Observations (Prior Model Feedback)]: ${circuitArtifact.title || 'Review'}. Findings: ${findings || 'None noted.'}`;
    }
  }
  if (operation === 'image') {
    promptText += '\n\nPlease analyze this circuit screenshot. Describe the visible components, wiring connections, and any potential mistakes or wiring issues you notice. Clearly state any uncertainties.';
  } else if (operation === 'pdf') {
    const isSpecificOrContinuation = Boolean(
      body?.continuation ||
      body?.isContinuation ||
      /continue|resum|task\s*\d+|part\s*\d+|question\s*\d+|calculate|solve|find/i.test(message)
    );
    if (!isSpecificOrContinuation) {
      promptText += '\n\nPlease analyze this electronics assignment PDF. Identify the main learning objective, required components, pin connections, and deliverables. Cite specific page numbers for each requirement.';
    } else if (body?.continuation || body?.isContinuation || /continue|resum/i.test(message)) {
      promptText += '\n\n[Continuation Instruction]: The previous explanation was paused at the output length limit. Continue the explanation directly from the exact formula or sentence where it stopped. Do not repeat previously completed derivations or questions; provide the remaining calculations, units, and solutions clearly.';
    }
  } else if (operation === 'tutorial') {
    promptText += `\n\nPlease provide an ordered, grounded step-by-step assembly guide for a beginner building this circuit in Tinkercad Circuits.
Follow this strict pedagogical sequence:
1. Identify and gather all required parts first (create a complete components list with standard ratings/values).
2. Locate each part in Tinkercad using the search bar (explain searching the exact component name).
3. Place and orient components on the workspace/breadboard. (Ask the student to choose and confirm breadboard rows/pins; never invent unseen pin locations or assume unverified board models).
4. Wire one connection at a time. Explain the purpose of each terminal/pin (e.g. anode vs cathode, 5V vs GND, signal pin).
5. Check power, polarity, and resistor/component ratings before connecting power.
6. If Arduino code is needed, explain pin mapping in setup() and loop(), matching the confirmed wiring.
7. Instruct the student on starting the Tinkercad simulation manually and what observable behavior to expect.
8. Include single-variable troubleshooting checkpoints.

Respond with a JSON object formatted as:
{
  "status": "tutorial" | "needs_clarification",
  "title": "Title of the tutorial",
  "objective": "Clear learning objective",
  "components": [
    { "name": "Component Name", "quantity": 1, "notes": "e.g. 220 Ω standard E12 resistor" }
  ],
  "steps": [
    {
      "step": 1,
      "instruction": "One manageable action describing what to place or wire",
      "why": "Clear electronics explanation of why this step is required",
      "check": "Concrete visible checkpoint the student verifies before proceeding",
      "code": "optional code snippet"
    }
  ],
  "code": "optional complete Arduino sketch if required",
  "clarificationQuestions": ["Question 1 if status is needs_clarification"],
  "notes": "Explanation of any assumptions, clarifications, or component guidance"
}
If requirements, supply voltage, or component values are missing or contradictory, set "status": "needs_clarification", ask specific clarification questions in "clarificationQuestions", explain in "notes", and leave "steps" empty.
For a feasible circuit, set "status": "tutorial". Each step MUST include non-empty "instruction", "why", and "check". Step numbers MUST be sequential 1, 2, 3... up to 24. Use concise instruction/why/check text, avoid repeating the sketch in individual steps, and finish the complete JSON and any required sketch within the output budget.`;
  }

  let mediaImage: { mimeType: string; data: string } | undefined;
  let mediaPdf: { mimeType: string; data: string; fileName?: string } | undefined;
  if (inlineMediaPart) {
    if (inlineMediaPart.inlineData.mimeType === 'application/pdf') {
      mediaPdf = {
        mimeType: 'application/pdf',
        data: inlineMediaPart.inlineData.data,
        fileName: 'assignment.pdf'
      };
    } else {
      mediaImage = {
        mimeType: inlineMediaPart.inlineData.mimeType,
        data: inlineMediaPart.inlineData.data
      };
    }
  }

  // Call provider through unified transport seam
  const chatAnswer = plainChat ? await answerChat({
    env: chatEnvironment(deps), system: systemInstruction, messages: [...historyList, { role: 'user', content: message }],
    snapshot: JSON.stringify({ code: code || null, arduinoWarnings: arduinoValidation?.warnings || [] }),
    fetch: deps?.fetch || fetch, deadline: (deps?.deadline ?? Date.now() + 50000) - 5000,
    calculation: calculationResult?.valid ? `Verified calculation: ${Object.entries(calculationResult.formatted).map(([key, value]) => `${key}: ${value}`).join('; ')}` : undefined
  }) : undefined;
  const transportRes: AiTransportResult = chatAnswer ? { ok: true, provider: chatAnswer.provider === 'gemini' ? 'gemini' : 'groq', model: chatAnswer.model, text: chatAnswer.answer, promptTokens: chatAnswer.promptTokens, completionTokens: chatAnswer.completionTokens, totalTokens: chatAnswer.totalTokens, finishReason: 'STOP' } : await callAiProviderTransport({
    provider: route.provider,
    model: route.model,
    systemInstruction,
    promptText,
    history: historyList,
    images: mediaImage ? [mediaImage] : undefined,
    pdf: mediaPdf,
    maxTokens,
    responseFormat: operation === 'tutorial' ? 'json_object' : 'text',
    responseSchema: operation === 'tutorial' ? tutorialResponseSchema : undefined,
    geminiApiKey,
    groqApiKey,
    timeoutMs: Math.min(providerTimeout(operation !== 'chat' || !!circuitAnalysisId, deps), ['image', 'pdf'].includes(operation) ? 25000 : 40000),
    fetchFn: deps?.fetch || fetch
  });

  markStage(deps, 'provider');
  if (!transportRes.ok) {
    const errCode = transportRes.code === 'payload_too_large' && transportRes.message.includes('truncated')
      ? 'truncated'
      : transportRes.code;

    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: requestId,
      p_error_code: errCode,
      ...(transportRes.totalTokens !== undefined ? { p_input_tokens: transportRes.promptTokens, p_output_tokens: transportRes.completionTokens, p_accounted_tokens: transportRes.totalTokens } : {}),
      p_error_message: transportRes.message.slice(0, 200),
      p_model: route.model
    });

    if (transportRes.code === 'rate_limit' || transportRes.code === 'unavailable' || transportRes.code === 'quota_exhausted') {
      return errorResponse(
        transportRes.code,
        transportRes.code === 'quota_exhausted' ? 'AI provider free quota is exhausted or expired. Please retry shortly.' : 'AI provider is temporarily busy or rate limited. Try again in a minute.',
        transportRes.code === 'quota_exhausted' ? 503 : transportRes.status,
        transportRes.retryAfterSeconds || 60
      );
    }

    if (transportRes.code === 'timeout') {
      return errorResponse('timeout', transportRes.message, 504);
    }

    if (transportRes.code === 'truncated') return errorResponse('truncated', transportRes.message, 502);

    if (transportRes.code === 'payload_too_large') {
      return errorResponse('payload_too_large', 'AI response exceeded maximum allowed size.', 502);
    }

    if (transportRes.code === 'safety') {
      return errorResponse('unavailable', 'AI response was filtered by safety guidelines.', 502);
    }

    if (transportRes.code === 'empty_answer') {
      return errorResponse('unavailable', 'AI returned no answer. Try rephrasing your question.', 502);
    }

    if (transportRes.code === 'invalid_json') {
      return errorResponse('unavailable', 'Received invalid response from AI provider.', 502);
    }

    return errorResponse('provider_error', 'AI provider returned an error.', 502);
  }

  const incomplete = ['MAX_TOKENS', 'length'].includes(transportRes.finishReason);
  let baseAnswer = transportRes.text;
  if (incomplete) {
    const codeBlockCount = (baseAnswer.match(/```/g) || []).length;
    if (codeBlockCount % 2 === 1) baseAnswer += '\n```';
    const displayMathCount = (baseAnswer.match(/\$\$/g) || []).length;
    if (displayMathCount % 2 === 1) {
      baseAnswer += '\n$$';
    } else {
      const inlineMathCount = (baseAnswer.replace(/\\\$/g, '').match(/\$/g) || []).length;
      if (inlineMathCount % 2 === 1) baseAnswer += '$';
    }
  }
  const answerText = baseAnswer + (incomplete ? '\n\n[Answer incomplete: the output token limit was reached. Continue the answer to see the remaining explanation.]' : '');
  const inputTokens = transportRes.promptTokens;
  const outputTokens = transportRes.completionTokens;

  // 8. Atomically complete the AI request
  let resultPayload: any = {
    status: 'answer',
    answer: answerText,
    ...(chatAnswer ? { mode: chatAnswer.mode, provider: chatAnswer.provider, model: chatAnswer.runtimeModel || chatAnswer.model } : {}),
    ...(incomplete ? { incomplete: true, continuation: { operation, ...(assignmentId ? { assignmentId } : {}), ...(circuitAnalysisId ? { circuitAnalysisId } : {}) } } : {}),
    ...(calculationResult ? { calculation: calculationResult } : {}),
    ...(arduinoValidation ? { arduinoValidation } : {})
  };

  if (operation === 'tutorial') {
    const rawParsed = extractTutorialJson(answerText);
    if (!rawParsed) {
      await adminClient.rpc('ohmi_fail_ai', {
        p_request_id: requestId,
        p_error_code: 'invalid_tutorial',
        p_input_tokens: inputTokens, p_output_tokens: outputTokens, p_accounted_tokens: transportRes.totalTokens,
        p_error_message: 'Failed to extract JSON from tutorial response.',
        p_model: MODEL
      });
      return errorResponse('unavailable', 'Received invalid tutorial format from AI provider.', 502);
    }

    const tutVal = validateTutorialResult(rawParsed);
    if (!tutVal.valid || !tutVal.result) {
      await adminClient.rpc('ohmi_fail_ai', {
        p_request_id: requestId,
        p_error_code: 'invalid_tutorial',
        p_input_tokens: inputTokens, p_output_tokens: outputTokens, p_accounted_tokens: transportRes.totalTokens,
        p_error_message: tutVal.error || 'Tutorial validation failed.',
        p_model: route.model
      });
      return errorResponse('unavailable', tutVal.error || 'Tutorial did not meet required format.', 502);
    }

    const tutorialSynopsis = tutVal.result.answer || (tutVal.result.status === 'tutorial'
      ? `Here is your step-by-step guide for ${tutVal.result.title || 'your circuit'} with ${tutVal.result.steps?.length || 0} steps.`
      : tutVal.result.notes || 'Tutorial details');

    resultPayload = {
      ...tutVal.result,
      answer: tutorialSynopsis,
      ...(calculationResult ? { calculation: calculationResult } : {}),
      ...(arduinoValidation ? { arduinoValidation } : (tutVal.result.arduinoValidation ? { arduinoValidation: tutVal.result.arduinoValidation } : {}))
    };
  }

  // If PDF analysis, verify citations if present against extracted text (P4-5)
  if (operation === 'pdf' && extractedPdfPages.length > 0 && Array.isArray(resultPayload.requirements)) {
    for (const req of resultPayload.requirements) {
      if (req.sourceReference && req.sourceReference.kind === 'pdf' && typeof req.sourceReference.page === 'number') {
        const citationCheck = verifyPageCitation(extractedPdfPages, req.sourceReference.page, req.sourceReference.excerpt || '');
        req.sourceReference.verified = citationCheck.verified;
      }
    }
  }

  markStage(deps, 'validation');
  const completeRes = await adminClient.rpc('ohmi_complete_ai', {
    p_request_id: requestId,
    p_output: {
      ...resultPayload,
      message,
      prompt_version: OHMI_TUTOR_VERSION,
      ...(fileHash ? { source_hash: fileHash } : {})
    },
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_accounted_tokens: transportRes.totalTokens,
    p_model: chatAnswer?.model || route.model
  });

  markStage(deps, 'persistence');
  if (completeRes.error) {
    return errorResponse('server_error', 'Failed to save completed AI response.', 500);
  }

  return jsonResponse({
    ok: true,
    requestId,
    accountId: user.id,
    operation,
    language,
    result: resultPayload,
    model: chatAnswer?.runtimeModel || chatAnswer?.model || route.model,
    provider: chatAnswer?.provider || route.provider,
    ...(conversationId ? { conversationId, historyWatermark: watermark !== undefined ? watermark + 2 : undefined } : {})
  });
}

export async function handleCircuitCheckRequest(
  body: any,
  rawBody: string,
  user: any,
  token: string,
  adminClient: any,
  userClient: any,
  deps?: AiHandlerDependencies
): Promise<Response> {
  if (body?.provider || body?.baseUrl) {
    return errorResponse('invalid_request', 'Client model/provider override is prohibited.', 400);
  }

  const geminiApiKey = getEnv('GEMINI_API_KEY', deps);
  const route = resolveAiRoute('circuit_check');
  const notReady = routeReadiness(route, deps);
  if (notReady) return notReady;

  // 1. Validate V2 Request schema and semantic bounds
  let reqV2: CircuitRequestV2;
  try {
    reqV2 = validateCircuitRequest(body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid circuit request.';
    const isTooLarge = /exceed|too large/i.test(msg);
    return errorResponse(isTooLarge ? 'payload_too_large' : 'invalid_request', msg, isTooLarge ? 413 : 400);
  }

  // Verify accountId if provided matches authenticated user
  if (reqV2.accountId && reqV2.accountId !== user.id) {
    return errorResponse('auth_error', 'Account mismatch.', 401);
  }

  // 2. Resolve server-side evidence & foreign/stale references
  const imageIds = reqV2.images.map(img => img.id);
  const codeLineCount = reqV2.code ? reqV2.code.split(/\r?\n/).length : 0;
  let requirementIds: string[] = [];
  let priorFindingIds: string[] = [];

  // If assignment is referenced
  if (reqV2.assignmentId) {
    const { data: assignment, error: assignErr } = await userClient
      .from('ohmi_assignments')
      .select('id, user_id, status')
      .eq('id', reqV2.assignmentId)
      .eq('user_id', user.id)
      .single();

    if (assignErr || !assignment) {
      return errorResponse('not_found', 'Assignment not found or unowned.', 404);
    }
  }

  let requirements: Array<{ id: string; text: string; kind?: string }> | undefined;

  // If assignment analysis is referenced (for verified requirements)
  if (reqV2.assignmentAnalysisId) {
    let query = userClient
      .from('ohmi_analyses')
      .select('id, user_id, assignment_id, payload')
      .eq('id', reqV2.assignmentAnalysisId)
      .eq('user_id', user.id);

    if (reqV2.assignmentId) {
      query = query.eq('assignment_id', reqV2.assignmentId);
    }

    const { data: analysis, error: analysisErr } = await query.single();
    if (analysisErr || !analysis) {
      return errorResponse('not_found', 'Referenced assignment analysis not found or unowned.', 404);
    }

    if (analysis.payload?.requirements && Array.isArray(analysis.payload.requirements)) {
      requirements = analysis.payload.requirements
        .filter((r: any) => r && typeof r.id === 'string' && typeof r.text === 'string')
        .slice(0, 8)
        .map((r: any) => ({
          id: r.id,
          text: r.text,
          kind: r.kind || 'requirement'
        }));
      requirementIds = (requirements || []).map(r => r.id);
    }
  }

  // If manual requirement text is provided
  if (reqV2.requirementText) {
    const rawLines = reqV2.requirementText
      .split(/\r?\n/)
      .map(l => l.trim().replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(l => l.length > 0);
    const items = rawLines.length > 0 ? rawLines.slice(0, 8) : [reqV2.requirementText.trim()];
    requirements = items.map((text, idx) => ({
      id: `manual-${idx + 1}`,
      text,
      kind: 'behavior'
    }));
    requirementIds = (requirements || []).map(r => r.id);
  }

  // If follow-up on prior check
  if (reqV2.previousCheckId) {
    const { data: priorCheck, error: priorErr } = await userClient
      .from('ohmi_analyses')
      .select('id, user_id, payload, artifact_kind')
      .eq('id', reqV2.previousCheckId)
      .eq('user_id', user.id)
      .single();

    if (priorErr || !priorCheck) {
      return errorResponse('not_found', 'Referenced prior circuit check not found or unowned.', 404);
    }

    if (priorCheck.payload?.findings && Array.isArray(priorCheck.payload.findings)) {
      priorFindingIds = priorCheck.payload.findings
        .map((f: any) => f?.id)
        .filter((id: any): id is string => typeof id === 'string');
    }
  }

  const evidence: CircuitEvidence = {
    imageIds,
    codeLineCount,
    requirementIds,
    requirements,
    simulationText: reqV2.simulation,
    priorFindingIds
  };

  // 3. Deterministic calculations and Arduino checks
  let calculationResult: CalculationResult | undefined;
  if (reqV2.calculation && typeof reqV2.calculation === 'object') {
    const calcType = reqV2.calculation.type;
    const ops = reqV2.calculation.operands || {};
    if (calcType === 'led_resistor') calculationResult = calculateLedResistor({ supplyVoltage: ops.supplyVoltage, forwardVoltage: ops.forwardVoltage, targetCurrent: ops.targetCurrent });
    else if (calcType === 'ohms_law') calculationResult = calculateOhmsLaw(ops);
    else if (calcType === 'series_resistance') calculationResult = calculateSeriesResistance({ resistors: ops.resistors });
    else if (calcType === 'parallel_resistance') calculationResult = calculateParallelResistance({ resistors: ops.resistors });
    else if (calcType === 'resistor_power') calculationResult = calculateResistorPower(ops);
  }

  let arduinoValidation: SketchValidationResult | undefined;
  if (reqV2.code) {
    arduinoValidation = validateArduinoSketch(reqV2.code);
  }

  // 4. Compute canonical input hash (including image hashes)
  const imageHashes: Array<{ id: string; hash: string }> = [];
  for (const img of reqV2.images) {
    const h = await sha256Hex(img.data);
    imageHashes.push({ id: img.id, hash: h });
  }

  const inputHash = await sha256Hex(JSON.stringify({
    version: 2,
    provider: route.provider,
    model: route.model,
    operation: 'circuit_check',
    language: reqV2.language,
    mode: reqV2.mode,
    message: reqV2.message.trim(),
    board: reqV2.board,
    code: reqV2.code?.trim() ?? '',
    simulation: reqV2.simulation?.trim() ?? '',
    assignmentId: reqV2.assignmentId ?? '',
    assignmentAnalysisId: reqV2.assignmentAnalysisId ?? '',
    requirementText: reqV2.requirementText?.trim() ?? '',
    previousCheckId: reqV2.previousCheckId ?? '',
    conversationId: reqV2.conversationId ?? '',
    calculation: reqV2.calculation ?? null,
    imageHashes
  }));

  // 5. Atomic Reservation via ohmi_reserve_ai
  const targetId = reqV2.assignmentId || reqV2.conversationId || reqV2.previousCheckId || null;
  const reserveResult = await adminClient.rpc('ohmi_reserve_ai', {
    p_user_id: user.id,
    p_request_id: reqV2.requestId,
    p_kind: 'circuit_check',
    p_estimated_tokens: null,
    p_target: targetId,
    p_hash: inputHash,
    p_language: reqV2.language,
    p_model: route.model,
    p_conversation_id: reqV2.conversationId || null
  });

  if (reserveResult.error) {
    const msg = reserveResult.error.message || 'AI request reservation failed.';
    if (/cooldown/i.test(msg)) {
      return errorResponse('rate_limit', 'AI provider is in cooldown. Please wait a minute and retry.', 429, 60);
    }
    if (/progress/i.test(msg)) {
      return errorResponse('rate_limit', 'An AI request is currently in progress. Please wait a few seconds.', 429, 10);
    }
    if (/limit/i.test(msg)) {
      return errorResponse('rate_limit', msg, 429, 60);
    }
    if (/replay does not match/i.test(msg)) {
      return errorResponse('conflict', 'RequestId already used with different parameters.', 409);
    }
    return errorResponse('invalid_request', msg, 400);
  }

  markStage(deps, 'reservation');
  const reservation = reserveResult.data;
  if (!reservation.fresh) {
    if (reservation.status === 'completed') {
      let replayedResult: any = reservation.result_payload || null;

      if (!replayedResult && reservation.conversation_id) {
        const { data: msg } = await adminClient
          .from('ohmi_messages')
          .select('content, structured_result')
          .eq('request_id', reqV2.requestId)
          .eq('role', 'assistant')
          .maybeSingle();

        if (msg?.structured_result) {
          replayedResult = msg.structured_result;
        }
      }

      if (!replayedResult && reservation.result_id) {
        const { data: analysis } = await adminClient
          .from('ohmi_analyses')
          .select('payload')
          .eq('id', reservation.result_id)
          .maybeSingle();

        if (analysis?.payload) {
          replayedResult = analysis.payload;
        }
      }

      if (!replayedResult) {
        return errorResponse('unavailable', 'This circuit check was deleted and is no longer available.', 404);
      }

      return jsonResponse({
        ok: true,
        requestId: reqV2.requestId,
        accountId: user.id,
        operation: 'circuit_check',
        language: reqV2.language,
        resultId: reservation.result_id,
        conversationId: reqV2.conversationId || reservation.conversation_id || undefined,
        result: replayedResult,
        model: reservation.model || route.model,
        provider: route.provider,
        ...(calculationResult ? { calculation: calculationResult } : {})
      });
    }

    if (reservation.status === 'pending') {
      return errorResponse('in_progress', 'This request is currently being processed.', 429, 10);
    }
    return errorResponse('failed', 'This request previously failed. Please submit a new question.', 400);
  }

  // 6. Build prompt & invoke provider through unified transport seam
  const { systemInstruction, userPrompt } = buildCircuitPrompt(reqV2, evidence);

  let promptText = userPrompt;
  if (arduinoValidation && arduinoValidation.warnings.length > 0) {
    promptText += `\n\n[Automated Arduino Checks]:\n${arduinoValidation.warnings.join('\n')}`;
  }

  const transportRes = await callAiProviderTransport({
    provider: route.provider,
    model: route.model,
    systemInstruction,
    promptText,
    images: reqV2.images.map((img: any) => ({ mimeType: img.mimeType, data: img.data })),
    maxTokens: 3072,
    responseFormat: 'json_object',
    responseSchema: circuitResponseSchema(evidence),
    geminiApiKey,
    timeoutMs: providerTimeout(true, deps),
    fetchFn: deps?.fetch || fetch
  });

  markStage(deps, 'provider');
  if (!transportRes.ok) {
    const errCode = transportRes.code === 'payload_too_large' && transportRes.message.includes('truncated')
      ? 'truncated'
      : transportRes.code;

    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: reqV2.requestId,
      p_error_code: errCode,
      ...(transportRes.totalTokens !== undefined ? { p_input_tokens: transportRes.promptTokens, p_output_tokens: transportRes.completionTokens, p_accounted_tokens: transportRes.totalTokens } : {}),
      p_error_message: transportRes.message.slice(0, 200),
      p_model: route.model
    });

    if (transportRes.code === 'rate_limit' || transportRes.code === 'unavailable' || transportRes.code === 'quota_exhausted') {
      return errorResponse(
        transportRes.code,
        transportRes.code === 'quota_exhausted' ? 'AI provider free quota is exhausted or expired. Please retry shortly.' : 'AI provider is temporarily busy or rate limited. Try again in a minute.',
        transportRes.code === 'quota_exhausted' ? 503 : transportRes.status,
        transportRes.retryAfterSeconds || 60
      );
    }

    if (transportRes.code === 'timeout') {
      return errorResponse('timeout', transportRes.message, 504);
    }

    if (transportRes.code === 'truncated') return errorResponse('truncated', transportRes.message, 502);

    if (transportRes.code === 'payload_too_large') {
      return errorResponse('payload_too_large', 'AI response exceeded maximum allowed size.', 502);
    }

    if (transportRes.code === 'safety') {
      return errorResponse('unavailable', 'AI response was filtered by safety guidelines.', 502);
    }

    if (transportRes.code === 'empty_answer') {
      return errorResponse('unavailable', 'AI returned no answer. Try rephrasing your question.', 502);
    }

    if (transportRes.code === 'invalid_json') {
      return errorResponse('unavailable', 'Received invalid response from AI provider.', 502);
    }

    return errorResponse('provider_error', 'AI provider returned an error.', 502);
  }

  const answerText = transportRes.text;
  const inputTokens = transportRes.promptTokens;
  const outputTokens = transportRes.completionTokens;

  // Parse structured result JSON
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(answerText);
  } catch {
    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: reqV2.requestId,
      p_error_code: 'invalid_circuit_check',
      p_input_tokens: inputTokens, p_output_tokens: outputTokens, p_accounted_tokens: transportRes.totalTokens,
      p_error_message: 'Failed to parse JSON from circuit check response.',
      p_model: route.model
    });
    return errorResponse('unavailable', 'Received invalid circuit check format from AI provider.', 502);
  }

  let validatedResult: CircuitCheckResult;
  try {
    validatedResult = validateCircuitResult(rawParsed, evidence);
  } catch (err: unknown) {
    const valErr = err instanceof Error ? err.message : 'Circuit check result validation failed.';
    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: reqV2.requestId,
      p_error_code: 'invalid_circuit_check',
      p_input_tokens: inputTokens, p_output_tokens: outputTokens, p_accounted_tokens: transportRes.totalTokens,
      p_error_message: valErr.slice(0, 200),
      p_model: route.model
    });
    return errorResponse('unavailable', valErr, 502);
  }

  // 8. Atomically complete the AI request via ohmi_complete_ai
  markStage(deps, 'validation');
  const completeRes = await adminClient.rpc('ohmi_complete_ai', {
    p_request_id: reqV2.requestId,
    p_output: {
      message: reqV2.message,
      answer: validatedResult.summary,
      prompt_version: OHMI_TUTOR_VERSION,
      ...validatedResult,
      ...(calculationResult ? { calculation: calculationResult } : {}),
      ...(arduinoValidation ? { arduinoValidation } : {})
    },
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_accounted_tokens: transportRes.totalTokens,
    p_model: route.model
  });

  markStage(deps, 'persistence');
  if (completeRes.error) {
    return errorResponse('server_error', 'Failed to save completed AI response.', 500);
  }

  return jsonResponse({
    ok: true,
    requestId: reqV2.requestId,
    accountId: user.id,
    operation: 'circuit_check',
    language: reqV2.language,
    resultId: completeRes.data?.id,
    conversationId: reqV2.conversationId || undefined,
    result: validatedResult,
    model: route.model,
    provider: route.provider,
    ...(calculationResult ? { calculation: calculationResult } : {})
  });
}
