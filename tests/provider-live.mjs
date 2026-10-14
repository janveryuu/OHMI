import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { generate, parseAnalysis } from '../supabase/functions/_shared/ai-core.ts';
import { generateGroq } from '../supabase/functions/_shared/ai-providers.ts';

assert.equal(process.env.OHMI_CONFIRMED_FREE_PLANS,'1','Only run after confirming both provider accounts are free');
const secretFile='.superpowers/sdd/2026-10-14-phase-4/provider-tests.env';
const keys=Object.fromEntries((await readFile(secretFile,'utf8')).trim().split(/\r?\n/).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
let records=[];try{records=JSON.parse(await readFile('.superpowers/sdd/2026-10-14-phase-4/provider-results.json','utf8'));}catch{}
const file=async(ext,mimeType)=>({inlineData:{mimeType,data:(await readFile(`tests/fixtures/phase-4/led-lab.${ext}`)).toString('base64')}});
try {
  for(const model of ['gemini-3.8-flash','gemini-3.6-flash'].filter(model=>!process.env.OHMI_PROVIDER_MODEL||model===process.env.OHMI_PROVIDER_MODEL)) {
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`,{headers:{'x-goog-api-key':keys.GEMINI_API_KEY},signal:AbortSignal.timeout(15000)});
    const metadata=await response.json();assert.equal(response.status,200);assert.equal(metadata.name,`models/${model}`);
    console.log(`MODEL VERIFIED ${model} HTTP 200`);
  }
  const cases=[
    {model:'gemini-3.8-flash',name:'electronics and Arduino',analysis:false,parts:[{text:'For a fictional Arduino Uno assignment: D9 supplies 5 V logic, red LED forward voltage is 2 V, max current 20 mA, series resistor 220 ohms. Calculate the expected approximate current with units, explain LED polarity and current limiting, then give complete setup()/loop() code blinking D9 for 1 second on and 1 second off. Clearly label code untested. Keep concise.'}]},
    {model:'gemini-3.6-flash',name:'electronics and Arduino',analysis:false,parts:[{text:'Explain why an LED needs a series resistor. Then give complete untested Arduino Uno setup()/loop() code blinking digital pin 9 for 1 second on and off. Include current/polarity cautions, without inventing component ratings.'}]},
    {model:'gemini-3.8-flash',name:'PDF assignment',analysis:true,parts:[{text:'Analyze the fictional assignment in this PDF.'},await file('pdf','application/pdf')]},
    {model:'gemini-3.6-flash',name:'PDF assignment',analysis:true,parts:[{text:'Analyze the fictional assignment in this PDF.'},await file('pdf','application/pdf')]},
    {model:'qwen/qwen3.8-27b',name:'electronics and Arduino',analysis:false,parts:[{text:'Explain LED current limiting, then give complete untested Arduino Uno setup()/loop() code blinking D9 for 1 second on and off. Do not invent unknown component ratings.'}]},
    {model:'qwen/qwen3.8-27b',name:'PNG assignment and circuit image',analysis:true,parts:[{text:'Analyze this fictional assignment and connection diagram. Do not claim electrical verification.'},await file('png','image/png')]},
    {model:'qwen/qwen3.8-27b',name:'JPG assignment and circuit image',analysis:true,parts:[{text:'Analyze this fictional assignment and connection diagram. Do not claim electrical verification.'},await file('jpg','image/jpeg')]},
  ];
  for(const test of cases.filter(test=>(!process.env.OHMI_PROVIDER_CASE||test.name===process.env.OHMI_PROVIDER_CASE)&&(!process.env.OHMI_PROVIDER_MODEL||test.model===process.env.OHMI_PROVIDER_MODEL))) {
    try {
      const input={contents:[{role:'user',parts:test.parts}],language:'english',analysis:test.analysis};
      const inspectedFetch=async(url,options)=>{const response=await fetch(url,options);if(response.status===400&&process.env.OHMI_SHOW_PROVIDER_ERROR==='1'){const failure=await response.clone().json();let message=String(failure.error?.message??'');for(const key of Object.values(keys))message=message.replaceAll(key,'[REDACTED]');console.log('FICTIONAL FIXTURE API ERROR:',message.slice(0,600));}return response;};
      const result=test.model.startsWith('gemini')?await generate(keys.GEMINI_API_KEY,input,inspectedFetch,{model:test.model,retry503:false}):await generateGroq(keys.GROQ_API_KEY,input,inspectedFetch);
      if(test.analysis)await writeFile('.superpowers/sdd/2026-10-14-phase-4/last-analysis.json',result.text);
      const analysis=test.analysis?parseAnalysis(JSON.parse(result.text)):undefined;
      if(analysis){assert.match(JSON.stringify(analysis),/220/);assert.ok(analysis.status==='ready'&&analysis.steps.length>0);}
      else {assert.match(result.text,/resistor|current/i);assert.match(result.text,/setup\s*\(/);assert.match(result.text,/loop\s*\(/);assert.match(result.text,/untested|not.*test/i);}
      records.push({model:test.model,case:test.name,ok:true,inputTokens:result.inputTokens,outputTokens:result.outputTokens,answer:result.text});
      console.log(`PASS ${test.model}: ${test.name} (${result.inputTokens}+${result.outputTokens} tokens)`);
    } catch(error) {records.push({model:test.model,case:test.name,ok:false,error:error.message});console.log(`UNAVAILABLE ${test.model}: ${test.name}: ${error.message}`);}
    await writeFile('.superpowers/sdd/2026-10-14-phase-4/provider-results.json',JSON.stringify(records,null,2));
  }
} finally {await unlink(secretFile);}
