-- 20261015222000_ohmi_phase4_conversation_link.sql
-- Forward migration: Add optional p_conversation_id to ohmi_reserve_ai to link tutorial/analysis requests to conversations

begin;

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

  -- Conversation optional target validation
  if p_conversation_id is not null and not exists(select 1 from public.ohmi_conversations where id=p_conversation_id and user_id=p_user_id) then
    raise exception 'Conversation unavailable';
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

  -- Insert pending reservation
  insert into public.ohmi_ai_requests(
    id, user_id, kind, input_hash, conversation_id, assignment_id, language, model, status, reserved_tokens
  ) values (
    p_request_id, p_user_id, p_kind, p_hash,
    case when p_kind='chat' then coalesce(p_conversation_id, p_target) else p_conversation_id end,
    case when p_kind in ('analyze','image','pdf','tutorial') then p_target else null end,
    p_language, p_model, 'pending', tokens
  ) returning * into job;

  return to_jsonb(job) || jsonb_build_object('fresh', true);
end $$;

revoke execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text,text,integer,uuid) to service_role;

commit;
