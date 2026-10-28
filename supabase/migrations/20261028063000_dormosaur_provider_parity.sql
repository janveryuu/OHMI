-- Owner-approved removal of application consumption quotas; historical usage stays intact.
begin;

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
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 9134104));

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

  if p_model is null or p_model !~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$' or p_model like '%..%' then raise exception 'Invalid provider model'; end if;

  -- 2. Deny retired Qwen provider on fresh requests
  if p_model = 'qwen/qwen3.8-27b' or p_model like 'qwen%' then
    raise exception 'Qwen provider retired. Use approved Groq or Gemini models';
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
  elsif p_kind in ('analyze', 'image', 'pdf', 'tutorial') then
    if p_target is null or not exists(select 1 from public.ohmi_assignments where id=p_target and user_id=p_user_id and status='ready') then
      raise exception 'Assignment unavailable';
    end if;
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
  else
    raise exception 'Invalid AI action';
  end if;

  -- Compatibility field only; no token admission or cross-request quota.
  tokens := 1;

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
  if p_model is null or p_model !~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$' or p_model like '%..%' or coalesce(p_accounted_tokens, p_input_tokens+p_output_tokens) < p_input_tokens+p_output_tokens then
    raise exception 'Invalid AI accounting';
  end if;

  if job.created_at < now() - interval '60 seconds' then raise exception 'AI request lease expired'; end if;

  if (p_model is distinct from job.model and (job.operation <> 'chat' or coalesce(p_output->>'mode','') not in ('ai','local','limited'))) or jsonb_typeof(p_output) <> 'object'
     or octet_length(p_output::text) > 262144 then
    raise exception 'Invalid AI result or provenance';
  end if;

  if p_model = 'ohmi-local' and (job.operation <> 'chat' or coalesce(p_output->>'mode','') not in ('local','limited')) then raise exception 'Invalid local result'; end if;
  job.model := p_model;
  v_provider := case
    when p_model in ('openai/gpt-oss-120b', 'openai/gpt-oss-20b') then 'groq'
    when p_model = 'ohmi-local' then 'local'
    else coalesce(p_output->>'provider', 'gemini')
  end;

  is_circuit_check := (job.operation = 'circuit_check' or coalesce(p_output->>'schemaVersion', '1') = '2');
  is_tutorial := (not is_circuit_check and p_output ? 'steps' and jsonb_array_length(p_output->'steps') > 0);

  -- 1. Conversation message persistence
  if job.conversation_id is not null then
    -- Parallel requests allocate distinct message positions under the conversation lock.
    perform 1 from public.ohmi_conversations where id=job.conversation_id and user_id=job.user_id for update;
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
    result_payload=p_output,
    input_tokens=p_input_tokens,
    output_tokens=p_output_tokens,
    finished_at=now()
  where id=job.id;

  return jsonb_build_object('id', result);
end $$;

revoke execute on function public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_complete_ai(uuid,jsonb,integer,integer,text,integer) to service_role;



commit;
