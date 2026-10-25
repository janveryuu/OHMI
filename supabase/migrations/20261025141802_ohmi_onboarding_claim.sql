-- Capture the rollout boundary once, at backend activation, never at a browser's first visit.
create schema if not exists ohmi_private;
revoke all on schema ohmi_private from public, anon;
grant usage on schema ohmi_private to authenticated;

create table ohmi_private.onboarding_rollout (
  singleton boolean primary key default true check (singleton),
  starts_at timestamptz not null default clock_timestamp()
);
alter table ohmi_private.onboarding_rollout enable row level security;
revoke all on ohmi_private.onboarding_rollout from public, anon, authenticated;
insert into ohmi_private.onboarding_rollout default values;

alter table public.ohmi_profiles add column onboarding_invited_at timestamptz;

create function ohmi_private.claim_onboarding() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from auth.users u cross join ohmi_private.onboarding_rollout r
    where u.id = auth.uid() and u.created_at >= r.starts_at
      and not coalesce(u.is_anonymous, false)
  ) then return false; end if;

  insert into public.ohmi_profiles (id) values (auth.uid()) on conflict (id) do nothing;
  -- The conditional row update serializes claims from simultaneous tabs/devices.
  update public.ohmi_profiles set onboarding_invited_at = clock_timestamp()
    where id = auth.uid() and onboarding_invited_at is null;
  return found;
end;
$$;
revoke all on function ohmi_private.claim_onboarding() from public, anon;
grant execute on function ohmi_private.claim_onboarding() to authenticated;

create function public.ohmi_claim_onboarding() returns boolean
language sql security invoker set search_path = '' as $$
  select ohmi_private.claim_onboarding();
$$;
revoke all on function public.ohmi_claim_onboarding() from public, anon;
grant execute on function public.ohmi_claim_onboarding() to authenticated;
