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

});
