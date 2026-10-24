import { describe, it, expect, vi } from 'vitest';
import {
  callGroqChatCompletions,
  readBoundedBody,
  GROQ_ENDPOINT,
  MAX_GROQ_RESPONSE_BYTES
} from './groq.ts';

describe('GroqCloud Transport Adapter (groq.ts)', () => {
  const validApiKey = 'gsk_testsecretapikey1234567890';

  it('rejects missing API key immediately without network call', async () => {
    const fetchMock = vi.fn();
    const res = await callGroqChatCompletions({
      apiKey: '',
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'hello' }],
      fetchFn: fetchMock
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(503);
      expect(res.code).toBe('unavailable');
      expect(res.message).toContain('Groq API key is not configured');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends correct request payload to fixed GROQ_ENDPOINT with low reasoning profile', async () => {
    let capturedUrl = '';
    let capturedOptions: RequestInit | undefined;

    const mockResponse = {
      id: 'chatcmpl-test-1',
      model: 'openai/gpt-oss-120b',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'A 220 ohm resistor limits current to safe levels.' },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 45,
        completion_tokens: 15,
        total_tokens: 60
      }
    };

    const fetchMock = vi.fn().mockImplementation((url, opts) => {
      capturedUrl = url;
      capturedOptions = opts;
      return Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    const res = await callGroqChatCompletions({
      apiKey: validApiKey,
      model: 'openai/gpt-oss-120b',
      systemInstruction: 'You are an electronics tutor.',
      messages: [{ role: 'user', content: 'Why use a resistor with an LED?' }],
      maxTokens: 1536,
      fetchFn: fetchMock
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.model).toBe('openai/gpt-oss-120b');
      expect(res.content).toBe('A 220 ohm resistor limits current to safe levels.');
      expect(res.promptTokens).toBe(45);
      expect(res.completionTokens).toBe(15);
      expect(res.totalTokens).toBe(60);
      expect(res.finishReason).toBe('stop');
    }

    expect(capturedUrl).toBe(GROQ_ENDPOINT);
    expect(capturedOptions?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validApiKey}`
    });

    const parsedBody = JSON.parse(capturedOptions?.body as string);
    expect(parsedBody).toMatchObject({
      model: 'openai/gpt-oss-120b',
      stream: false,
      max_completion_tokens: 1536,
      reasoning_effort: 'low',
      include_reasoning: false
    });
    expect(parsedBody.messages).toHaveLength(2);
    expect(parsedBody.messages[0]).toEqual({ role: 'system', content: 'You are an electronics tutor.' });
    expect(parsedBody.messages[1]).toEqual({ role: 'user', content: 'Why use a resistor with an LED?' });
  });

  it('handles 429 rate limit with retry-after header correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '12'
        }
      })
    );

    const res = await callGroqChatCompletions({
      apiKey: validApiKey,
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'hello' }],
      fetchFn: fetchMock
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(429);
      expect(res.code).toBe('rate_limit');
      expect(res.retryAfterSeconds).toBe(12);
    }
  });

  it('bounds response body reads to 64 KiB and returns payload_too_large', async () => {
    const largeChunk = 'x'.repeat(70 * 1024); // 70 KiB
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(largeChunk));
        controller.close();
      }
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const res = await callGroqChatCompletions({
      apiKey: validApiKey,
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'hello' }],
      fetchFn: fetchMock
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('payload_too_large');
      expect(res.status).toBe(502);
      expect(res.message).toContain('exceeded maximum allowed limit');
    }
  });

  it('sanitizes API keys from upstream error bodies', async () => {
    const errorBody = {
      error: {
        message: `Invalid request for credential ${validApiKey} at project endpoint`
      }
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorBody), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const res = await callGroqChatCompletions({
      apiKey: validApiKey,
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'hello' }],
      fetchFn: fetchMock
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).not.toContain(validApiKey);
      expect(res.message).toContain('[REDACTED_KEY]');
    }
  });

  it('handles empty choices honestly as empty_answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const res = await callGroqChatCompletions({
      apiKey: validApiKey,
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'hello' }],
      fetchFn: fetchMock
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('empty_answer');
      expect(res.status).toBe(502);
    }
  });

  it('handles timeout correctly as 504 timeout', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const res = await callGroqChatCompletions({
      apiKey: validApiKey,
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'hello' }],
      timeoutMs: 10,
      fetchFn: fetchMock
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(504);
      expect(res.code).toBe('timeout');
      expect(res.message).toContain('timed out');
    }
  });
});
