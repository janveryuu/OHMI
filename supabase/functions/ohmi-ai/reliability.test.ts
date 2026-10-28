import { describe,it,expect,vi,afterEach } from 'vitest';
import { buildCircuitPrompt,validateEvidenceReference } from './circuit.ts';
import { callAiProviderTransport } from './handler.ts';
describe('AI reliability failure reproductions',()=>{
 afterEach(()=>vi.useRealTimers());
 it('provides the discriminated evidence object the validator requires',()=>{
  const prompt=buildCircuitPrompt({version:2,operation:'circuit_check',requestId:'11111111-1111-4111-8111-111111111111',language:'english',mode:'check',message:'Review',images:[],board:'unknown'} as any,{imageIds:['overview'],codeLineCount:0});
  expect(prompt.systemInstruction).toContain('"kind": "image"');
  expect(()=>validateEvidenceReference({imageId:'overview',location:'LED'},{imageIds:['overview']} as any)).not.toThrow(/undefined/);
 });
 it('keeps visible text and identifies token exhaustion separately from HTTP byte overflow',async()=>{
  const r=await callAiProviderTransport({provider:'gemini',model:'gemini-3.5-flash-lite',systemInstruction:'Explain',promptText:'Synthetic assignment',maxTokens:1536,geminiApiKey:'mock-key',fetchFn:async()=>new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'Part one of a longer answer.'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:300,thoughtsTokenCount:500,totalTokenCount:900}}))});
  expect(r.ok).toBe(true);if(r.ok){expect(r.finishReason).toBe('MAX_TOKENS');expect(r.totalTokens).toBe(900);}
 });
 it('enforces the deadline while a response body is stalled',async()=>{
  vi.useFakeTimers();
  const pending=callAiProviderTransport({provider:'gemini',model:'gemini-3.5-flash-lite',systemInstruction:'Explain',promptText:'test',maxTokens:50,geminiApiKey:'mock-key',timeoutMs:25,fetchFn:async()=>new Response(new ReadableStream({start(){}}))});
  await vi.advanceTimersByTimeAsync(26);
  const verdict=await Promise.race([pending,Promise.resolve('stalled')]);
  expect(verdict).not.toBe('stalled');
  if(typeof verdict==='object'){expect(verdict.ok).toBe(false);if(!verdict.ok)expect(verdict.code).toBe('timeout');}
 });
 it('does not classify a network exception as a provider timeout',async()=>{
  const r=await callAiProviderTransport({provider:'gemini',model:'gemini-3.5-flash-lite',systemInstruction:'Explain',promptText:'test',maxTokens:50,geminiApiKey:'mock-key',fetchFn:async()=>{throw new TypeError('network failure')}});
  expect(r.ok).toBe(false);if(!r.ok)expect(r.code).toBe('provider_error');
 });
 it.each(['gemini', 'groq'] as const)('bounds UTF8 bytes and keeps %s body deadlines active', async(provider)=>{
  const base = { provider, model: provider === 'gemini' ? 'gemini-3.5-flash-lite' : 'openai/gpt-oss-120b', systemInstruction:'Explain',promptText:'test',maxTokens:50,geminiApiKey:'mock-key',groqApiKey:'mock-key' };
  const oversized = await callAiProviderTransport({ ...base, fetchFn:async()=>new Response('x'.repeat(129*1024)) });
  expect(oversized.ok).toBe(false); if(!oversized.ok)expect(oversized.code).toBe('payload_too_large');
  vi.useFakeTimers();
  const pending=callAiProviderTransport({ ...base, timeoutMs:25,fetchFn:async()=>new Response(new ReadableStream({start(){}})) });
  await vi.advanceTimersByTimeAsync(26);
  const result=await pending; expect(result.ok).toBe(false);if(!result.ok)expect(result.code).toBe('timeout');
 });
 it('never exposes thought parts in a partial plain answer',async()=>{
  const result=await callAiProviderTransport({provider:'gemini',model:'gemini-3.5-flash-lite',systemInstruction:'Explain',promptText:'test',maxTokens:50,geminiApiKey:'mock-key',fetchFn:async()=>new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'private reasoning',thought:true},{text:'Visible answer'}]}}]}))});
  expect(result.ok).toBe(true);if(result.ok)expect(result.text).toBe('Visible answer');
 });
 it('serializes maxOutputTokens when images are present in Gemini request', async () => {
  let capturedBody: any;
  await callAiProviderTransport({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    systemInstruction: 'Check circuit',
    promptText: 'Analyze',
    maxTokens: 3072,
    geminiApiKey: 'mock-key',
    images: [{ mimeType: 'image/png', data: 'iVBORw0KGgo=' }],
    fetchFn: async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"status":"reviewed"}' }] } }] }));
    }
  });
  expect(capturedBody.generationConfig?.maxOutputTokens).toBe(3072);
 });
 it('serializes maxOutputTokens when pdf is present in Gemini request', async () => {
  let capturedBody: any;
  await callAiProviderTransport({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    systemInstruction: 'Tutorial',
    promptText: 'Guide',
    maxTokens: 4096,
    geminiApiKey: 'mock-key',
    pdf: { mimeType: 'application/pdf', data: 'JVBERi0xLjQ=' },
    fetchFn: async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"status":"tutorial"}' }] } }] }));
    }
  });
  expect(capturedBody.generationConfig?.maxOutputTokens).toBe(4096);
 });
 it('preserves HTTP 503 vs 429 status and parses retry-after header', async () => {
  const rateLimitRes = await callAiProviderTransport({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    systemInstruction: 'Check',
    promptText: 'test',
    maxTokens: 100,
    geminiApiKey: 'mock-key',
    fetchFn: async () => new Response(JSON.stringify({ error: { message: 'Resource exhausted' } }), {
      status: 429,
      headers: { 'retry-after': '45' }
    })
  });
  expect(rateLimitRes.ok).toBe(false);
  if (!rateLimitRes.ok) {
    expect(rateLimitRes.status).toBe(429);
    expect(rateLimitRes.code).toBe('rate_limit');
    expect(rateLimitRes.retryAfterSeconds).toBe(45);
  }

  const unavailRes = await callAiProviderTransport({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    systemInstruction: 'Check',
    promptText: 'test',
    maxTokens: 100,
    geminiApiKey: 'mock-key',
    fetchFn: async () => new Response(JSON.stringify({ error: { message: 'Service unavailable' } }), {
      status: 503,
      headers: { 'retry-after': '25' }
    })
  });
  expect(unavailRes.ok).toBe(false);
  if (!unavailRes.ok) {
    expect(unavailRes.status).toBe(503);
    expect(unavailRes.code).toBe('unavailable');
    expect(unavailRes.retryAfterSeconds).toBe(25);
  }
 });

});
