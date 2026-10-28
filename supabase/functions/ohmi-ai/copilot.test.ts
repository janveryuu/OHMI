import { describe, it, expect, vi } from 'vitest';
import { answerChat, providerConfigs, consumeChatBurst } from './copilot.ts';

const env = { GROQ_API_KEY: 'mock-groq', GEMINI_API_KEY: 'mock-gemini' };
const messages = [{ role: 'user' as const, content: 'Explain resistance.' }];
const envelope = (reply = 'Resistance opposes current.', scope = 'in_scope') => JSON.stringify({ reply, scope });
const groq = (text = envelope(), model = 'openai/gpt-oss-120b') => new Response(JSON.stringify({ model, choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }));
const gemini = () => new Response(JSON.stringify({ modelVersion: 'gemini-2.5-flash', candidates: [{ content: { parts: [{ text: envelope() }] } }] }));

describe('Dormosaur provider parity', () => {
  it('uses exact default candidates and skips missing credentials', () => {
    expect(providerConfigs(env).map(c => c.model)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'gemini-2.5-flash']);
    expect(providerConfigs({ GEMINI_API_KEY: 'key' }).map(c => c.provider)).toEqual(['gemini']);
    expect(providerConfigs({ GROQ_API_KEY: 'your-key' })).toEqual([]);
  });
  it('sends exact Groq settings and stops after success', async () => {
    const fetcher = vi.fn(async () => groq());
    const result = await answerChat({ env, system: 'OHMI tutor', messages, fetch: fetcher });
    const body = JSON.parse(fetcher.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ model: 'openai/gpt-oss-120b', temperature: 0.45, max_completion_tokens: 1600, response_format: { type: 'json_object' } });
    expect(result).toMatchObject({ mode: 'ai', model: 'openai/gpt-oss-120b', answer: 'Resistance opposes current.' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('fails over both Groq models to exact Gemini chat model', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 429 })).mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(gemini());
    const result = await answerChat({ env, system: 'OHMI tutor', messages, fetch: fetcher });
    expect(result).toMatchObject({ mode: 'ai', provider: 'gemini', model: 'gemini-2.5-flash' });
    expect(fetcher.mock.calls[2][0]).toContain('gemini-2.5-flash:generateContent');
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ generationConfig: { temperature: 0.45, maxOutputTokens: 1800, responseMimeType: 'application/json' } });
    expect(fetcher.mock.calls[2][1].headers).not.toHaveProperty('Authorization');
  });
  it('returns honest limited mode after all failures and never invents analysis', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 429 }));
    const result = await answerChat({ env, system: 'OHMI tutor', messages, fetch: fetcher });
    expect(result).toMatchObject({ mode: 'limited', model: 'ohmi-local', provider: 'local' });
    expect(result.answer).toMatch(/temporarily unavailable/i);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('regenerates repeated replies once, then advances candidates', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(groq()).mockResolvedValueOnce(groq()).mockResolvedValueOnce(groq(envelope('Use R = V / I with volts and amperes.'), 'openai/gpt-oss-20b'));
    const result = await answerChat({ env, system: 'OHMI tutor', messages: [{ role: 'assistant', content: 'Resistance opposes current.' }, ...messages], fetch: fetcher });
    expect(result.model).toBe('openai/gpt-oss-20b');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('keeps valid safety verdicts from triggering failover', async () => {
    const fetcher = vi.fn(async () => groq(envelope('No.', 'unsafe')));
    const result = await answerChat({ env, system: 'OHMI tutor', messages, fetch: fetcher });
    expect(result.answer).toMatch(/safe/i);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects exposed keys and unsupported JSON before fallback', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(groq(envelope('gsk_abcdefghijklmnopqrstuv'))).mockResolvedValueOnce(groq(envelope('A resistor limits current.'), 'openai/gpt-oss-20b'));
    expect((await answerChat({ env, system: 'OHMI', messages, fetch: fetcher })).model).toBe('openai/gpt-oss-20b');
  });
  it('provides local identity without calling a provider', async () => {
    const fetcher = vi.fn();
    expect((await answerChat({ env, system: 'OHMI', messages: [{ role: 'user', content: 'Who are you?' }], fetch: fetcher })).mode).toBe('local');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('answers model questions from runtime identity rather than generated claims', async () => {
    const result = await answerChat({ env, system: 'OHMI', messages: [{ role: 'user', content: 'What model are you using?' }], fetch: async () => groq(envelope('I am GPT-4.')) });
    expect(result.answer).toContain('openai/gpt-oss-120b');
    expect(result.answer).not.toContain('GPT-4');
  });
  it('enforces only the copied per-runtime burst guard', () => {
    for (let i = 0; i < 20; i++) expect(consumeChatBurst('burst-test', 100)).toBe(true);
    expect(consumeChatBurst('burst-test', 100)).toBe(false);
    expect(consumeChatBurst('another-user', 100)).toBe(true);
    expect(consumeChatBurst('burst-test', 60101)).toBe(true);
  });
  it('includes the current question inside the full 24-message/16000-character bound', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => groq());
    const history = Array.from({ length: 24 }, () => ({ role: 'assistant' as const, content: 'x'.repeat(3000) }));
    await answerChat({ env, system: 'OHMI', messages: [...history, ...messages], fetch: fetcher });
    const sent = JSON.parse(fetcher.mock.calls[0][1]!.body as string).messages.slice(2);
    expect(sent.length).toBeLessThanOrEqual(24);
    expect(sent.reduce((sum: number, item: { content: string }) => sum + item.content.length, 0)).toBeLessThanOrEqual(16000);
    expect(sent.at(-1)).toEqual(messages[0]);
  });
  it('keeps complete separate code context outside conversational clipping', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => groq());
    const code = '//'.repeat(3990) + 'END_OF_SKETCH';
    await answerChat({ env, system: 'OHMI', messages, snapshot: JSON.stringify({ code }), fetch: fetcher });
    const sent = JSON.parse(fetcher.mock.calls[0][1]!.body as string).messages;
    expect(sent[1].content).toContain('END_OF_SKETCH');
    expect(sent.at(-1).content).toBe(messages[0].content);
  });
  it('bounds a completely hung provider chain without relying on upstream cancellation', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(() => new Promise<Response>(() => {}));
      const pending = answerChat({ env, system: 'OHMI', messages, fetch: fetcher });
      await vi.advanceTimersByTimeAsync(22001);
      expect((await pending).mode).toBe('limited');
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally { vi.useRealTimers(); }
  });
});
