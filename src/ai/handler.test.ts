import { expect, it } from 'vitest';
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
  const handler=createAiHandler(async()=>({userId:id,key:'test',user,admin:{rpc:async()=>{calls++;return{data:{fresh:false,status:'failed'},error:null};}}} as unknown as ScopedAi));
  const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(input)}));
  expect(await response.json()).toMatchObject({ok:false,retryNew:true});expect(calls).toBe(1);
});
it('permits a fresh ID when immutable input or language changes', async () => {
  const user={from(table:string){const data=table==='ohmi_profiles'?{language:'taglish'}:{input_hash:'old',status:'completed',result_id:id};const query={select(){return query;},eq(){return query;},single:async()=>({data,error:null}),maybeSingle:async()=>({data,error:null})};return query;}};
  const handler=createAiHandler(async()=>({userId:id,key:'test',user} as unknown as ScopedAi));
  const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({kind:'chat',accountId:id,requestId:id,conversationId:id,message:'Question'})}));
  expect(await response.json()).toMatchObject({ok:false,retryNew:true});
});
