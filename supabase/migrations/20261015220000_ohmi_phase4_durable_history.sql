-- 20261015220000_ohmi_phase4_durable_history.sql
-- Milestone 7: Durable artifact, history, and tutorial progress persistence

begin;

-- 1. Evolve public.ohmi_analyses to support versioned artifacts, standalone tutorials, and idempotent fingerprinting
alter table public.ohmi_analyses alter column assignment_id drop not null;
alter table public.ohmi_analyses drop constraint if exists ohmi_analyses_assignment_id_language_key;

alter table public.ohmi_analyses
  add column if not exists schema_version integer not null default 1,
  add column if not exists artifact_kind text not null default 'analysis',
  add column if not exists provider text not null default 'gemini',
  add column if not exists source_hash text,
  add column if not exists prompt_version integer not null default 1,
  add column if not exists fingerprint text,
  add column if not exists title text;

alter table public.ohmi_analyses drop constraint if exists ohmi_analyses_kind_check;
alter table public.ohmi_analyses add constraint ohmi_analyses_kind_check check (artifact_kind in ('analysis', 'tutorial'));

alter table public.ohmi_analyses drop constraint if exists ohmi_analyses_assignment_required;
alter table public.ohmi_analyses add constraint ohmi_analyses_assignment_required check (artifact_kind <> 'analysis' or assignment_id is not null);

create unique index if not exists ohmi_analyses_owner_fingerprint on public.ohmi_analyses(user_id, fingerprint) where fingerprint is not null;
create index if not exists ohmi_analyses_lookup on public.ohmi_analyses(user_id, assignment_id, artifact_kind);

-- 2. Add structured_result column to ohmi_messages for rich assistant result restoration
alter table public.ohmi_messages add column if not exists structured_result jsonb;

-- 3. Reconcile ohmi_complete_ai for durable versioned persistence of conversations, analyses, and tutorials
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
  payload_steps jsonb;
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
  payload_steps := case when p_output ? 'steps' then p_output->'steps' else '[]'::jsonb end;

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

  -- 2. Analysis / Tutorial artifact persistence
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
      case when p_output ? 'steps' then p_output else jsonb_build_object('steps', '[]'::jsonb, 'answer', p_output->>'answer') end,
      job.model,
      1,
      case when is_tutorial then 'tutorial' else 'analysis' end,
      'gemini',
      p_output->>'source_hash',
      1,
      job.input_hash,
      coalesce(p_output->>'title', case when is_tutorial then 'Circuit Tutorial' else 'Circuit Analysis' end)
    )
    on conflict(user_id, fingerprint) where fingerprint is not null do nothing
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
