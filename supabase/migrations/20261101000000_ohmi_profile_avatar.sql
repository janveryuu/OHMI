-- Additive avatar support for OHMI user profile mascot selections.
-- Preserves existing user profiles, display names, language preferences and RLS policies.
begin;
set local lock_timeout = '5s';

alter table public.ohmi_profiles
  add column if not exists avatar text not null default '' check (char_length(avatar) <= 60);

grant update (avatar) on public.ohmi_profiles to authenticated;

commit;
