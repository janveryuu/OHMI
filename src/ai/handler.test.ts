import { expect, it, vi } from 'vitest';
import { createAiHandler, type ScopedAi } from '../../supabase/functions/_shared/ai-handler';
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
it('rejects missing authentication before invoking any backend or provider', async () => {
  let calls = 0;
  const handler = createAiHandler(async () => { calls++; throw new Error('Must not run'); });
  expect((await handler(new Request('https://test', { method: 'POST', body: '{}' }))).status).toBe(401);
  expect(calls).toBe(0);
});
it('rejects a changed account and malformed request before database work', async () => {
  const handler = createAiHandler(async () => ({ userId: id } as ScopedAi));
  for (const body of [{ kind: 'chat', accountId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', requestId: id, conversationId: id, message: 'Question' }, { kind: 'analyze', accountId: id, requestId: id, assignmentId: '../file' }]) {
    const result = await handler(new Request('https://test', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    expect(result.status).toBe(400);
  }
});
it('returns a safe expired-auth error without leaking provider or auth details', async () => {
  const handler = createAiHandler(async () => { throw new Error('private detail'); });
  const result = await handler(new Request('https://test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: '{}' }));
  expect(result.status).toBe(401); expect(await result.text()).not.toContain('private detail');
});
it('resolves abandoned reservations atomically before allowing a new retry', async () => {
  const input={kind:'chat',accountId:id,requestId:id,conversationId:id,message:'Question'};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({input,language:'english'})));
  const inputHash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  let calls=0;
  const user={from(table:string){const data=table==='ohmi_profiles'?{language:'english'}:{input_hash:inputHash,status:'pending',result_id:null,created_at:'2020-01-01'};const query={select(){return query;},eq(){return query;},single:async()=>({data,error:null}),maybeSingle:async()=>({data,error:null})};return query;}};
  const handler=createAiHandler(async()=>({userId:id,key:'test',groqKey:'test',user,admin:{rpc:async()=>{calls++;return{data:{fresh:false,status:'failed'},error:null};}}} as unknown as ScopedAi));
  const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(input)}));
  expect(await response.json()).toMatchObject({ok:false,retryNew:true});expect(calls).toBe(1);
});
it('permits a fresh ID when immutable input or language changes', async () => {
  const user={from(table:string){const data=table==='ohmi_profiles'?{language:'taglish'}:{input_hash:'old',status:'completed',result_id:id};const query={select(){return query;},eq(){return query;},single:async()=>({data,error:null}),maybeSingle:async()=>({data,error:null})};return query;}};
  const handler=createAiHandler(async()=>({userId:id,key:'test',groqKey:'test',user} as unknown as ScopedAi));
  const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({kind:'chat',accountId:id,requestId:id,conversationId:id,message:'Question'})}));
  expect(await response.json()).toMatchObject({ok:false,retryNew:true});
});

it.each(['image/png','application/pdf'])('records Groq usage for %s and never forwards raw PDF even when quality validation fails',async mime=>{
  const row:Record<string,unknown>={id,status:'pending'};let completed=false;
  const chain=(data:unknown,write?:Record<string,unknown>)=>{
    const query={select(){return query;},eq(){return query;},in(){return query;},gt(){return query;},abortSignal(){return query;},single:async()=>({data,error:null}),maybeSingle:async()=>({data,error:null}),then(resolve:(value:unknown)=>unknown){if(write)Object.assign(row,write);return Promise.resolve({data,error:null}).then(resolve);}};return query;
  };
  const bytes=new Uint8Array(mime==='application/pdf'?[37,80,68,70,45,49,46,55]:[137,80,78,71,13,10,26,10]);
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const user={from(table:string){return chain(table==='ohmi_profiles'?{language:'english'}:table==='ohmi_assignments'?{id,object_path:'owned.file',mime_type:mime,size_bytes:bytes.length}:null);},storage:{from(){return{download:async()=>({data:new Blob([bytes],{type:mime}),error:null})};}}};
  const admin={from(table:string){return table==='ohmi_ai_provider_backoffs'?chain([]):{update(write:Record<string,unknown>){return chain([{id}],write);}};},rpc:async(name:string)=>{if(name==='ohmi_complete_ai')completed=true;return{data:{fresh:true},error:null};}};
  const bad={title:'LED',status:'ready',summary:'5V, 2V, 220 ohms',objectives:[],components:[],expectedResults:['LED current is 16.8 mA.'],assumptions:[],uncertainties:[],steps:[{title:'Check',instruction:'Read ratings on PDF page 1',why:'LED current {{led_current_mA:5,2,220}}.',check:'Why limit current?',code:''}]};
  const calls:{url:string;body:any}[]=[];
  vi.stubGlobal('fetch',async(url:string,options:RequestInit)=>{calls.push({url,body:JSON.parse(String(options.body))});return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(bad)}}],usage:{prompt_tokens:123,total_tokens:456}});});
  try{
    const handler=createAiHandler(async()=>({userId:id,key:'',groqKey:'test',geminiFree:false,groqFree:true,user,admin} as unknown as ScopedAi));
    const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({kind:'analyze',accountId:id,requestId:id,assignmentId:id,...(mime==='application/pdf'?{pdfContext:{sha256:digest,totalPages:1,pages:[{page:1,text:'5V, 2V, 220 ohms'}],images:[]}}:{})})}));
    expect(await response.json()).toMatchObject({ok:false,retryNew:true});
    expect(row).toMatchObject({status:'failed',model:'qwen/qwen3.8-27b',input_tokens:123,output_tokens:333,accounted_tokens:456});expect(completed).toBe(false);
    expect(calls).toHaveLength(1);expect(calls[0]!.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    if(mime==='image/png')expect(calls[0]!.body.messages[1].content[1].image_url.url).toBe(`data:${mime};base64,${btoa(String.fromCharCode(...bytes))}`);
    else {expect(JSON.stringify(calls[0]!.body)).toContain('[PDF page 1]');expect(JSON.stringify(calls[0]!.body)).not.toContain('application/pdf');}
  }finally{vi.unstubAllGlobals();}
});
