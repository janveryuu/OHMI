/**
 * Single-provider client for Google Gemini (gemini-3.5-flash-lite).
 * Enforces:
 * - 0 automatic retries
 * - 20s maximum generation timeout
 * - 64 KiB maximum response body size with bounded stream reading
 * - Safe error mapping without secret leakage
 * - Key sent in x-goog-api-key header (never in query URL)
 * - Thinking config: LOW thinkingLevel, includeThoughts: false
 */

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KiB
export const DEFAULT_TIMEOUT_MS = 20_000;    // 20 seconds

export interface GeminiPart {
  text?: string;
  thought?: boolean;
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

async function readBoundedStream(response: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  if (!response.body) {
    return '';
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try {
            await reader.cancel();
          } catch {
            // ignore cancel errors
          }
          throw new GeminiError('Provider response exceeded 64 KiB limit.', 'payload_too_large', 502);
        }
        text += decoder.decode(value, { stream: true });
      }
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
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

  // Key in header, never in URL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const bodyPayload: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens,
      thinkingConfig: {
        thinkingLevel: 'LOW',
        includeThoughts: false
      }
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
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
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

  // Bounded response reading
  let rawText = '';
  try {
    rawText = await readBoundedStream(response, MAX_RESPONSE_BYTES);
  } catch (err) {
    if (err instanceof GeminiError) {
      throw err;
    }
    throw new GeminiError('Failed reading provider response stream.', 'unavailable', 502);
  }

  // Check HTTP status
  if (!response.ok) {
    let errorMsg = `Provider error (status ${response.status})`;
    try {
      const errJson = JSON.parse(rawText) as { error?: { message?: string } };
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

  const rawParts = candidate.content?.parts;
  let textPart = '';
  if (Array.isArray(rawParts)) {
    textPart = rawParts
      .filter((p: any) => p && typeof p.text === 'string' && !p.thought)
      .map((p: any) => p.text)
      .join('');
  } else if (typeof rawParts?.[0]?.text === 'string') {
    textPart = rawParts[0].text;
  }

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
