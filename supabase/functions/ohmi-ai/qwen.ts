// Supabase Edge Function: Qwen (Alibaba Model Studio) transport adapter
// Implements OpenAI-compatible Chat Completions for text, vision, and native PDF understanding.
// Strictly non-streaming, zero automatic retries, bounded timeout, sanitized errors.

export const QWEN_MODELS = ['qwen3.8-flash', 'qwen3.8-max'] as const;
export type QwenModel = typeof QWEN_MODELS[number];
export const DEFAULT_QWEN_MODEL: QwenModel = 'qwen3.8-flash';

export const DEFAULT_QWEN_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
export const DEFAULT_TIMEOUT_MS = 24_000;
export const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KiB

export interface QwenContentTextPart {
  type: 'text';
  text: string;
}

export interface QwenContentImageUrlPart {
  type: 'image_url';
  image_url: {
    url: string; // e.g. data:image/png;base64,...
  };
}

export interface QwenContentFilePart {
  type: 'file';
  file_data: string; // e.g. data:application/pdf;base64,...
  file_name?: string;
}

export type QwenContentPart = QwenContentTextPart | QwenContentImageUrlPart | QwenContentFilePart;

export interface QwenChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | QwenContentPart[];
}

export interface QwenChatOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  systemInstruction?: string;
  messages: QwenChatMessage[];
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'text' | 'json_object' | 'json_schema';
  jsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface QwenChatSuccess {
  ok: true;
  provider: 'qwen';
  model: string;
  content: string; // Visible student response; excludes reasoning_content
  reasoningContent?: string; // Captured if present for evaluation/auditing; never sent to student
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  rawResponse?: string;
}

export interface QwenChatFailure {
  ok: false;
  provider: 'qwen';
  status: number;
  code: 'timeout' | 'rate_limit' | 'quota_exhausted' | 'safety' | 'payload_too_large' | 'invalid_json' | 'provider_error' | 'unavailable';
  message: string;
  retryAfterSeconds?: number;
}

export type QwenChatResult = QwenChatSuccess | QwenChatFailure;

/**
 * Validates and normalizes the Qwen base URL.
 * Enforces HTTPS and approved Alibaba Cloud / Dashscope domain pattern.
 * Rejects arbitrary hosts and protocol manipulation.
 */
export function validateQwenBaseUrl(urlStr: string): string {
  const trimmed = urlStr.trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid Qwen base URL: must be a valid HTTPS URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Invalid Qwen base URL: protocol must be HTTPS.');
  }

  const host = parsed.hostname.toLowerCase();
  const isValidHost =
    host.endsWith('.aliyuncs.com') ||
    host === 'dashscope-intl.aliyuncs.com' ||
    host === 'dashscope.aliyuncs.com';

  if (!isValidHost) {
    throw new Error(`Invalid Qwen base URL host: "${host}". Must be an authorized Alibaba Model Studio domain.`);
  }

  return trimmed;
}

/**
 * Sanitizes error messages by scrubbing potential API keys, Bearer tokens, and signed URLs.
 */
export function sanitizeErrorMessage(message: string, apiKey?: string): string {
  let cleaned = message;
  if (apiKey && apiKey.trim().length > 4) {
    cleaned = cleaned.replaceAll(apiKey.trim(), '[REDACTED_KEY]');
  }
  // Redact Bearer authorization tokens
  cleaned = cleaned.replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]');
  // Redact standard sk- style API keys
  cleaned = cleaned.replace(/sk-[A-Za-z0-9_-]{8,}/gi, '[REDACTED_KEY]');
  // Redact signed URLs with query credentials
  cleaned = cleaned.replace(/https:\/\/[^\s"'<>]+\?[^\s"'<>]+/gi, '[REDACTED_URL]');
  return cleaned.slice(0, 200);
}

/**
 * Validates that requested model ID is on the explicit Singapore candidate allowlist.
 */
export function validateQwenModel(modelName?: string): QwenModel {
  const target = (modelName || DEFAULT_QWEN_MODEL).trim().toLowerCase();
  const matched = QWEN_MODELS.find((m) => m === target);
  if (!matched) {
    throw new Error(`Invalid Qwen model "${target}". Must be one of: ${QWEN_MODELS.join(', ')}.`);
  }
  return matched;
}

/**
 * Executes a single, bounded OpenAI-compatible Chat Completions call to Alibaba Model Studio.
 * Zero automatic retries, strict cancellation on timeout, non-streaming.
 */
export async function callQwenChatCompletions(options: QwenChatOptions): Promise<QwenChatResult> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    return {
      ok: false,
      provider: 'qwen',
      status: 503,
      code: 'provider_error',
      message: 'Qwen API key is not configured.'
    };
  }

  let model: QwenModel;
  try {
    model = validateQwenModel(options.model);
  } catch (err: unknown) {
    return {
      ok: false,
      provider: 'qwen',
      status: 400,
      code: 'provider_error',
      message: err instanceof Error ? err.message : 'Invalid Qwen model selection.'
    };
  }

  let baseUrl: string;
  try {
    baseUrl = validateQwenBaseUrl(options.baseUrl || DEFAULT_QWEN_BASE_URL);
  } catch (err: unknown) {
    return {
      ok: false,
      provider: 'qwen',
      status: 400,
      code: 'provider_error',
      message: err instanceof Error ? err.message : 'Invalid Qwen base URL.'
    };
  }

  const endpoint = `${baseUrl}/chat/completions`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Construct message sequence
  const chatMessages: QwenChatMessage[] = [];
  if (options.systemInstruction && options.systemInstruction.trim()) {
    chatMessages.push({
      role: 'system',
      content: options.systemInstruction.trim()
    });
  }
  chatMessages.push(...options.messages);

  // Construct payload with required constraints
  const payload: Record<string, unknown> = {
    model,
    messages: chatMessages,
    max_tokens: options.maxTokens,
    temperature: options.temperature ?? 0.1,
    enable_thinking: false,
    stream: false
  };

  if (options.responseFormat === 'json_object') {
    payload.response_format = { type: 'json_object' };
  } else if (options.responseFormat === 'json_schema' && options.jsonSchema) {
    payload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'ohmi_schema',
        strict: true,
        schema: options.jsonSchema
      }
    };
  }

  let response: Response;
  let responseText: string;
  const fetchFn = options.fetchFn || fetch;

  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    responseText = await response.text().catch(() => '');
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort = (err instanceof Error && err.name === 'AbortError') || String(err).includes('abort');
    return {
      ok: false,
      provider: 'qwen',
      status: isAbort ? 504 : 502,
      code: isAbort ? 'timeout' : 'provider_error',
      message: isAbort ? `Qwen provider timed out after ${Math.round(timeoutMs / 1000)}s.` : 'Network error calling Qwen provider.'
    };
  } finally {
    clearTimeout(timer);
  }

  // Handle HTTP error responses
  if (!response.ok) {
    const status = response.status;
    let errCode = 'provider_error';
    let rawErrMsg = `Provider HTTP error ${status}`;

    try {
      const errJson = JSON.parse(responseText);
      const provCode = errJson?.error?.code || errJson?.code || '';
      const provMsg = errJson?.error?.message || errJson?.message || '';

      if (provCode) rawErrMsg = `${provCode}: ${provMsg}`;
      else if (provMsg) rawErrMsg = provMsg;

      // Detect Free Quota exhaustion or expiry
      if (
        provCode === 'AllocationQuota.FreeTierOnly' ||
        provCode.includes('AllocationQuota') ||
        /free.?quota|free.?tier/i.test(provMsg)
      ) {
        return {
          ok: false,
          provider: 'qwen',
          status: 403,
          code: 'quota_exhausted',
          message: 'Qwen free tier quota exhausted or expired (AllocationQuota.FreeTierOnly).'
        };
      }
    } catch {
      // Body was not JSON
    }

    const cleanMsg = sanitizeErrorMessage(rawErrMsg, apiKey);

    if (status === 429) {
      return {
        ok: false,
        provider: 'qwen',
        status: 429,
        code: 'rate_limit',
        message: cleanMsg,
        retryAfterSeconds: 60
      };
    }

    if (status === 503 || status === 502) {
      return {
        ok: false,
        provider: 'qwen',
        status,
        code: 'unavailable',
        message: cleanMsg,
        retryAfterSeconds: 60
      };
    }

    if (status === 401 || status === 403) {
      return {
        ok: false,
        provider: 'qwen',
        status,
        code: 'provider_error',
        message: `Qwen authentication or access denied (${status}): ${cleanMsg}`
      };
    }

    return {
      ok: false,
      provider: 'qwen',
      status: 502,
      code: 'provider_error',
      message: cleanMsg
    };
  }

  // Check response body bounds (≤ 64 KiB)
  if (responseText.length > MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      provider: 'qwen',
      status: 502,
      code: 'payload_too_large',
      message: `Qwen response exceeded 64 KiB (${MAX_RESPONSE_BYTES} bytes) cap.`
    };
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    return {
      ok: false,
      provider: 'qwen',
      status: 502,
      code: 'invalid_json',
      message: 'Qwen provider returned malformed JSON response.'
    };
  }

  const choice = data?.choices?.[0];
  if (!choice) {
    return {
      ok: false,
      provider: 'qwen',
      status: 502,
      code: 'invalid_json',
      message: 'Qwen response contained no completion choices.'
    };
  }

  const finishReason = choice.finish_reason || 'stop';

  // Safety filter or recitation check
  if (finishReason === 'content_filter' || finishReason === 'safety') {
    return {
      ok: false,
      provider: 'qwen',
      status: 502,
      code: 'safety',
      message: `Qwen safety block: ${finishReason}`
    };
  }

  // Output truncation check
  if (finishReason === 'length') {
    return {
      ok: false,
      provider: 'qwen',
      status: 502,
      code: 'payload_too_large',
      message: 'Qwen response was truncated due to token limit (finish_reason: length).'
    };
  }

  const message = choice.message;
  const content = typeof message?.content === 'string' ? message.content : '';
  const reasoningContent = typeof message?.reasoning_content === 'string' ? message.reasoning_content : undefined;

  if (!content.trim() && finishReason === 'stop') {
    return {
      ok: false,
      provider: 'qwen',
      status: 502,
      code: 'invalid_json',
      message: 'Qwen returned an empty response content.'
    };
  }

  // Usage token accounting (never zero fallback)
  const defaultEstimate = options.maxTokens;
  const promptTokens = typeof data?.usage?.prompt_tokens === 'number'
    ? data.usage.prompt_tokens
    : Math.floor(defaultEstimate / 2);
  const completionTokens = typeof data?.usage?.completion_tokens === 'number'
    ? data.usage.completion_tokens
    : Math.ceil(defaultEstimate / 2);
  const totalTokens = typeof data?.usage?.total_tokens === 'number'
    ? data.usage.total_tokens
    : (promptTokens + completionTokens);

  return {
    ok: true,
    provider: 'qwen',
    model: data.model || model,
    content,
    reasoningContent,
    finishReason,
    promptTokens,
    completionTokens,
    totalTokens,
    rawResponse: responseText
  };
}
