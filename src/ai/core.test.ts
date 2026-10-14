import { describe, expect, it } from 'vitest';
import { parseAnalysis, parseAiRequest, tutorPrompt, generate, providerDiagnostic } from '../../supabase/functions/_shared/ai-core';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const analysis = { title: 'LED exercise', status: 'ready', summary: 'Learn current limiting.', objectives: ['Explain LED polarity'], components: [{ name: 'LED', quantity: '1', details: 'Rating not specified' }], expectedResults: ['Observe LED behavior'], assumptions: [], uncertainties: ['Supply voltage not specified'], steps: [{ title: 'Read ratings', instruction: 'Find the LED data sheet.', why: 'Ratings determine safe current.', check: 'Do you know the rating?', code: '' }] };
describe('AI trust boundaries', () => {
  it('keeps provider diagnostics useful without logging private error payloads',()=>{
    const diagnostic=providerDiagnostic({error:{code:'json_validate_failed',message:'Failed to generate JSON: PRIVATE_STUDENT_PROMPT',failed_generation:'PRIVATE_ANSWER',details:[{fieldViolations:[{field:'generationConfig.responseSchema.properties.title',description:'PRIVATE_KEY'},{field:'PRIVATE_FILENAME'}]}]}});
    expect(diagnostic).toEqual({code:'json_validate_failed',reason:'invalid_generated_json',fields:['generationConfig.responseSchema']});
    expect(JSON.stringify(diagnostic)).not.toMatch(/PRIVATE/);
    expect(providerDiagnostic({error:{code:'PRIVATE_KEY',message:'PRIVATE_KEY'}}).code).toBeUndefined();
    expect(providerDiagnostic({error:{details:[{fieldViolations:[{field:'generationConfig.PRIVATE_KEY'},{field:'contents.PRIVATE_STUDENT_NAME'}]}]}}).fields).toEqual([]);
  });
  it('reports only quota windows and bounded RetryInfo delay',()=>{
    expect(providerDiagnostic({error:{status:'RESOURCE_EXHAUSTED',message:'Quota exhausted for requests per day PROJECT_SECRET',details:[{retryDelay:'45.2s'}]}})).toEqual({code:'RESOURCE_EXHAUSTED',reason:undefined,fields:[],quotaWindows:['day'],retryAfterSeconds:46});
    expect(providerDiagnostic({error:{status:'RESOURCE_EXHAUSTED',details:[{retryDelay:'PRIVATE_KEY'}]}}).retryAfterSeconds).toBeUndefined();
  });
  it('accepts bounded analysis and rejects missing reasoning or invalid structure', () => {
    expect(parseAnalysis(analysis)).toEqual(analysis);
    for (const bad of [{ ...analysis, steps: [] }, { ...analysis, steps: [{ ...analysis.steps[0], why: '' }] }, { ...analysis, components: 'invented' }, {...analysis,components:[{...analysis.components[0],quantity:'}, {'}]}, { ...analysis, summary: 'x'.repeat(5001) }]) expect(() => parseAnalysis(bad)).toThrow();
  });
  it('allows a clarification result without inventing steps', () => {
    const unclear = { ...analysis, status: 'needs_clarification', steps: [] };
    expect(parseAnalysis(unclear)).toEqual(unclear);
    expect(() => parseAnalysis({ ...unclear, uncertainties: [] })).toThrow();
    expect(() => parseAnalysis({ ...unclear, steps: analysis.steps })).toThrow();
    expect(() => parseAnalysis({ ...analysis, status: ['ready'], steps: [], uncertainties: [] })).toThrow();
  });
  it('accepts owned chat request IDs and rejects caller paths, roles, empty or oversized messages', () => {
    const chat = { kind: 'chat', accountId: id, requestId: id, conversationId: id, message: 'Why use a resistor?' };
    expect(parseAiRequest(chat)).toEqual(chat);
    for (const bad of [{ ...chat, message: ' ' }, { ...chat, message: 'x'.repeat(6001) }, { ...chat, url: 'https://evil.example' }, { ...chat, role: 'system' }, { ...chat, stepIndex: -1 }, { ...chat, requestId: '../file' }]) expect(() => parseAiRequest(bad)).toThrow();
  });
  it('keeps language, uncertainty, untested code, and document injection rules in the tutor instruction', () => {
    const prompt = tutorPrompt('taglish');
    expect(prompt).toMatch(/Taglish/); expect(prompt).toMatch(/untrusted/i); expect(prompt).toMatch(/electrically verif/i); expect(prompt).toMatch(/untested/i);
  });
});
describe('bounded provider requests', () => {
  const input: Parameters<typeof generate>[1] = { contents: [{ role: 'user', parts: [{ text: 'Explain resistance.' }] }], language: 'english', analysis: false };
  it('uses the REST JSON MIME type for primary structured output and preserves image bytes',async()=>{
    let body:any;
    const media={inlineData:{mimeType:'image/png',data:'iVBORw0KGgo='}};
    await generate('test-key',{...input,analysis:true,contents:[{role:'user',parts:[media]}]},async(url,options)=>{
      body=JSON.parse(String(options?.body));return Response.json(String(url).endsWith('countTokens')?{totalTokens:10}:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(analysis)}]}}],usageMetadata:{promptTokenCount:10,totalTokenCount:20}});
    });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
    expect(body.generationConfig.responseFormat).toBeUndefined();
    expect(body.generationConfig.responseSchema.properties.steps.maxItems).toBeUndefined();
    expect(body.generationConfig.responseSchema.additionalProperties).toBeUndefined();
    expect(body.contents[0].parts[0]).toEqual(media);
  });
  it('keeps HTTP 400 user errors bounded and never retries invalid requests',async()=>{
    let calls=0;
    await expect(generate('test-key',{...input,analysis:true},async()=>{
      calls++;return calls===1?Response.json({totalTokens:10}):Response.json({error:{status:'INVALID_ARGUMENT',message:'Schema rejected PRIVATE_PROMPT',details:[{fieldViolations:[{field:'generationConfig.responseFormat.text.mimeType',description:'PRIVATE_KEY'}]}]}},{status:400});
    })).rejects.toThrow(/gemini-3.6-flash.*HTTP 400/);
    expect(calls).toBe(2);
  });
  it('uses the compatible structured-output fields for the 3.6 fallback',async()=>{
    let body:any;
    await generate('test-key',{...input,analysis:true},async(url,options)=>{body=JSON.parse(String(options?.body));return Response.json(String(url).endsWith('countTokens')?{totalTokens:10}:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(analysis)}]}}],usageMetadata:{promptTokenCount:10,totalTokenCount:20}});},{model:'gemini-3.6-flash'});
    expect(body.store).toBeUndefined();expect(body.generationConfig.responseMimeType).toBe('application/json');expect(body.generationConfig.responseSchema.type).toBe('OBJECT');expect(body.generationConfig.responseSchema.properties.steps.type).toBe('ARRAY');expect(body.generationConfig.responseFormat).toBeUndefined();
  });
  it('counts tokens before generation and returns only completed text plus usage', async () => {
    const requests: string[] = [];
    const fetcher = async (url: string | URL | Request) => { requests.push(String(url)); return Response.json(requests.length === 1 ? { totalTokens: 20 } : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Resistance limits current.' }] } }], usageMetadata: { promptTokenCount: 20, totalTokenCount: 40 } }); };
    expect(await generate('test-key', input, fetcher)).toEqual({ text: 'Resistance limits current.', inputTokens: 20, outputTokens: 20 });
    expect(requests[0]).toMatch(/:countTokens$/); expect(requests[1]).toMatch(/gemini-3.6-flash:generateContent$/);
  });
  it('rejects excessive input before making a paid generation call', async () => {
    let calls = 0;
    await expect(generate('test-key', input, async () => { calls++; return Response.json({ totalTokens: 12001 }); })).rejects.toThrow('too long');
    expect(calls).toBe(1);
  });
  it('recovers one transient 503 without repeating token counting', async () => {
    let calls=0;
    const fetcher=async()=>{calls++;return calls===1?Response.json({totalTokens:10}):calls===2?Response.json({}, {status:503}):Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'A resistor limits current.'}]}}],usageMetadata:{promptTokenCount:10,totalTokenCount:20}});};
    expect((await generate('test-key',input,fetcher)).text).toBe('A resistor limits current.');
    expect(calls).toBe(3);
  });
  it('rejects truncated, blocked, empty, and failed provider responses', async () => {
    for (const result of [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial' }] } }] }, { promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }]) {
      let calls = 0;
      await expect(generate('test-key', input, async () => Response.json(++calls === 1 ? { totalTokens: 10 } : result))).rejects.toThrow();
    }
    await expect(generate('test-key', input, async () => Response.json({ error: 'private provider detail' }, { status: 429 }))).rejects.toThrow('busy');
  });
});
