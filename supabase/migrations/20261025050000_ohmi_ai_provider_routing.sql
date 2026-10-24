-- 20261025050000_ohmi_ai_provider_routing.sql
-- Milestone M4: Groq & Gemini 3.8-Flash provider limits, atomic quotas, accounting, and provenance

begin;

-- 1. Create service-role-only provider limits table
create table if not exists public.ohmi_ai_provider_limits (
  provider text not null,
  model text not null,
  enabled boolean not null default true,
  verified_at timestamptz not null default now(),
  rpm integer not null,
  rpd integer not null,
  tpm integer not null,
  tpd integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ohmi_ai_provider_limits_pkey primary key (provider, model),
  constraint ohmi_ai_provider_limits_provider_check check (provider in ('groq', 'gemini')),
  constraint ohmi_ai_provider_limits_rpm_check check (rpm > 0 and rpm <= 10000),
  constraint ohmi_ai_provider_limits_rpd_check check (rpd > 0 and rpd <= 1000000),
  constraint ohmi_ai_provider_limits_tpm_check check (tpm > 0 and tpm <= 10000000),
  constraint ohmi_ai_provider_limits_tpd_check check (tpd is null or (tpd > 0 and tpd <= 100000000))
);

-- Enable RLS and lock down permissions: service_role only, no public/anon/authenticated access
alter table public.ohmi_ai_provider_limits enable row level security;
revoke all on public.ohmi_ai_provider_limits from public, anon, authenticated;
grant all on public.ohmi_ai_provider_limits to service_role;

-- Seed approved production & evaluation quota baselines (80% conservative account ceilings)
insert into public.ohmi_ai_provider_limits (provider, model, enabled, verified_at, rpm, rpd, tpm, tpd)
values
  -- GroqCloud production model: openai/gpt-oss-120b
  ('groq', 'openai/gpt-oss-120b', true, now(), 24, 800, 6400, 160000),
  -- GroqCloud comparator: openai/gpt-oss-20b (evaluation only, fresh admission disabled by default)
  ('groq', 'openai/gpt-oss-20b', false, now(), 24, 800, 6400, 160000),
  -- Google Gemini production model: gemini-3.8-flash
  ('gemini', 'gemini-3.8-flash', true, now(), 12, 1200, 32000, null),
  -- Backward-compatibility rows during staged deployment
  ('gemini', 'gemini-3.5-flash-lite', true, now(), 12, 1200, 32000, null),
  ('gemini', 'gemini-3.6-flash', true, now(), 12, 1200, 32000, null)
on conflict (provider, model) do update set
  enabled = excluded.enabled,
  rpm = excluded.rpm,
  rpd = excluded.rpd,
  tpm = excluded.tpm,
  tpd = excluded.tpd,
  updated_at = now();

-- 2. Extend ohmi_ai_provider_backoffs constraint to include Groq models & Gemini 3.8-Flash
alter table public.ohmi_ai_provider_backoffs drop constraint if exists ohmi_ai_provider_backoffs_model_check;
alter table public.ohmi_ai_provider_backoffs add constraint ohmi_ai_provider_backoffs_model_check
  check(model in (
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ));

-- 3. Update ohmi_defer_ai_provider helper
create or replace function public.ohmi_defer_ai_provider(p_model text, p_retry_after integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_model is null or p_model not in (
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ) or p_retry_after is null or p_retry_after < 1 or p_retry_after > 172800 then
    raise exception 'Invalid provider backoff';
  end if;
  insert into public.ohmi_ai_provider_backoffs(model, blocked_until)
  values(p_model, now() + make_interval(secs=>p_retry_after))
  on conflict(model) do update set blocked_until = greatest(ohmi_ai_provider_backoffs.blocked_until, excluded.blocked_until);
end $$;

revoke execute on function public.ohmi_defer_ai_provider(text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_defer_ai_provider(text,integer) to service_role;

-- 4. Update ohmi_reserve_ai to enforce provider limits, deny retired Qwen, and account per-model RPM/RPD
create or replace function public.ohmi_reserve_ai(
  p_user_id uuid,
  p_request_id uuid,
  p_kind text,
  p_target uuid,
  p_hash text,
  p_language text,
  p_model text default 'openai/gpt-oss-120b',
  p_estimated_tokens integer default null,
  p_conversation_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  job public.ohmi_ai_requests;
  tokens integer;
  limit_row public.ohmi_ai_provider_limits;
  minute_model_count integer;
  daily_model_count integer;
begin
  perform pg_advisory_xact_lock(9134104);

  -- 1. Replay check (must run first so existing completed/in-flight requests replay without calling provider)
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

  -- 2. Deny retired Qwen provider on fresh requests
  if p_model = 'qwen/qwen3.8-27b' or p_model like 'qwen%' then
    raise exception 'Qwen provider retired. Use approved Groq or Gemini models';
  end if;

  -- 3. Provider admission & limits check
  select * into limit_row from public.ohmi_ai_provider_limits where model = p_model;
  if found then
    if not limit_row.enabled then
      raise exception 'Provider model % is disabled', p_model;
    end if;

    -- Model RPM check
    select count(*) into minute_model_count from public.ohmi_ai_requests
    where model = p_model and created_at >= now() - interval '1 minute';
    if minute_model_count >= limit_row.rpm then
      raise exception 'Provider minute rate limit reached for %', p_model;
    end if;

    -- Model RPD check
    select count(*) into daily_model_count from public.ohmi_ai_requests
    where model = p_model and created_at >= now() - interval '24 hours';
    if daily_model_count >= limit_row.rpd then
      raise exception 'Provider daily rate limit reached for %', p_model;
    end if;
  end if;

  -- 4. Provider cooldown check (only gates fresh attempts that would invoke the model)
  if exists(select 1 from public.ohmi_ai_provider_backoffs where model=p_model and blocked_until > now()) then
    raise exception 'Provider cooldown active';
  end if;

  -- 5. Conversation optional target validation
  if p_conversation_id is not null and not exists(select 1 from public.ohmi_conversations where id=p_conversation_id and user_id=p_user_id) then
    raise exception 'Conversation unavailable';
  end if;

  -- 6. Target validation
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
  elsif p_kind = 'circuit_check' then
    if p_target is not null then
      if exists(select 1 from public.ohmi_assignments where id=p_target) then
        if not exists(select 1 from public.ohmi_assignments where id=p_target and user_id=p_user_id and status='ready') then
          raise exception 'Assignment unavailable';
        end if;
      elsif exists(select 1 from public.ohmi_analyses where id=p_target) then
        if not exists(select 1 from public.ohmi_analyses where id=p_target and user_id=p_user_id and artifact_kind='circuit_check') then
          raise exception 'Prior circuit check unavailable';
        end if;
      elsif exists(select 1 from public.ohmi_conversations where id=p_target) then
        if not exists(select 1 from public.ohmi_conversations where id=p_target and user_id=p_user_id) then
          raise exception 'Conversation unavailable';
        end if;
      else
        raise exception 'Target unavailable';
      end if;
    end if;
    tokens := coalesce(p_estimated_tokens, 4096);
  else
    raise exception 'Invalid AI action';
  end if;

  if tokens < 1 or tokens > 64000 then
    raise exception 'Invalid per-request token estimate';
  end if;

  -- 7. Expire abandoned pending reservations (> 60 seconds lease)
  update public.ohmi_ai_requests set status='failed', finished_at=now(), error_code='timeout'
  where status='pending' and created_at < now() - interval '60 seconds';

  -- 8. Enforce one in-flight request globally across the project
  if exists(select 1 from public.ohmi_ai_requests where status='pending') then
    raise exception 'An AI request is currently in progress. Please wait';
  end if;

  -- 9. Per-user and global rate limits
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at >= now() - interval '1 minute') >= 6 then
    raise exception 'Minute limit reached. Retry in a minute';
  end if;
  if (select count(*) from public.ohmi_ai_requests where user_id=p_user_id and created_at >= now() - interval '24 hours') >= 10 then
    raise exception 'Daily user AI limit reached';
  end if;
  if (select count(*) from public.ohmi_ai_requests where created_at >= now() - interval '24 hours') >= 40 then
    raise exception 'Daily project AI limit reached';
  end if;

  -- 10. Insert pending reservation
  insert into public.ohmi_ai_requests(
    id, user_id, kind, operation, input_hash, conversation_id, assignment_id, language, model, reserved_tokens, status
  ) values (
    p_request_id, p_user_id,
    case when p_kind in ('chat') then 'chat' when p_kind in ('circuit_check') then 'circuit_check' else 'analyze' end,
    p_kind,
    p_hash,
    case when p_kind='chat' then coalesce(p_conversation_id, p_target) else p_conversation_id end,
    case
      when p_kind in ('analyze','image','pdf','tutorial') then p_target
      when p_kind = 'circuit_check' and exists(select 1 from public.ohmi_assignments where id=p_target and user_id=p_user_id) then p_target
      else null
    end,
    p_language, p_model, tokens, 'pending'
  ) returning * into job;

  return to_jsonb(job) || jsonb_build_object('fresh', true);
end $$;

revoke execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer,uuid) to service_role;

-- 5. Update ohmi_complete_ai with correct provider provenance and Groq/Gemini 3.8-Flash model validation
create or replace function public.ohmi_complete_ai(
  p_request_id uuid,
  p_output jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_model text default 'openai/gpt-oss-120b',
  p_accounted_tokens integer default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  job public.ohmi_ai_requests;
  next_position integer;
  result uuid := null;
  is_circuit_check boolean := false;
  is_tutorial boolean := false;
  v_artifact_kind text;
  v_schema_version integer;
  v_fingerprint text;
  v_title text;
  v_provider text;
  user_msg_content text;
  assistant_msg_content text;
begin
  select * into job from public.ohmi_ai_requests where id=p_request_id for update;
  if not found or job.status<>'pending' or p_input_tokens is null or p_output_tokens is null or p_input_tokens<0 or p_output_tokens<0 then
    raise exception 'AI request is no longer pending';
  end if;
  if p_model not in (
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ) or coalesce(p_accounted_tokens, p_input_tokens+p_output_tokens) < p_input_tokens+p_output_tokens
    or p_input_tokens+p_output_tokens > 100000 then
    raise exception 'Invalid AI accounting';
  end if;

  job.model := p_model;
  v_provider := case
    when p_model in ('openai/gpt-oss-120b', 'openai/gpt-oss-20b') then 'groq'
    else 'gemini'
  end;

  is_circuit_check := (job.operation = 'circuit_check' or coalesce(p_output->>'schemaVersion', '1') = '2');
  is_tutorial := (not is_circuit_check and p_output ? 'steps' and jsonb_array_length(p_output->'steps') > 0);

  -- 1. Conversation message persistence
  if job.conversation_id is not null then
    select coalesce(max(position),0)+1 into next_position from public.ohmi_messages where conversation_id=job.conversation_id;

    user_msg_content := case
      when is_circuit_check then
        case
          when p_output ? 'previousCheckId' and p_output->>'previousCheckId' is not null then 'Follow-up on circuit review requested'
          else 'Circuit review requested'
        end
      else coalesce(p_output->>'message', 'Question')
    end;

    assistant_msg_content := case
      when is_circuit_check then coalesce(p_output->>'summary', 'Circuit review completed.')
      else coalesce(p_output->>'answer', 'Response completed.')
    end;

    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id)
      values(job.user_id,job.conversation_id,'user',user_msg_content,next_position,job.id);
    insert into public.ohmi_messages(user_id,conversation_id,role,content,position,request_id,structured_result)
      values(job.user_id,job.conversation_id,'assistant',assistant_msg_content,next_position+1,job.id,p_output)
      returning id into result;
    update public.ohmi_conversations set
      title=case when next_position=1 then left(user_msg_content,100) else title end,
      updated_at=now()
    where id=job.conversation_id and user_id=job.user_id;
  end if;

  -- 2. Analysis / Tutorial / Circuit Check artifact persistence
  if is_circuit_check or job.assignment_id is not null or is_tutorial then
    v_artifact_kind := case
      when is_circuit_check then 'circuit_check'
      when is_tutorial then 'tutorial'
      else 'analysis'
    end;
    v_schema_version := case when is_circuit_check then 2 else 1 end;
    -- Per-request distinct fingerprint for circuit checks; legacy fingerprint for legacy requests
    v_fingerprint := case
      when is_circuit_check then encode(sha256((job.user_id::text || ':' || job.id::text || ':circuit_check')::bytea), 'hex')
      else job.input_hash
    end;
    v_title := coalesce(p_output->>'title', case
      when is_circuit_check then 'Circuit Check'
      when is_tutorial then 'Circuit Tutorial'
      else 'Circuit Analysis'
    end);

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
      v_schema_version,
      v_artifact_kind,
      v_provider,
      coalesce(p_output->>'source_hash', job.input_hash),
      case when is_circuit_check then 2 else 1 end,
      v_fingerprint,
      v_title
    )
    on conflict(user_id, fingerprint) where fingerprint is not null do update
      set payload=excluded.payload, updated_at=now()
    returning id into result;

    if result is null then
      select id into result from public.ohmi_analyses where user_id=job.user_id and fingerprint=v_fingerprint;
    end if;

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

-- 6. Update ohmi_fail_ai helper
create or replace function public.ohmi_fail_ai(
  p_request_id uuid,
  p_error_code text,
  p_error_message text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_model text default 'openai/gpt-oss-120b',
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

revoke execute on function public.ohmi_fail_ai(uuid,text,text,integer,integer,text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_fail_ai(uuid,text,text,integer,integer,text,integer) to service_role;

notify pgrst,'reload schema';
commit;
