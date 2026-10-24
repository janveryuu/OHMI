-- Existing ohmi_complete_ai updates this column when saving artifacts.
-- Preserve all rows, policies, grants and function contracts.
begin;
set local lock_timeout = '5s';
alter table public.ohmi_analyses
  add column if not exists updated_at timestamptz not null default now();
commit;
