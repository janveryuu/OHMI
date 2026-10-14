begin;

create table public.ohmi_analyses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null, language text not null check (language in ('english','filipino','taglish')),
  payload jsonb not null check (jsonb_typeof(payload)='object' and jsonb_typeof(payload->'steps')='array' and jsonb_array_length(payload->'steps')<=24),
  model text not null, created_at timestamptz not null default now(), unique(id,user_id), unique(assignment_id,language),
  foreign key(assignment_id,user_id) references public.ohmi_assignments(id,user_id) on delete cascade
);
create table public.ohmi_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid, title text not null default 'New conversation' check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
  foreign key(analysis_id,user_id) references public.ohmi_analyses(id,user_id) on delete cascade
);
create table public.ohmi_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null, role text not null check(role in ('user','assistant')),
  content text not null check(char_length(content) between 1 and 18000), position integer not null check(position>0),
  request_id uuid not null, created_at timestamptz not null default now(), unique(conversation_id,position), unique(request_id,role),
  foreign key(conversation_id,user_id) references public.ohmi_conversations(id,user_id) on delete cascade
);
create table public.ohmi_tutorial_progress (
  analysis_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  current_step integer not null default 0 check(current_step between 0 and 23), completed integer[] not null default '{}',
  updated_at timestamptz not null default now(), check(cardinality(completed)<=24),
  foreign key(analysis_id,user_id) references public.ohmi_analyses(id,user_id) on delete cascade
);
create table public.ohmi_ai_requests (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('chat','analyze')), input_hash text not null check(input_hash ~ '^[a-f0-9]{64}$'),
  conversation_id uuid references public.ohmi_conversations(id) on delete set null,
  assignment_id uuid references public.ohmi_assignments(id) on delete set null,
  language text not null check(language in ('english','filipino','taglish')), model text not null default 'gemini-3.8-flash',
  status text not null default 'pending' check(status in ('pending','completed','failed')), result_id uuid,
  reserved_tokens integer not null check(reserved_tokens>0), input_tokens integer, output_tokens integer,
  created_at timestamptz not null default now(), finished_at timestamptz,
  check(input_tokens is null or input_tokens>=0), check(output_tokens is null or output_tokens>=0),
  check(input_tokens is null or output_tokens is null or input_tokens+output_tokens<=reserved_tokens)
);
create index ohmi_analyses_owner on public.ohmi_analyses(user_id,created_at desc);
create index ohmi_conversations_owner on public.ohmi_conversations(user_id,updated_at desc);
create index ohmi_conversations_analysis on public.ohmi_conversations(analysis_id);
create index ohmi_messages_owner on public.ohmi_messages(user_id,conversation_id,position);
create index ohmi_progress_owner on public.ohmi_tutorial_progress(user_id,updated_at desc);
create index ohmi_requests_owner on public.ohmi_ai_requests(user_id,created_at desc);
create index ohmi_requests_global on public.ohmi_ai_requests(created_at);
create index ohmi_requests_conversation on public.ohmi_ai_requests(conversation_id);
create index ohmi_requests_assignment on public.ohmi_ai_requests(assignment_id);

do $$ declare name text; begin
  foreach name in array array['ohmi_analyses','ohmi_conversations','ohmi_messages','ohmi_tutorial_progress','ohmi_ai_requests'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from anon, authenticated',name);
    execute format('grant select on public.%I to authenticated',name);
    execute format('grant all on public.%I to service_role',name);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',name);
  end loop;
end $$;
grant insert,delete on public.ohmi_conversations to authenticated;
create policy owner_create on public.ohmi_conversations for insert to authenticated with check((select auth.uid())=user_id);
create policy owner_delete on public.ohmi_conversations for delete to authenticated using((select auth.uid())=user_id);
grant insert,update on public.ohmi_tutorial_progress to authenticated;
create policy owner_create on public.ohmi_tutorial_progress for insert to authenticated with check((select auth.uid())=user_id);
create policy owner_update on public.ohmi_tutorial_progress for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create function public.ohmi_check_tutorial_progress() returns trigger
language plpgsql security invoker set search_path='' as $$
declare n integer; begin
  select jsonb_array_length(payload->'steps') into n from public.ohmi_analyses where id=new.analysis_id and user_id=new.user_id;
  if n is null or n=0 or new.current_step<0 or new.current_step>=n or cardinality(new.completed)>n or exists(select 1 from unnest(new.completed) as x where x is null or x<0 or x>=n) then raise exception 'Invalid tutorial progress'; end if;
  new.completed:=array(select distinct x from unnest(new.completed) as x order by x);
  return new;
end $$;
revoke execute on function public.ohmi_check_tutorial_progress() from public,anon,authenticated;
create trigger ohmi_progress_bounds before insert or update on public.ohmi_tutorial_progress for each row execute function public.ohmi_check_tutorial_progress();

create function public.ohmi_save_tutorial_progress(p_analysis_id uuid,p_current_step integer,p_completed integer[]) returns void
language plpgsql security invoker set search_path='' as $$
declare n integer; uid uuid := auth.uid(); begin
  select jsonb_array_length(payload->'steps') into n from public.ohmi_analyses where id=p_analysis_id and user_id=uid;
  if n is null or n=0 or p_current_step is null or p_current_step<0 or p_current_step>=n or p_completed is null or cardinality(p_completed)>n or exists(select 1 from unnest(p_completed) as x where x is null or x<0 or x>=n) then raise exception 'Invalid tutorial progress'; end if;
  insert into public.ohmi_tutorial_progress(analysis_id,user_id,current_step,completed) values(p_analysis_id,uid,p_current_step,array(select distinct x from unnest(p_completed) as x order by x))
  on conflict(analysis_id) do update set current_step=excluded.current_step,completed=excluded.completed,updated_at=now();
end $$;
revoke execute on function public.ohmi_save_tutorial_progress(uuid,integer,integer[]) from public,anon;
grant execute on function public.ohmi_save_tutorial_progress(uuid,integer,integer[]) to authenticated;

create function public.ohmi_reserve_ai(p_user_id uuid,p_request_id uuid,p_kind text,p_target uuid,p_hash text,p_language text) returns jsonb
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
    tokens:=16000;
  elsif p_kind='analyze' then
    if not exists(select 1 from public.ohmi_assignments where id=p_target and user_id=p_user_id and status='ready') then raise exception 'Assignment unavailable'; end if;
    tokens:=40000;
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

create function public.ohmi_complete_ai(p_request_id uuid,p_output jsonb,p_input_tokens integer,p_output_tokens integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.ohmi_ai_requests; next_position integer; result uuid; begin
  select * into job from public.ohmi_ai_requests where id=p_request_id for update;
  if not found or job.status<>'pending' or p_input_tokens is null or p_output_tokens is null or p_input_tokens<0 or p_output_tokens<0 then raise exception 'AI request is no longer pending'; end if;
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
  update public.ohmi_ai_requests set status='completed',result_id=result,input_tokens=p_input_tokens,output_tokens=p_output_tokens,finished_at=now() where id=job.id;
  return jsonb_build_object('id',result);
end $$;
revoke execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text), public.ohmi_complete_ai(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_ai(uuid,uuid,text,uuid,text,text), public.ohmi_complete_ai(uuid,jsonb,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
