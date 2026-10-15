/**
 * Single-provider client for Google Gemini (gemini-3.5-flash-lite).
 * Enforces:
 * - 0 automatic retries
 * - 20s maximum generation timeout
 * - 64 KiB maximum response body size
 * - Safe error mapping without secret leakage
 */

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KiB
export const DEFAULT_TIMEOUT_MS = 20_000;    // 20 seconds

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiCallOptions {
  apiKey: string;
  model?: string;
  contents: GeminiContent[];
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface GeminiResult {
  text: string;
  parsedJson?: unknown;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  finishReason: string;
  model: string;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: 'auth_error' | 'rate_limit' | 'unavailable' | 'invalid_request' | 'timeout' | 'payload_too_large' | 'safety_refusal',
    public readonly status?: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export async function callGemini(options: GeminiCallOptions): Promise<GeminiResult> {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    contents,
    systemInstruction,
    responseSchema,
    maxOutputTokens = 2048,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = fetch
  } = options;

  if (!apiKey) {
    throw new GeminiError('Provider API key is missing.', 'auth_error', 401);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const bodyPayload: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.2
    }
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  if (responseSchema) {
    bodyPayload.generationConfig = {
      ...(bodyPayload.generationConfig as Record<string, unknown>),
      responseMimeType: 'application/json',
      responseSchema
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GeminiError('Provider generation timed out after 20 seconds.', 'timeout', 504);
    }
    throw new GeminiError('Network error connecting to AI provider.', 'unavailable', 503);
  } finally {
    clearTimeout(timer);
  }

  // Check HTTP status
  if (!response.ok) {
    let errorMsg = `Provider error (status ${response.status})`;
    try {
      const errJson = await response.json() as { error?: { message?: string } };
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      // ignore json parse error on error body
    }

    if (response.status === 401 || response.status === 403) {
      throw new GeminiError('Provider authentication or permission error.', 'auth_error', response.status);
    }
    if (response.status === 429) {
      const retryHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) || 60 : 60;
      throw new GeminiError('Provider quota or rate limit reached.', 'rate_limit', 429, retryAfterSeconds);
    }
    if (response.status === 503 || response.status === 500 || response.status === 502 || response.status === 504) {
      throw new GeminiError('Provider service is temporarily unavailable. Try again shortly.', 'unavailable', response.status, 60);
    }
    throw new GeminiError(errorMsg.slice(0, 150), 'invalid_request', response.status);
  }

  // Bounded response reading: reject bodies > 64 KiB
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new GeminiError('Provider response exceeded 64 KiB limit.', 'payload_too_large', 502);
  }

  const rawText = await response.text();
  if (rawText.length > MAX_RESPONSE_BYTES) {
    throw new GeminiError('Provider response exceeded 64 KiB limit.', 'payload_too_large', 502);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new GeminiError('Invalid JSON received from AI provider.', 'unavailable', 502);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    if (data.promptFeedback?.blockReason) {
      throw new GeminiError(`Content blocked by provider safety policy: ${data.promptFeedback.blockReason}`, 'safety_refusal', 400);
    }
    throw new GeminiError('Provider returned no candidate answers.', 'unavailable', 502);
  }

  const finishReason = candidate.finishReason || 'STOP';
  if (finishReason === 'SAFETY') {
    throw new GeminiError('Response blocked by provider safety filters.', 'safety_refusal', 400);
  }

  const textPart = candidate.content?.parts?.[0]?.text ?? '';
  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens = data.usageMetadata?.totalTokenCount ?? (inputTokens + outputTokens);

  let parsedJson: unknown;
  if (responseSchema && textPart) {
    try {
      parsedJson = JSON.parse(textPart);
    } catch {
      throw new GeminiError('Provider response was not valid JSON matching required schema.', 'invalid_request', 502);
    }
  }

  return {
    text: textPart,
    parsedJson,
    inputTokens,
    outputTokens,
    totalTokens,
    finishReason,
    model
  };
}
