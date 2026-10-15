begin;
-- Reserve for at most two generation attempts after an explicit HTTP 503.
create or replace function public.ohmi_reserve_ai(p_user_id uuid,p_request_id uuid,p_kind text,p_target uuid,p_hash text,p_language text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.ohmi_ai_requests; day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'; tokens integer; begin
  perform pg_advisory_xact_lock(9134104);
  select * into job from public.ohmi_ai_requests where id=p_request_id;
  if found then
    if job.user_id<>p_user_id or job.input_hash<>p_hash then raise exception 'Request replay does not match'; end if;
    return to_jsonb(job)||jsonb_build_object('fresh',false);
  end if;
  if p_kind='chat' then
    if not exists(select 1 from public.ohmi_conversations where id=p_target and user_id=p_user_id) then raise exception 'Conversation unavailable'; end if;
    tokens:=32000;
  elsif p_kind='analyze' then
    if not exists(select 1 from public.ohmi_assignments where id=p_target and user_id=p_user_id and status='ready') then raise exception 'Assignment unavailable'; end if;
    tokens:=80000;
  else raise exception 'Invalid AI action'; end if;
  update public.ohmi_ai_requests set status='failed',finished_at=now() where user_id=p_user_id and status='pending' and created_at<now()-interval '2 minutes';
  if exists(select 1 from public.ohmi_ai_requests where user_id=p_user_id and status='pending') then raise exception 'An AI request is still running. Retry shortly'; end if;
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at>=now()-interval '1 minute')>=6 then raise exception 'Minute limit reached. Retry in a minute'; end if;
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at>=day_start)>=30 then raise exception 'Daily user AI limit reached'; end if;
  if (select count(*) from public.ohmi_ai_requests where created_at>=day_start)>=100 or (select coalesce(sum(case when status='completed' then input_tokens+output_tokens else reserved_tokens end),0) from public.ohmi_ai_requests where created_at>=day_start)+tokens>500000 then raise exception 'Project daily AI budget reached'; end if;
  insert into public.ohmi_ai_requests(id,user_id,kind,input_hash,conversation_id,assignment_id,language,reserved_tokens)
  values(p_request_id,p_user_id,p_kind,p_hash,case when p_kind='chat' then p_target end,case when p_kind='analyze' then p_target end,p_language,tokens) returning * into job;
  return to_jsonb(job)||jsonb_build_object('fresh',true);
end $$;

revoke execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
