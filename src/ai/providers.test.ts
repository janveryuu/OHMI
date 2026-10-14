import { expect, it } from 'vitest';
import { generateWithFallback, generateGroq, estimateRequestTokens } from '../../supabase/functions/_shared/ai-providers';
const input = {contents:[{role:'user' as const,parts:[{text:'Why use a resistor?'}]}],language:'english',analysis:false};
const keys = {gemini:'test-google',groq:'test-groq',geminiFree:true,groqFree:true};
const answer = {candidates:[{finishReason:'STOP',content:{parts:[{text:'It limits current.'}]}}],usageMetadata:{promptTokenCount:10,totalTokenCount:20}};
it('prefers Gemini 3.8 on every new request and does not call a fallback on success',async()=>{
  const calls:string[]=[];
  const result=await generateWithFallback(keys,input,async url=>{calls.push(String(url));return Response.json(String(url).endsWith('countTokens')?{totalTokens:10}:answer);});
  expect(result.model).toBe('gemini-3.8-flash');expect(calls).toHaveLength(2);expect(calls.every(url=>url.includes('gemini-3.8-flash'))).toBe(true);
});
it('uses 3.6 only after bounded 3.8 failure and accounts conservatively for failed attempts',async()=>{
  const calls:string[]=[];
  const result=await generateWithFallback(keys,input,async url=>{const value=String(url);calls.push(value);return Response.json(value.endsWith('countTokens')?{totalTokens:10}:value.includes('3.8')?{}:answer,{status:value.includes('3.8')&&value.endsWith('generateContent')?503:200});});
  expect(result.model).toBe('gemini-3.6-flash');expect(calls.filter(url=>url.includes('3.8')&&url.endsWith('generateContent'))).toHaveLength(2);expect(result.accountedTokens).toBe(4136);
});
it('uses Groq only after both Gemini models fail; never forwards raw PDF',async()=>{
  const calls:string[]=[];
  const fetcher:typeof fetch=async url=>{const value=String(url);calls.push(value);return value.includes('groq.com')?Response.json({choices:[{finish_reason:'stop',message:{content:'It limits current.'}}],usage:{prompt_tokens:10,total_tokens:20}}):Response.json(value.endsWith('countTokens')?{totalTokens:10}:{},{status:value.endsWith('countTokens')?200:503});};
  expect((await generateWithFallback(keys,input,fetcher)).model).toBe('qwen/qwen3.8-27b');
  calls.length=0;
  await expect(generateWithFallback(keys,{...input,analysis:true,contents:[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:'JVBERi0='}}]}]},fetcher)).rejects.toThrow(/Gemini/);
  expect(calls.some(url=>url.includes('groq.com'))).toBe(false);
});
it('blocks unconfirmed plans and authentication errors without switching providers',async()=>{
  let calls=0;
  await expect(generateWithFallback({...keys,geminiFree:false,groqFree:false},input,async()=>{calls++;return Response.json({});})).rejects.toThrow('free');expect(calls).toBe(0);
  await expect(generateWithFallback(keys,input,async()=>{calls++;return Response.json({}, {status:403});})).rejects.toThrow('403');expect(calls).toBe(1);
});
it('falls back after a provider connection failure while budgeting the abandoned attempt',async()=>{
  const result=await generateWithFallback(keys,input,async url=>{const value=String(url);if(value.endsWith('countTokens'))return Response.json({totalTokens:10});if(value.includes('3.8'))throw new TypeError('network failed');return Response.json(answer);});
  expect(result.model).toBe('gemini-3.6-flash');expect(result.accountedTokens).toBe(2078);
});
it('bounds free-plan image requests and validates Groq output before returning it',async()=>{
  let calls=0;let body:Record<string,any>={};
  await generateGroq('test', {...input,analysis:true,contents:[{role:'user',parts:[{inlineData:{mimeType:'image/png',data:'iVBORw=='}}]}]},async(_url,options)=>{calls++;body=JSON.parse(String(options?.body));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"test":true}'}}],usage:{prompt_tokens:2500,total_tokens:3000}});});
  expect(body.messages[1].content[0].image_url.url).toBe('data:image/png;base64,iVBORw==');expect(body.max_completion_tokens).toBeLessThan(4096);expect(body.response_format.json_schema.strict).toBe(true);expect(body.store).toBe(false);
  for(const result of [{choices:[{finish_reason:'length',message:{content:'Partial'}}],usage:{prompt_tokens:1,total_tokens:2}},{choices:[{finish_reason:'stop',message:{content:'Answer'}}],usage:{prompt_tokens:3,total_tokens:2}}]) await expect(generateGroq('test',input,async()=>Response.json(result))).rejects.toThrow();
  expect(calls).toBe(1);
});

it('estimates reservations from text and document size without a fixed analysis charge',()=>{
  const small=estimateRequestTokens(input.contents,true,{mime_type:'application/pdf',size_bytes:1800});
  expect(small).toBeLessThan(160000);
  expect(estimateRequestTokens(input.contents,true,{mime_type:'application/pdf',size_bytes:18000})).toBeGreaterThan(small);
  expect(estimateRequestTokens(input.contents,true,{mime_type:'image/png',size_bytes:100000})).toBe(estimateRequestTokens(input.contents,true,{mime_type:'image/jpeg',size_bytes:200000}));
  expect(estimateRequestTokens(input.contents,true,{mime_type:'application/pdf',size_bytes:10485760})).toBe(160000);
});

it('uses an eligible free fallback on provider quota without retrying the exhausted model',async()=>{
  const calls:string[]=[];
  const result=await generateWithFallback(keys,input,async url=>{
    const value=String(url);calls.push(value);
    if(value.endsWith('countTokens'))return Response.json({totalTokens:10});
    return value.includes('3.8')?Response.json({},{status:429}):Response.json(answer);
  });
  expect(result.model).toBe('gemini-3.6-flash');
  expect(calls.filter(url=>url.includes('3.8')&&url.endsWith('generateContent'))).toHaveLength(1);
});

it('reports exhausted free quotas when no eligible provider succeeds',async()=>{
  let calls=0;
  await expect(generateWithFallback(keys,input,async()=>{calls++;return Response.json({},{status:429});})).rejects.toThrow('quota is exhausted');
  expect(calls).toBe(3);
});

it('shows a provider Retry-After without retrying a quota-exhausted Groq request',async()=>{
  let calls=0;
  await expect(generateGroq('test',input,async()=>{calls++;return Response.json({error:{code:'rate_limit_exceeded'}},{status:429,headers:{'retry-after':'45'}});})).rejects.toThrow('Try again in 45 seconds');
  expect(calls).toBe(1);
});
