import { describe, it, expect, vi } from 'vitest';
import {
  validateQwenBaseUrl,
  sanitizeErrorMessage,
  validateQwenModel,
  callQwenChatCompletions,
  DEFAULT_QWEN_MODEL,
  DEFAULT_QWEN_BASE_URL
} from './qwen.ts';

describe('Qwen Transport Adapter (qwen.ts)', () => {
  describe('validateQwenBaseUrl', () => {
    it('accepts valid Singapore MaaS workspace endpoint', () => {
      const url = 'https://my-workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
      expect(validateQwenBaseUrl(url)).toBe(url);
    });

    it('accepts valid DashScope international endpoint', () => {
      expect(validateQwenBaseUrl(DEFAULT_QWEN_BASE_URL)).toBe(DEFAULT_QWEN_BASE_URL);
    });

    it('rejects non-HTTPS URLs', () => {
      expect(() => validateQwenBaseUrl('http://dashscope-intl.aliyuncs.com/compatible-mode/v1')).toThrow(
        'protocol must be HTTPS'
      );
    });

    it('rejects arbitrary foreign hosts', () => {
      expect(() => validateQwenBaseUrl('https://api.openai.com/v1')).toThrow(
        'Must be an authorized Alibaba Model Studio domain'
      );
      expect(() => validateQwenBaseUrl('https://malicious-proxy.com/compatible-mode/v1')).toThrow(
        'Must be an authorized Alibaba Model Studio domain'
      );
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('redacts provided API key and generic bearer tokens', () => {
      const raw = 'Failed with key sk-secret123456789 and Bearer eyJhbGciOiJIUzI1NiJ9';
      const clean = sanitizeErrorMessage(raw, 'sk-secret123456789');
      expect(clean).not.toContain('sk-secret123456789');
      expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(clean).toContain('[REDACTED_KEY]');
      expect(clean).toContain('Bearer [REDACTED]');
    });

    it('redacts signed query URLs with credential parameters', () => {
      const raw = 'Error uploading to https://bucket.supabase.co/object/sign/file.pdf?token=secret12345&sig=abcdef';
      const clean = sanitizeErrorMessage(raw);
      expect(clean).not.toContain('secret12345');
      expect(clean).toContain('[REDACTED_URL]');
    });
  });

  describe('validateQwenModel', () => {
    it('validates allowed Singapore candidates', () => {
      expect(validateQwenModel('qwen3.8-flash')).toBe('qwen3.8-flash');
      expect(validateQwenModel('qwen3.8-max')).toBe('qwen3.8-max');
    });

    it('defaults to qwen3.8-flash when unspecified', () => {
      expect(validateQwenModel(undefined)).toBe('qwen3.8-flash');
    });

    it('rejects unsupported or arbitrary model names', () => {
      expect(() => validateQwenModel('qwen-plus')).toThrow('Invalid Qwen model');
      expect(() => validateQwenModel('gpt-4o')).toThrow('Invalid Qwen model');
      expect(() => validateQwenModel('gemini-1.5-flash')).toThrow('Invalid Qwen model');
    });
  });

  describe('callQwenChatCompletions (mocked provider calls)', () => {
    const validApiKey = 'sk-test-qwen-api-key-12345';

    it('rejects missing API key immediately without network call', async () => {
      const fetchMock = vi.fn();
      const res = await callQwenChatCompletions({
        apiKey: '',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 100,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(503);
        expect(res.message).toContain('Qwen API key is not configured');
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('successfully handles text Chat Completions with usage tokens and stop finishReason', async () => {
      const mockResponseBody = {
        id: 'chatcmpl-test-1',
        object: 'chat.completion',
        created: 1234567890,
        model: 'qwen3.8-flash',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'A resistor resists the flow of electric current according to Ohm’s law.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 35,
          completion_tokens: 18,
          total_tokens: 53
        }
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        model: 'qwen3.8-flash',
        systemInstruction: 'You are OHMI, a friendly electronics tutor.',
        messages: [{ role: 'user', content: 'What does a resistor do?' }],
        maxTokens: 1536,
        temperature: 0.1,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.model).toBe('qwen3.8-flash');
        expect(res.content).toContain('resists the flow of electric current');
        expect(res.promptTokens).toBe(35);
        expect(res.completionTokens).toBe(18);
        expect(res.totalTokens).toBe(53);
        expect(res.finishReason).toBe('stop');
      }

      // Verify request payload shape sent to Alibaba Model Studio
      const callArgs = fetchMock.mock.calls[0];
      const endpoint = callArgs[0];
      const reqOpts = callArgs[1];
      expect(endpoint).toBe('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions');
      expect(reqOpts.headers['Authorization']).toBe(`Bearer ${validApiKey}`);
      const parsedBody = JSON.parse(reqOpts.body);
      expect(parsedBody.model).toBe('qwen3.8-flash');
      expect(parsedBody.enable_thinking).toBe(false);
      expect(parsedBody.stream).toBe(false);
      expect(parsedBody.messages[0]).toEqual({
        role: 'system',
        content: 'You are OHMI, a friendly electronics tutor.'
      });
      expect(parsedBody.messages[1]).toEqual({
        role: 'user',
        content: 'What does a resistor do?'
      });
    });

    it('excludes reasoning_content from visible student response', async () => {
      const mockResponseBody = {
        id: 'chatcmpl-test-2',
        object: 'chat.completion',
        created: 1234567890,
        model: 'qwen3.8-flash',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'The required series resistor is 330 Ω.',
              reasoning_content: 'Let V_s = 5V, V_f = 2V, I = 10mA. R = (5-2)/0.01 = 300. Nearest standard is 330.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30,
          total_tokens: 80
        }
      };

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'Calculate LED resistor.' }],
        maxTokens: 500,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.content).toBe('The required series resistor is 330 Ω.');
        expect(res.content).not.toContain('reasoning_content');
        expect(res.content).not.toContain('Let V_s');
        expect(res.reasoningContent).toContain('Let V_s = 5V');
      }
    });

    it('correctly maps multimodal image content parts with base64 data URLs', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: 'I see a breadboard and LED.' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 250, completion_tokens: 20 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this circuit image:' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Data}`
                }
              }
            ]
          }
        ],
        maxTokens: 1000,
        fetchFn: fetchMock
      });

      const parsedBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const userContent = parsedBody.messages[0].content;
      expect(Array.isArray(userContent)).toBe(true);
      expect(userContent[0]).toEqual({ type: 'text', text: 'Analyze this circuit image:' });
      expect(userContent[1].type).toBe('image_url');
      expect(userContent[1].image_url.url).toContain('data:image/png;base64,');
    });

    it('correctly maps native PDF file parts with sanitized generic filename', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: 'Assignment lab brief parsed.' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 400, completion_tokens: 30 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const pdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PA...';
      await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract steps from this PDF assignment:' },
              {
                type: 'file',
                file_data: `data:application/pdf;base64,${pdfBase64}`,
                file_name: 'assignment.pdf'
              }
            ]
          }
        ],
        maxTokens: 1500,
        fetchFn: fetchMock
      });

      const parsedBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const userContent = parsedBody.messages[0].content;
      expect(Array.isArray(userContent)).toBe(true);
      const filePart = userContent.find((p: any) => p.type === 'file');
      expect(filePart).toBeDefined();
      expect(filePart.file_data).toContain('data:application/pdf;base64,');
      expect(filePart.file_name).toBe('assignment.pdf');
    });

    it('normalizes AllocationQuota.FreeTierOnly error as quota_exhausted', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'AllocationQuota.FreeTierOnly',
              message: 'Your free tier quota for model qwen3.8-flash has been exhausted.'
            }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'Test quota' }],
        maxTokens: 100,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(403);
        expect(res.code).toBe('quota_exhausted');
        expect(res.message).toContain('AllocationQuota.FreeTierOnly');
      }
    });

    it('normalizes 429 rate limit errors with retryAfterSeconds', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'RateLimitExceeded', message: 'Too many requests' }
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'test rate limit' }],
        maxTokens: 100,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(429);
        expect(res.code).toBe('rate_limit');
        expect(res.retryAfterSeconds).toBe(60);
      }
    });

    it('normalizes safety content_filter finish_reason as safety code', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { role: 'assistant', content: '' },
                finish_reason: 'content_filter'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'harmful prompt' }],
        maxTokens: 100,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('safety');
        expect(res.message).toContain('safety block');
      }
    });

    it('rejects output truncated by max_tokens limit with payload_too_large code', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { role: 'assistant', content: 'Incomplete output that was cut...' },
                finish_reason: 'length'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'tell me a story' }],
        maxTokens: 10,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('payload_too_large');
        expect(res.message).toContain('truncated');
      }
    });

    it('rejects responses exceeding 64 KiB cap', async () => {
      const hugeContent = 'A'.repeat(65 * 1024);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(hugeContent, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'huge' }],
        maxTokens: 100,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('payload_too_large');
        expect(res.message).toContain('exceeded 64 KiB');
      }
    });

    it('handles timeout abort cleanly with code timeout and status 504', async () => {
      const fetchMock = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'hang' }],
        maxTokens: 100,
        timeoutMs: 100,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(504);
        expect(res.code).toBe('timeout');
      }
    });

    it('uses conservative fallback tokens when provider omits usageMetadata (never 0)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: 'Answer without usage' }, finish_reason: 'stop' }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const res = await callQwenChatCompletions({
        apiKey: validApiKey,
        messages: [{ role: 'user', content: 'no usage' }],
        maxTokens: 1000,
        fetchFn: fetchMock
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.promptTokens).toBe(500);
        expect(res.completionTokens).toBe(500);
        expect(res.totalTokens).toBe(1000);
      }
    });
  });
});
