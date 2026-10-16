-- 20261016170000_ohmi_phase5_circuit_check_artifacts.sql
-- Milestone 3: Persist exact checks, support circuit_check artifact kind and schema_version 2, owner delete, and request status recovery

begin;

-- 1. Evolve public.ohmi_analyses to support circuit_check artifacts and schema_version 2
alter table public.ohmi_analyses drop constraint if exists ohmi_analyses_kind_check;
alter table public.ohmi_analyses add constraint ohmi_analyses_kind_check
  check (artifact_kind in ('analysis', 'tutorial', 'circuit_check'));

alter table public.ohmi_analyses drop constraint if exists ohmi_analyses_schema_version_check;
alter table public.ohmi_analyses add constraint ohmi_analyses_schema_version_check
  check (schema_version in (1, 2));

alter table public.ohmi_analyses drop constraint if exists ohmi_analyses_assignment_required;
alter table public.ohmi_analyses add constraint ohmi_analyses_assignment_required
  check (artifact_kind <> 'analysis' or assignment_id is not null);

-- 2. Grant delete on ohmi_analyses to authenticated users and add owner-delete policy
grant delete on public.ohmi_analyses to authenticated;
drop policy if exists owner_delete on public.ohmi_analyses;
create policy owner_delete on public.ohmi_analyses for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Extend ohmi_ai_requests kind check constraint to include circuit_check
alter table public.ohmi_ai_requests drop constraint if exists ohmi_ai_requests_kind_check;
alter table public.ohmi_ai_requests add constraint ohmi_ai_requests_kind_check
  check (kind in ('chat', 'analyze', 'circuit_check'));

-- 4. Reconcile ohmi_reserve_ai for circuit_check operations
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

  -- 8. Insert pending reservation
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

-- 5. Reconcile ohmi_complete_ai for circuit_check artifacts and distinct per-request fingerprinting
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
  is_circuit_check boolean := false;
  is_tutorial boolean := false;
  v_artifact_kind text;
  v_schema_version integer;
  v_fingerprint text;
  v_title text;
  user_msg_content text;
  assistant_msg_content text;
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
      'gemini',
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
