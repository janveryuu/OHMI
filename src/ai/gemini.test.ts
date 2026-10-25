import { describe, expect, it, vi } from 'vitest';
import { callGemini, GeminiError, MAX_RESPONSE_BYTES } from './gemini';

describe('Gemini Provider Client', () => {
  const dummyKey = 'AIzaSyDUMMYKEYFORTESTING';

  it('rejects missing API key with auth_error', async () => {
    await expect(callGemini({
      apiKey: '',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }]
    })).rejects.toThrowError(GeminiError);
  });

  it('handles 401/403 authorization failures with auth_error code', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'API key not valid' }
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    await expect(callGemini({
      apiKey: dummyKey,
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      fetchFn: fakeFetch as unknown as typeof fetch
    })).rejects.toMatchObject({
      code: 'auth_error',
      status: 401
    });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('handles 429 rate limit with retry-after parsing and rate_limit code', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Quota exceeded' }
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'retry-after': '35' }
    }));

    await expect(callGemini({
      apiKey: dummyKey,
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      fetchFn: fakeFetch as unknown as typeof fetch
    })).rejects.toMatchObject({
      code: 'rate_limit',
      status: 429,
      retryAfterSeconds: 35
    });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('handles 503 unavailable with unavailable code', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('Service Unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    }));

    await expect(callGemini({
      apiKey: dummyKey,
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      fetchFn: fakeFetch as unknown as typeof fetch
    })).rejects.toMatchObject({
      code: 'unavailable',
      status: 503
    });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('handles generation timeout', async () => {
    const fakeFetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(callGemini({
      apiKey: dummyKey,
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      timeoutMs: 50,
      fetchFn: fakeFetch as unknown as typeof fetch
    })).rejects.toMatchObject({
      code: 'timeout',
      status: 504
    });
  });

  it('rejects responses larger than 64 KiB', async () => {
    const hugeString = 'x'.repeat(MAX_RESPONSE_BYTES + 100);
    const fakeFetch = vi.fn().mockResolvedValue(new Response(hugeString, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    await expect(callGemini({
      apiKey: dummyKey,
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      fetchFn: fakeFetch as unknown as typeof fetch
    })).rejects.toMatchObject({
      code: 'payload_too_large'
    });
  });

  it('parses valid successful response and extracts token usage', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        finishReason: 'STOP',
        content: { parts: [{ text: 'An LED needs a resistor.' }] }
      }],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 25,
        totalTokenCount: 40
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await callGemini({
      apiKey: dummyKey,
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      fetchFn: fakeFetch as unknown as typeof fetch
    });

    expect(result.text).toBe('An LED needs a resistor.');
    expect(result.inputTokens).toBe(15);
    expect(result.outputTokens).toBe(25);
    expect(result.totalTokens).toBe(40);
    expect(result.finishReason).toBe('STOP');
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    const callArgs = fakeFetch.mock.calls[0]!;
    const calledUrl = callArgs[0] as string;
    const calledInit = callArgs[1] as RequestInit;
    expect(calledUrl).not.toContain('?key=');
    expect(calledUrl).toContain('gemini-3.5-flash-lite:generateContent');
    expect((calledInit.headers as Record<string, string>)['x-goog-api-key']).toBe(dummyKey);

    const sentBody = JSON.parse(calledInit.body as string);
    expect(sentBody.generationConfig?.temperature).toBeUndefined();
    expect(sentBody.generationConfig?.thinkingConfig).toEqual({
      thinkingLevel: 'LOW',
      includeThoughts: false
    });
  });
});
