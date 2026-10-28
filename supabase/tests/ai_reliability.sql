-- Synthetic database-only checks; no inference, files, credentials or persisted fixtures.
-- Run after the migration, or prepend its body (without BEGIN/COMMIT) inside this transaction.
begin;
select set_config('test.owner',gen_random_uuid()::text,true), set_config('test.other',gen_random_uuid()::text,true),
       set_config('test.conversation',gen_random_uuid()::text,true), set_config('test.assignment',gen_random_uuid()::text,true),
       set_config('test.first',gen_random_uuid()::text,true), set_config('test.second',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
insert into public.ohmi_conversations(id,user_id,title) values(current_setting('test.conversation')::uuid,current_setting('test.owner')::uuid,'Synthetic reliability fixture');
insert into public.ohmi_assignments(id,user_id,original_name,object_path,mime_type,size_bytes,status)
values(current_setting('test.assignment')::uuid,current_setting('test.owner')::uuid,'synthetic.pdf',current_setting('test.owner')||'/'||current_setting('test.assignment')||'/assignment.pdf','application/pdf',100,'ready');
insert into public.ohmi_ai_requests(id,user_id,kind,operation,input_hash,conversation_id,assignment_id,language,model,reserved_tokens)
select current_setting(k)::uuid,current_setting('test.owner')::uuid,'analyze','pdf',repeat('a',64),current_setting('test.conversation')::uuid,current_setting('test.assignment')::uuid,'english','gemini-3.5-flash-lite',1000
from unnest(array['test.first','test.second']) k;
select public.ohmi_complete_ai(current_setting('test.first')::uuid,'{"message":"Synthetic question","answer":"Original partial answer","status":"answer","incomplete":true,"continuation":{"operation":"pdf"},"steps":[]}',100,200,'gemini-3.5-flash-lite',800);
select public.ohmi_complete_ai(current_setting('test.second')::uuid,'{"message":"Synthetic question","answer":"Later answer","status":"answer","steps":[]}',100,200,'gemini-3.5-flash-lite',800);
do $test$ declare replay jsonb; begin
 assert (select result_payload->>'answer' from public.ohmi_ai_requests where id=current_setting('test.first')::uuid)='Original partial answer', 'Original immutable snapshot changed';
 assert (select payload->>'answer' from public.ohmi_analyses where id=(select result_id from public.ohmi_ai_requests where id=current_setting('test.first')::uuid))='Later answer', 'Fixture did not exercise analysis overwrite';
 assert (select accounted_tokens from public.ohmi_ai_requests where id=current_setting('test.first')::uuid)=800, 'Reasoning not accounted';
 replay := public.ohmi_reserve_ai(current_setting('test.owner')::uuid,current_setting('test.first')::uuid,'pdf',current_setting('test.assignment')::uuid,repeat('a',64),'english','gemini-3.5-flash-lite',1000,current_setting('test.conversation')::uuid);
 assert replay->>'fresh'='false' and replay->'result_payload'->>'answer'='Original partial answer', 'Exact replay failed';
 begin
  perform public.ohmi_complete_ai(current_setting('test.first')::uuid,'{}',1,1,'gemini-3.5-flash-lite',2);
  raise exception 'Duplicate completion accepted';
 exception when raise_exception then if sqlerrm not like '%no longer pending%' then raise; end if; end;
 perform public.ohmi_reserve_ai(current_setting('test.owner')::uuid,gen_random_uuid(),'chat',null,repeat('b',64),'english','openai/gpt-oss-120b',6401,null);
 assert not has_function_privilege('authenticated','public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer)','EXECUTE'), 'Student can complete requests';
 assert not has_function_privilege('anon','public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer,uuid)','EXECUTE'), 'Anonymous admission available';
end $test$;
-- A response cannot commit after the request lease has expired.
do $test$ declare stale uuid:=gen_random_uuid(); begin
 insert into public.ohmi_ai_requests(id,user_id,kind,operation,input_hash,language,model,reserved_tokens,created_at)
 values(stale,current_setting('test.owner')::uuid,'chat','chat',repeat('e',64),'english','openai/gpt-oss-120b',1000,now()-interval '61 seconds');
 begin
  perform public.ohmi_complete_ai(stale,'{"message":"Synthetic","answer":"Late response"}',1,1,'openai/gpt-oss-120b',2);
  raise exception 'Late completion accepted';
 exception when raise_exception then if sqlerrm not like '%lease expired%' then raise; end if; end;
end $test$;
-- Historical usage and concurrent pending rows cannot impose application consumption quotas.
insert into public.ohmi_ai_requests(id,user_id,kind,operation,input_hash,language,model,reserved_tokens,status,accounted_tokens,created_at,finished_at)
select gen_random_uuid(),current_setting('test.owner')::uuid,'chat','chat',repeat('c',64),'english','openai/gpt-oss-120b',60000,'failed',60000,now()-interval '2 minutes',now()-interval '2 minutes' from generate_series(1,3);
do $test$ begin
 perform public.ohmi_reserve_ai(current_setting('test.owner')::uuid,gen_random_uuid(),'chat',null,repeat('d',64),'english','openai/gpt-oss-120b',null,null);
end $test$;
do $test$ declare request uuid; result jsonb; begin
 for i in 1..45 loop
  request := gen_random_uuid();
  result := public.ohmi_reserve_ai(current_setting('test.owner')::uuid,request,'chat',current_setting('test.conversation')::uuid,repeat('f',64),'english','openai/gpt-oss-120b',64001,null);
  assert result->>'fresh'='true', 'Historical consumption blocked fresh request';
 end loop;
 result := public.ohmi_reserve_ai(current_setting('test.owner')::uuid,request,'chat',current_setting('test.conversation')::uuid,repeat('f',64),'english','openai/gpt-oss-120b',null,null);
 assert result->>'fresh'='false', 'Pending replay generated twice';
 perform public.ohmi_complete_ai(request,'{"message":"Synthetic","answer":"Fallback answer","mode":"ai","provider":"gemini","model":"gemini-2.5-flash"}',1,2,'gemini-2.5-flash',3);
 assert (select model from public.ohmi_ai_requests where id=request)='gemini-2.5-flash', 'Fallback provenance lost';
 request := gen_random_uuid();
 perform public.ohmi_reserve_ai(current_setting('test.owner')::uuid,request,'chat',null,repeat('f',64),'english','openai/gpt-oss-120b',null,null);
 perform public.ohmi_complete_ai(request,'{"message":"Synthetic","answer":"Local identity","mode":"local","provider":"local","model":"ohmi-local"}',0,0,'ohmi-local',0);
 assert (select accounted_tokens from public.ohmi_ai_requests where id=request)=0, 'Local reply charged provider usage';
end $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $test$ begin
 assert (select count(*) from public.ohmi_ai_requests where id=current_setting('test.first')::uuid)=1,'Owner cannot recover';
 assert (select result_payload->>'incomplete' from public.ohmi_ai_requests where id=current_setting('test.first')::uuid)='true','Partial marker missing';
end $test$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $test$ begin
 assert not exists(select 1 from public.ohmi_ai_requests where id=current_setting('test.first')::uuid),'Cross-account snapshot exposed';
end $test$;
reset role;
rollback;
select 'PASS: no TPM/TPD gates, parallel pending requests, exact recovery, single completion, service-only RPCs and owner RLS; all fixtures rolled back' as result;
