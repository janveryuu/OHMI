-- 20261016140000_ohmi_phase4_reconcile_replay_and_artifacts.sql
-- M0 Prerequisite: Reconcile AI replay order during provider cooldown, and preserve complete structured payloads

begin;

-- 1. Reconcile ohmi_reserve_ai so replay check precedes cooldown check
create or replace function public.ohmi_reserve_ai(
  p_user_id uuid,
  p_request_id uuid,
  p_kind text,
  p_target uuid,
  p_hash text,
  p_language text,
  p_model text default 'gemini-3.5-flash-lite',
  p_estimated_tokens integer default null,
  p_conversation_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  job public.ohmi_ai_requests;
  tokens integer;
begin
  perform pg_advisory_xact_lock(9134104);

  -- 1. Replay check (must run before cooldown check so existing completed/in-flight requests replay without invoking provider)
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

  -- 2. Provider cooldown check (only gates fresh attempts that would invoke the model)
  if exists(select 1 from public.ohmi_ai_provider_backoffs where model=p_model and blocked_until > now()) then
    raise exception 'Provider cooldown active';
  end if;

  -- 3. Conversation optional target validation
  if p_conversation_id is not null and not exists(select 1 from public.ohmi_conversations where id=p_conversation_id and user_id=p_user_id) then
    raise exception 'Conversation unavailable';
  end if;

  -- 4. Target validation
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

  -- 5. Expire abandoned pending reservations (> 60 seconds lease)
  update public.ohmi_ai_requests set status='failed', finished_at=now(), error_code='timeout'
  where status='pending' and created_at < now() - interval '60 seconds';

  -- 6. Enforce one in-flight request globally across the project
  if exists(select 1 from public.ohmi_ai_requests where status='pending') then
    raise exception 'An AI request is currently in progress. Please wait';
  end if;

  -- 7. Per-user and global rate limits
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at >= now() - interval '1 minute') >= 6 then
    raise exception 'Minute limit reached. Retry in a minute';
  end if;
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at >= now() - interval '24 hours') >= 10 then
    raise exception 'Daily user AI limit reached';
  end if;
  if (select count(*) from public.ohmi_ai_requests where created_at >= now() - interval '24 hours') >= 40 then
    raise exception 'Daily project AI limit reached';
  end if;

  -- 8. Insert pending reservation mapping kind to allowed check values and recording operation
  insert into public.ohmi_ai_requests(
    id, user_id, kind, operation, input_hash, conversation_id, assignment_id, language, model, reserved_tokens, status
  ) values (
    p_request_id, p_user_id,
    case when p_kind in ('chat') then 'chat' else 'analyze' end,
    p_kind,
    p_hash,
    case when p_kind='chat' then coalesce(p_conversation_id, p_target) else p_conversation_id end,
    case when p_kind in ('analyze','image','pdf','tutorial') then p_target else null end,
    p_language, p_model, tokens, 'pending'
  ) returning * into job;

  return to_jsonb(job) || jsonb_build_object('fresh', true);
end $$;

revoke execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer,uuid) to service_role;

-- 2. Reconcile ohmi_complete_ai to preserve full structured payload for analyses and tutorials
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
  is_tutorial boolean := false;
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
  is_tutorial := (p_output ? 'steps' and jsonb_array_length(p_output->'steps') > 0);

  -- 1. Conversation message persistence
  if job.conversation_id is not null then
    select coalesce(max(position),0)+1 into next_position from public.ohmi_messages where conversation_id=job.conversation_id;
    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id)
      values(job.user_id,job.conversation_id,'user',coalesce(p_output->>'message', 'Question'),next_position,job.id);
    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id,structured_result)
      values(job.user_id,job.conversation_id,'assistant',coalesce(p_output->>'answer', 'Response completed.'),next_position+1,job.id,p_output)
      returning id into result;
    update public.ohmi_conversations set
      title=case when next_position=1 then left(coalesce(p_output->>'message', 'Question'),100) else title end,
      updated_at=now()
    where id=job.conversation_id and user_id=job.user_id;
  end if;

  -- 2. Analysis / Tutorial artifact persistence (preserve complete p_output)
  if job.assignment_id is not null or is_tutorial then
    insert into public.ohmi_analyses(
      user_id,
      assignment_id,
      language,
      payload,
      model,
      schema_version,
      artifact_kind,
      provider,
      source_hash,
      prompt_version,
      fingerprint,
      title
    ) values (
      job.user_id,
      job.assignment_id,
      job.language,
      p_output,
      job.model,
      1,
      case when is_tutorial then 'tutorial' else 'analysis' end,
      'gemini',
      p_output->>'source_hash',
      1,
      job.input_hash,
      coalesce(p_output->>'title', case when is_tutorial then 'Circuit Tutorial' else 'Circuit Analysis' end)
    )
    on conflict(user_id, fingerprint) where fingerprint is not null do update
      set payload=excluded.payload, updated_at=now()
    returning id into result;

    if result is null then
      select id into result from public.ohmi_analyses where user_id=job.user_id and fingerprint=job.input_hash;
    end if;

    -- If this request was associated with a conversation, link the analysis to the conversation
    if job.conversation_id is not null and result is not null then
      update public.ohmi_conversations set analysis_id=result, updated_at=now()
      where id=job.conversation_id and user_id=job.user_id and analysis_id is null;
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

revoke execute on function public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) to service_role;

commit;
