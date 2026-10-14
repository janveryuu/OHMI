import { ANALYSIS_INSTRUCTION, ANALYSIS_SCHEMA, generate, providerDiagnostic, ProviderError, tutorPrompt, type Content } from './ai-core.ts';

export type ProviderKeys = { gemini: string; groq?: string; geminiFree: boolean; groqFree: boolean };
type Input = { contents: Content[]; language: string; analysis: boolean };
const canFallback = (error: unknown) => error instanceof ProviderError && [404,408,429,500,502,503].includes(error.status);

export function estimateRequestTokens(contents: Content[], analysis: boolean, document?: { mime_type: string; size_bytes: number }) {
  let prompt = 1024;
  for (const content of contents) for (const part of content.parts) {
    prompt += 'text' in part ? Math.ceil(new TextEncoder().encode(part.text).length / 3) : part.inlineData.mimeType === 'application/pdf' ? Math.ceil(part.inlineData.data.length * 3 / 4 / 3) : 2048;
  }
  if (document) prompt += document.mime_type === 'application/pdf' ? Math.ceil(document.size_bytes / 3) : 2048;
  return Math.min(analysis ? 160000 : 64000, (prompt + (analysis ? 8192 : 2048)) * (document?.mime_type === 'application/pdf' ? 3 : 4));
}

export async function generateGroq(key: string, input: Input, fetcher: typeof fetch = fetch, signal = AbortSignal.timeout(45000)) {
  const system = tutorPrompt(input.language) + (input.analysis ? '\n' + ANALYSIS_INSTRUCTION : '');
  let textBytes = new TextEncoder().encode(system).length; let images = 0;
  const messages = [{role:'system',content:system}, ...input.contents.map(message => ({role:message.role === 'model' ? 'assistant' : 'user',content:message.parts.map(part => {
    if ('text' in part) { textBytes += new TextEncoder().encode(part.text).length; return {type:'text',text:part.text}; }
    if (!['image/png','image/jpeg'].includes(part.inlineData.mimeType)) throw new Error('Groq fallback supports PNG/JPG assignments, not PDF. Retry Gemini later.');
    images++; return {type:'image_url',image_url:{url:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}};
  })}))];
  const estimatedInput = textBytes + images*2048 + (input.analysis ? new TextEncoder().encode(JSON.stringify(ANALYSIS_SCHEMA)).length : 0);
  const maxOutput = Math.min(input.analysis?4096:2048,8000-estimatedInput-64);
  if (images > 3 || maxOutput < 1024) throw new Error('This context is too long for the free Groq fallback. Use one smaller image or start a new conversation.');
  const body = JSON.stringify({model:'qwen/qwen3.8-27b',messages,reasoning_effort:'none',reasoning_format:'hidden',max_completion_tokens:maxOutput,store:false,
    ...(input.analysis ? {response_format:{type:'json_schema',json_schema:{name:'ohmi_assignment',strict:true,schema:ANALYSIS_SCHEMA}}} : {})});
  if (body.length > 20000000) throw new Error('This image is too large for Groq fallback. Retry Gemini later.');
  let response: Response;
  try { response = await fetcher('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body,signal}); }
  catch { throw new Error('AI connection timed out or failed. Retry; saved work is unchanged.'); }
  if (!response.ok) {
    let diagnostic: ReturnType<typeof providerDiagnostic> | undefined;
    try { diagnostic=providerDiagnostic(await response.json()); } catch { /* Keep the HTTP status when the provider did not return JSON. */ }
    const retryAfter=Number(response.headers.get('retry-after'));
    const retryHint=retryAfter>0&&retryAfter<=172800?` Try again in ${Math.ceil(retryAfter)} seconds.`:'';
    console.warn(JSON.stringify({retryAfterSeconds:retryAfter>0&&retryAfter<=172800?Math.ceil(retryAfter):undefined,provider:'groq',model:'qwen/qwen3.8-27b',httpStatus:response.status,...diagnostic,images,maxOutput,format:input.analysis?'json_schema':'text'}));
    throw new ProviderError(response.status,response.status===429?`The eligible free AI providers are busy or their quota is exhausted.${retryHint||' Retry later.'}${diagnostic?.quotaWindows?' '+diagnostic.quotaWindows.join('/')+' quota.':''} Paid billing is off.`:`Groq fallback is unavailable (HTTP ${response.status}). Retry later; billing remains unchanged.`);
  }
  const raw = await response.text(); if (raw.length > 500000) throw new Error('AI response is too large. Try a smaller assignment.');
  const data = JSON.parse(raw); const choice = data.choices?.[0];
  if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.trim() || choice.message.content.length > (input.analysis ? 100000 : 18000)) throw new Error('AI response was blocked or incomplete. Try a shorter, clearer request.');
  const inputTokens = data.usage?.prompt_tokens; const total = data.usage?.total_tokens;
  if (!Number.isInteger(inputTokens) || !Number.isInteger(total) || inputTokens < 0 || total < inputTokens || total > 40000) throw new Error('AI usage could not be verified. Retry later.');
  return {text:choice.message.content.trim(),inputTokens,outputTokens:total-inputTokens};
}

export async function generateWithFallback(keys: ProviderKeys, input: Input, fetcher: typeof fetch = fetch) {
  if (!keys.geminiFree) throw new Error('Confirm the Gemini project uses the free tier before enabling OHMI AI.');
  const signal = AbortSignal.timeout(input.analysis?90000:70000); const outputAllowance = input.analysis ? 8192 : 2048;
  let uncertainTokens = 0; let lastError: unknown;
  for (const model of ['gemini-3.8-flash','gemini-3.6-flash'] as const) {
    let attempts = 0; let allowance = estimateRequestTokens(input.contents,input.analysis)/4;
    const countedFetch: typeof fetch = (url,options) => { if (String(url).endsWith(':generateContent')) attempts++; return fetcher(url,options); };
    try {
      const modelSignal = AbortSignal.any([signal,AbortSignal.timeout(model==='gemini-3.8-flash'?(input.analysis?40000:30000):(input.analysis?30000:20000))]);
      const generated = await generate(keys.gemini,input,countedFetch,{model,signal:modelSignal,retry503:model==='gemini-3.8-flash',onCount:count=>{allowance=count+outputAllowance;}});
      return {...generated,model,accountedTokens:uncertainTokens + Math.max(0,attempts-1)*allowance + generated.inputTokens + generated.outputTokens};
    } catch (error) { if (!canFallback(error)) throw error; uncertainTokens += attempts*allowance; lastError = error; }
  }
  const groqCompatible=input.contents.every(content=>content.parts.every(part=>'text' in part||['image/png','image/jpeg'].includes(part.inlineData.mimeType)));
  if (keys.groq && keys.groqFree && groqCompatible && !signal.aborted) {
    const generated = await generateGroq(keys.groq,input,fetcher,signal);
    return {...generated,model:'qwen/qwen3.8-27b',accountedTokens:uncertainTokens+generated.inputTokens+generated.outputTokens};
  }
  throw lastError;
}
