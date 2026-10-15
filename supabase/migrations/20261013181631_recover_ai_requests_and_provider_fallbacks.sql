begin;
-- Unknown failed-attempt usage is conservatively budgeted; successful usage stays separately visible.
alter table public.ohmi_ai_requests add column accounted_tokens integer check(accounted_tokens>=0 and accounted_tokens<=reserved_tokens);
-- Four maximum attempts: primary plus one 503 retry, first fallback, then compatible Groq fallback.
create or replace function public.ohmi_reserve_ai(p_user_id uuid,p_request_id uuid,p_kind text,p_target uuid,p_hash text,p_language text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.ohmi_ai_requests; day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'; tokens integer; begin
  perform pg_advisory_xact_lock(9134104);
  select * into job from public.ohmi_ai_requests where id=p_request_id for update;
  if found then
    if job.user_id is distinct from p_user_id or job.input_hash<>p_hash then raise exception 'Request replay does not match'; end if;
    if job.status='pending' and job.created_at<now()-interval '2 minutes' then
      update public.ohmi_ai_requests set status='failed',finished_at=now() where id=job.id and status='pending' returning * into job;
    end if;
    return to_jsonb(job)||jsonb_build_object('fresh',false);
  end if;
  if p_kind='chat' then
    if not exists(select 1 from public.ohmi_conversations where id=p_target and user_id=p_user_id) then raise exception 'Conversation unavailable'; end if;
    tokens:=64000;
  elsif p_kind='analyze' then
    if not exists(select 1 from public.ohmi_assignments where id=p_target and user_id=p_user_id and status='ready') then raise exception 'Assignment unavailable'; end if;
    tokens:=160000;
  else raise exception 'Invalid AI action'; end if;
  update public.ohmi_ai_requests set status='failed',finished_at=now() where user_id=p_user_id and status='pending' and created_at<now()-interval '2 minutes';
  if exists(select 1 from public.ohmi_ai_requests where user_id=p_user_id and status='pending') then raise exception 'An AI request is still running. Retry shortly'; end if;
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at>=now()-interval '1 minute')>=6 then raise exception 'Minute limit reached. Retry in a minute'; end if;
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at>=day_start)>=30 then raise exception 'Daily user AI limit reached'; end if;
  if (select count(*) from public.ohmi_ai_requests where created_at>=day_start)>=100 or (select coalesce(sum(case when status='completed' then coalesce(accounted_tokens,input_tokens+output_tokens) else reserved_tokens end),0) from public.ohmi_ai_requests where created_at>=day_start)+tokens>500000 then raise exception 'Project daily AI budget reached'; end if;
  insert into public.ohmi_ai_requests(id,user_id,kind,input_hash,conversation_id,assignment_id,language,reserved_tokens)
  values(p_request_id,p_user_id,p_kind,p_hash,case when p_kind='chat' then p_target end,case when p_kind='analyze' then p_target end,p_language,tokens) returning * into job;
  return to_jsonb(job)||jsonb_build_object('fresh',true);
end $$;


drop function public.ohmi_complete_ai(uuid,jsonb,integer,integer);
create function public.ohmi_complete_ai(p_request_id uuid,p_output jsonb,p_input_tokens integer,p_output_tokens integer,p_model text default 'gemini-3.8-flash',p_accounted_tokens integer default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.ohmi_ai_requests; next_position integer; result uuid; begin
  select * into job from public.ohmi_ai_requests where id=p_request_id for update;
  if not found or job.status<>'pending' or p_input_tokens is null or p_output_tokens is null or p_input_tokens<0 or p_output_tokens<0 then raise exception 'AI request is no longer pending'; end if;
  if p_model not in ('gemini-3.8-flash','gemini-3.6-flash','qwen/qwen3.8-27b') or coalesce(p_accounted_tokens,p_input_tokens+p_output_tokens)<p_input_tokens+p_output_tokens or coalesce(p_accounted_tokens,p_input_tokens+p_output_tokens)>job.reserved_tokens then raise exception 'Invalid AI accounting'; end if;
  job.model:=p_model;
  if job.kind='chat' then
    select coalesce(max(position),0)+1 into next_position from public.ohmi_messages where conversation_id=job.conversation_id;
    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id) values(job.user_id,job.conversation_id,'user',p_output->>'message',next_position,job.id);
    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id) values(job.user_id,job.conversation_id,'assistant',p_output->>'answer',next_position+1,job.id) returning id into result;
    update public.ohmi_conversations set title=case when next_position=1 then left(p_output->>'message',100) else title end,updated_at=now() where id=job.conversation_id and user_id=job.user_id;
  else
    insert into public.ohmi_analyses(user_id,assignment_id,language,payload,model) values(job.user_id,job.assignment_id,job.language,p_output,job.model)
    on conflict(assignment_id,language) do nothing returning id into result;
    if result is null then select id into result from public.ohmi_analyses where assignment_id=job.assignment_id and language=job.language and user_id=job.user_id; end if;
  end if;
  update public.ohmi_ai_requests set status='completed',model=p_model,accounted_tokens=coalesce(p_accounted_tokens,p_input_tokens+p_output_tokens),result_id=result,input_tokens=p_input_tokens,output_tokens=p_output_tokens,finished_at=now() where id=job.id;
  return jsonb_build_object('id',result);
end $$;

revoke execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text),public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text),public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
