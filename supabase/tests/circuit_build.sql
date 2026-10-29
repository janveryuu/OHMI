-- Disposable synthetic users only; run after actual migration history.
begin;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.other',gen_random_uuid()::text,true),
       set_config('test.conversation',gen_random_uuid()::text,true),set_config('test.request',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
insert into public.ohmi_conversations(id,user_id,title) values(current_setting('test.conversation')::uuid,current_setting('test.owner')::uuid,'Synthetic circuit build');
do $$ declare result jsonb; begin
  result:=public.ohmi_reserve_circuit_build(current_setting('test.owner')::uuid,current_setting('test.request')::uuid,current_setting('test.conversation')::uuid,repeat('a',64),'english');
  assert result->>'fresh'='true' and result->>'operation'='circuit_build' and result->>'model'='openai/gpt-oss-120b','Invalid admission';
  result:=public.ohmi_reserve_circuit_build(current_setting('test.owner')::uuid,current_setting('test.request')::uuid,current_setting('test.conversation')::uuid,repeat('a',64),'english');
  assert result->>'fresh'='false','Duplicate generation admitted';
  begin
    perform public.ohmi_reserve_circuit_build(current_setting('test.other')::uuid,current_setting('test.request')::uuid,current_setting('test.conversation')::uuid,repeat('a',64),'english');
    raise exception 'Cross-owner replay admitted';
  exception when raise_exception then if sqlerrm not like '%does not match%' then raise;end if;end;
  begin
    perform public.ohmi_reserve_circuit_build(current_setting('test.other')::uuid,gen_random_uuid(),current_setting('test.conversation')::uuid,repeat('b',64),'english');
    raise exception 'Cross-owner conversation admitted';
  exception when raise_exception then if sqlerrm not like '%Conversation unavailable%' then raise;end if;end;
  begin
    perform public.ohmi_complete_ai(current_setting('test.request')::uuid,'{"kind":"circuit_build","answer":"Synthetic"}',1,2,'openai/gpt-oss-20b',3);
    raise exception 'Planner model changed';
  exception when raise_exception then if sqlerrm not like '%provenance%' then raise;end if;end;
  perform public.ohmi_complete_ai(current_setting('test.request')::uuid,'{"version":1,"kind":"circuit_build","answer":"Synthetic","message":"Synthetic build","provider":"groq","model":"openai/gpt-oss-120b"}',1,2,'openai/gpt-oss-120b',3);
  perform public.ohmi_fail_ai(current_setting('test.request')::uuid,'lost_ack');
  assert (select status='completed' from public.ohmi_ai_requests where id=current_setting('test.request')::uuid),'Ambiguous ack overwrote completed result';
  assert (select count(*) from public.ohmi_messages where request_id=current_setting('test.request')::uuid)=2,'Messages not persisted once';
  result:=public.ohmi_reserve_circuit_build(current_setting('test.owner')::uuid,current_setting('test.request')::uuid,current_setting('test.conversation')::uuid,repeat('a',64),'english');
  assert result->>'status'='completed' and result->>'fresh'='false','Completed replay lost';
  assert not has_function_privilege('authenticated','public.ohmi_reserve_circuit_build(uuid,uuid,uuid,text,text)','EXECUTE'),'Student admission exposed';
  assert not has_function_privilege('anon','public.ohmi_reserve_circuit_build(uuid,uuid,uuid,text,text)','EXECUTE'),'Anonymous admission exposed';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$ begin assert (select count(*) from public.ohmi_ai_requests where id=current_setting('test.request')::uuid)=0,'Cross-owner recovery exposed';end $$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$ begin assert (select result_payload->>'kind' from public.ohmi_ai_requests where id=current_setting('test.request')::uuid)='circuit_build','Owner cannot recover';end $$;
reset role;
rollback;
