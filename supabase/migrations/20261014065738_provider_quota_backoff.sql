begin;
create table public.ohmi_ai_provider_backoffs (
  model text primary key check(model in ('gemini-3.8-flash','gemini-3.6-flash','qwen/qwen3.8-27b')),
  blocked_until timestamptz not null
);
alter table public.ohmi_ai_provider_backoffs enable row level security;
revoke all on public.ohmi_ai_provider_backoffs from public,anon,authenticated;
grant select,insert,update on public.ohmi_ai_provider_backoffs to service_role;

create function public.ohmi_defer_ai_provider(p_model text,p_retry_after integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_model is null or p_model not in ('gemini-3.8-flash','gemini-3.6-flash','qwen/qwen3.8-27b') or p_retry_after is null or p_retry_after<1 or p_retry_after>172800 then
    raise exception 'Invalid provider backoff';
  end if;
  insert into public.ohmi_ai_provider_backoffs(model,blocked_until)
  values(p_model,now()+make_interval(secs=>p_retry_after))
  on conflict(model) do update set blocked_until=greatest(ohmi_ai_provider_backoffs.blocked_until,excluded.blocked_until);
end $$;
revoke execute on function public.ohmi_defer_ai_provider(text,integer) from public,anon,authenticated;
grant execute on function public.ohmi_defer_ai_provider(text,integer) to service_role;
notify pgrst,'reload schema';
commit;
