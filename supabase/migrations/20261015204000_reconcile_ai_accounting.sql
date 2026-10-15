begin;

-- 1. Update provider cooldowns model check to include gemini-3.5-flash-lite
alter table public.ohmi_ai_provider_backoffs drop constraint if exists ohmi_ai_provider_backoffs_model_check;
alter table public.ohmi_ai_provider_backoffs add constraint ohmi_ai_provider_backoffs_model_check
  check(model in ('gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','qwen/qwen3.8-27b'));

create or replace function public.ohmi_defer_ai_provider(p_model text, p_retry_after integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_model is null or p_model not in ('gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','qwen/qwen3.8-27b')
     or p_retry_after is null or p_retry_after < 1 or p_retry_after > 172800 then
    raise exception 'Invalid provider backoff';
  end if;
  insert into public.ohmi_ai_provider_backoffs(model, blocked_until)
  values(p_model, now() + make_interval(secs=>p_retry_after))
  on conflict(model) do update set blocked_until = greatest(ohmi_ai_provider_backoffs.blocked_until, excluded.blocked_until);
end $$;

-- 2. Extend ohmi_ai_requests with nullable diagnostics and operation fields
alter table public.ohmi_ai_requests add column if not exists operation text;
alter table public.ohmi_ai_requests add column if not exists error_code text;
alter table public.ohmi_ai_requests add column if not exists error_message text;

-- 3. Replace ohmi_reserve_ai to support single-model Gemini 3.5 Flash-Lite, ephemeral chat, global in-flight limit and provider backoff
drop function if exists public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text);
drop function if exists public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,integer);
drop function if exists public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer);

create or replace function public.ohmi_reserve_ai(
  p_user_id uuid,
  p_request_id uuid,
  p_kind text,
  p_target uuid,
  p_hash text,
  p_language text,
  p_model text default 'gemini-3.5-flash-lite',
  p_estimated_tokens integer default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  job public.ohmi_ai_requests;
  tokens integer;
begin
  perform pg_advisory_xact_lock(9134104);

  -- Cooldown check
  if exists(select 1 from public.ohmi_ai_provider_backoffs where model=p_model and blocked_until > now()) then
    raise exception 'Provider cooldown active';
  end if;

  -- Replay check
  select * into job from public.ohmi_ai_requests where id=p_request_id for update;
  if found then
    if job.user_id is distinct from p_user_id or job.input_hash <> p_hash then
      raise exception 'Request replay does not match';
    end if;
    if job.status='pending' and job.created_at < now() - interval '60 seconds' then
      update public.ohmi_ai_requests set status='failed', finished_at=now(), error_code='timeout'
      where id=job.id and status='pending' returning * into job;
    end if;
    return to_jsonb(job) || jsonb_build_object('fresh', false);
  end if;

  -- Target validation
  if p_kind = 'chat' then
    if p_target is not null and not exists(select 1 from public.ohmi_conversations where id=p_target and user_id=p_user_id) then
      raise exception 'Conversation unavailable';
    end if;
    tokens := coalesce(p_estimated_tokens, 2048);
  elsif p_kind in ('analyze', 'image', 'pdf', 'tutorial') then
    if p_target is null or not exists(select 1 from public.ohmi_assignments where id=p_target and user_id=p_user_id and status='ready') then
      raise exception 'Assignment unavailable';
    end if;
    tokens := coalesce(p_estimated_tokens, 4096);
  else
    raise exception 'Invalid AI action';
  end if;

  if tokens < 1 or tokens > 64000 then
    raise exception 'Invalid per-request token estimate';
  end if;

  -- Expire abandoned pending reservations (> 60 seconds lease)
  update public.ohmi_ai_requests set status='failed', finished_at=now(), error_code='timeout'
  where status='pending' and created_at < now() - interval '60 seconds';

  -- Enforce one in-flight request globally across the project
  if exists(select 1 from public.ohmi_ai_requests where status='pending') then
    raise exception 'An AI request is currently in progress. Please wait';
  end if;

  -- Rate limits: max 6 per user/min, 10 per user/day, 40 per project/day
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at >= now() - interval '1 minute') >= 6 then
    raise exception 'Minute limit reached. Retry in a minute';
  end if;
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at >= now() - interval '24 hours') >= 10 then
    raise exception 'Daily user AI limit reached';
  end if;
  if (select count(*) from public.ohmi_ai_requests where created_at >= now() - interval '24 hours') >= 40 then
    raise exception 'Daily project AI limit reached';
  end if;

  insert into public.ohmi_ai_requests(
    id, user_id, kind, operation, input_hash, conversation_id, assignment_id, language, model, reserved_tokens, status
  ) values (
    p_request_id, p_user_id,
    case when p_kind in ('chat') then 'chat' else 'analyze' end,
    p_kind,
    p_hash,
    case when p_kind='chat' then p_target else null end,
    case when p_kind in ('analyze','image','pdf','tutorial') then p_target else null end,
    p_language, p_model, tokens, 'pending'
  ) returning * into job;

  return to_jsonb(job) || jsonb_build_object('fresh', true);
end $$;

-- 4. Reconcile ohmi_complete_ai for single model and ephemeral chat
drop function if exists public.ohmi_complete_ai(uuid,jsonb,integer,integer);
drop function if exists public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer);

create or replace function public.ohmi_complete_ai(
  p_request_id uuid,
  p_output jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_model text default 'gemini-3.5-flash-lite',
  p_accounted_tokens integer default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  job public.ohmi_ai_requests;
  next_position integer;
  result uuid := null;
begin
  select * into job from public.ohmi_ai_requests where id=p_request_id for update;
  if not found or job.status<>'pending' or p_input_tokens is null or p_output_tokens is null or p_input_tokens<0 or p_output_tokens<0 then
    raise exception 'AI request is no longer pending';
  end if;
  if p_model not in ('gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','qwen/qwen3.8-27b')
     or coalesce(p_accounted_tokens, p_input_tokens+p_output_tokens) < p_input_tokens+p_output_tokens
     or p_input_tokens+p_output_tokens > 100000 then
    raise exception 'Invalid AI accounting';
  end if;

  job.model := p_model;

  if job.conversation_id is not null then
    select coalesce(max(position),0)+1 into next_position from public.ohmi_messages where conversation_id=job.conversation_id;
    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id)
      values(job.user_id,job.conversation_id,'user',p_output->>'message',next_position,job.id);
    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id)
      values(job.user_id,job.conversation_id,'assistant',p_output->>'answer',next_position+1,job.id) returning id into result;
    update public.ohmi_conversations set title=case when next_position=1 then left(p_output->>'message',100) else title end, updated_at=now()
      where id=job.conversation_id and user_id=job.user_id;
  elsif job.assignment_id is not null and p_output ? 'steps' then
    insert into public.ohmi_analyses(user_id,assignment_id,language,payload,model)
      values(job.user_id,job.assignment_id,job.language,p_output,job.model)
      on conflict(assignment_id,language) do nothing returning id into result;
    if result is null then
      select id into result from public.ohmi_analyses where assignment_id=job.assignment_id and language=job.language and user_id=job.user_id;
    end if;
  end if;

  update public.ohmi_ai_requests set
    status='completed',
    model=p_model,
    accounted_tokens=coalesce(p_accounted_tokens, p_input_tokens+p_output_tokens),
    result_id=result,
    input_tokens=p_input_tokens,
    output_tokens=p_output_tokens,
    finished_at=now()
  where id=job.id;

  return jsonb_build_object('id', result);
end $$;

-- 5. Add ohmi_fail_ai helper
create or replace function public.ohmi_fail_ai(
  p_request_id uuid,
  p_error_code text,
  p_error_message text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_model text default 'gemini-3.5-flash-lite',
  p_accounted_tokens integer default null
) returns void
language plpgsql security invoker set search_path='' as $$
declare
  job public.ohmi_ai_requests;
begin
  select * into job from public.ohmi_ai_requests where id=p_request_id for update;
  if not found or job.status<>'pending' then
    return;
  end if;
  update public.ohmi_ai_requests set
    status='failed',
    model=coalesce(p_model, job.model),
    error_code=left(p_error_code, 50),
    error_message=left(p_error_message, 255),
    input_tokens=coalesce(p_input_tokens, job.input_tokens),
    output_tokens=coalesce(p_output_tokens, job.output_tokens),
    accounted_tokens=coalesce(p_accounted_tokens, case when p_input_tokens is not null and p_output_tokens is not null then p_input_tokens + p_output_tokens else job.reserved_tokens end),
    finished_at=now()
  where id=p_request_id;
end $$;

-- 6. Enforce security grants
revoke execute on function public.ohmi_defer_ai_provider(text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_defer_ai_provider(text,integer) to service_role;

revoke execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer) to service_role;

revoke execute on function public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) to service_role;

revoke execute on function public.ohmi_fail_ai(uuid,text,text,integer,integer,text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_fail_ai(uuid,text,text,integer,integer,text,integer) to service_role;

notify pgrst,'reload schema';
commit;
