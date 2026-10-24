// Supabase Edge Function: GroqCloud Chat Completions Transport Adapter
// Bounded text-only transport for conversational Ask OHMI
// Fixed endpoint: https://api.groq.com/openai/v1/chat/completions
// Strict Free Tier controls: reasoning_effort 'low', include_reasoning false, max 64 KiB body

import { sanitizeErrorMessage } from './provider-policy.ts';

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const MAX_GROQ_RESPONSE_BYTES = 64 * 1024; // 64 KiB

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqRequestOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  messages: GroqChatMessage[];
  maxTokens?: number;
  reasoningEffort?: 'low';
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface GroqSuccessResponse {
  ok: true;
  model: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
}

export interface GroqErrorResponse {
  ok: false;
  status: number;
  code: 'timeout' | 'rate_limit' | 'unavailable' | 'quota_exhausted' | 'empty_answer' | 'provider_error' | 'payload_too_large';
  message: string;
  retryAfterSeconds?: number;
}

export type GroqResponse = GroqSuccessResponse | GroqErrorResponse;

export async function readBoundedBody(response: Response, maxBytes = MAX_GROQ_RESPONSE_BYTES): Promise<string> {
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
          throw new Error(`Response body exceeded maximum allowed limit of ${maxBytes} bytes`);
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

export async function callGroqChatCompletions(options: GroqRequestOptions): Promise<GroqResponse> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      code: 'unavailable',
      message: 'Groq API key is not configured.'
    };
  }

  const fetchFn = options.fetchFn || fetch;
  const timeoutMs = options.timeoutMs ?? 24_000;

  // Build message array with system instruction first
  const fullMessages: GroqChatMessage[] = [];
  if (options.systemInstruction && options.systemInstruction.trim()) {
    fullMessages.push({
      role: 'system',
      content: options.systemInstruction.trim()
    });
  }
  fullMessages.push(...options.messages);

  const requestBody: Record<string, unknown> = {
    model: options.model,
    messages: fullMessages,
    stream: false,
    max_completion_tokens: options.maxTokens ?? 1536,
    reasoning_effort: options.reasoningEffort ?? 'low',
    include_reasoning: false
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timer);

    // Rate limit / 429
    if (res.status === 429) {
      const retryHeader = res.headers.get('retry-after');
      let retrySec: number | undefined;
      if (retryHeader) {
        const parsed = parseInt(retryHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          retrySec = parsed;
        }
      }
      return {
        ok: false,
        status: 429,
        code: 'rate_limit',
        message: 'Groq rate limit or quota exceeded. Please wait before retrying.',
        retryAfterSeconds: retrySec
      };
    }

    let responseText = '';
    try {
      responseText = await readBoundedBody(res, MAX_GROQ_RESPONSE_BYTES);
    } catch (readErr) {
      return {
        ok: false,
        status: 502,
        code: 'payload_too_large',
        message: sanitizeErrorMessage(readErr instanceof Error ? readErr.message : String(readErr), apiKey)
      };
    }

    if (!res.ok) {
      let errorMsg = `Groq upstream error (${res.status})`;
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error?.message) {
          errorMsg = String(errorJson.error.message);
        }
      } catch {
        if (responseText) {
          errorMsg = responseText.slice(0, 200);
        }
      }

      const cleanMsg = sanitizeErrorMessage(errorMsg, apiKey);
      const isQuota = res.status === 402 || cleanMsg.toLowerCase().includes('quota');
      return {
        ok: false,
        status: res.status >= 500 ? 503 : res.status,
        code: isQuota ? 'quota_exhausted' : 'provider_error',
        message: cleanMsg
      };
    }

    let json: any;
    try {
      json = JSON.parse(responseText);
    } catch {
      return {
        ok: false,
        status: 502,
        code: 'provider_error',
        message: 'Groq returned invalid JSON.'
      };
    }

    const choice = json.choices?.[0];
    if (!choice || !choice.message) {
      return {
        ok: false,
        status: 502,
        code: 'empty_answer',
        message: 'Groq returned no choices.'
      };
    }

    const finishReason = choice.finish_reason || 'stop';
    if (finishReason === 'length') {
      return {
        ok: false,
        status: 502,
        code: 'payload_too_large',
        message: 'Groq response was truncated (length / max tokens reached).'
      };
    }
    if (finishReason !== 'stop') {
      return {
        ok: false,
        status: 502,
        code: 'unavailable',
        message: `Groq response not complete: ${finishReason}`
      };
    }

    const content = (choice.message.content || '').trim();
    if (!content) {
      return {
        ok: false,
        status: 502,
        code: 'empty_answer',
        message: 'Groq returned an empty response.'
      };
    }

    const usage = json.usage || {};
    const promptChars = options.messages.reduce(
      (acc, m) => acc + (m.content?.length || 0),
      options.systemInstruction?.length || 0
    );
    const promptTokens = typeof usage.prompt_tokens === 'number'
      ? usage.prompt_tokens
      : Math.max(1, Math.ceil(promptChars / 4));
    const completionTokens = typeof usage.completion_tokens === 'number'
      ? usage.completion_tokens
      : Math.max(1, Math.ceil(content.length / 4));
    const totalTokens = typeof usage.total_tokens === 'number'
      ? usage.total_tokens
      : promptTokens + completionTokens;

    return {
      ok: true,
      model: json.model || options.model,
      content,
      promptTokens,
      completionTokens,
      totalTokens,
      finishReason
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      return {
        ok: false,
        status: 504,
        code: 'timeout',
        message: `Groq request timed out after ${timeoutMs}ms.`
      };
    }
    return {
      ok: false,
      status: 503,
      code: 'provider_error',
      message: sanitizeErrorMessage(err instanceof Error ? err.message : String(err), apiKey)
    };
  }
}
