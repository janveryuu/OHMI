-- Additive Playground storage. Existing student tables and policies are unchanged.
create table public.ohmi_playground_projects (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 80),
 project jsonb not null check (jsonb_typeof(project) = 'object' and project->>'version' = '1' and octet_length(project::text) <= 65536),
 revision integer not null default 1 check (revision > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index ohmi_playground_owner_updated on public.ohmi_playground_projects(user_id, updated_at desc, id);
alter table public.ohmi_playground_projects enable row level security;
revoke all on public.ohmi_playground_projects from public, anon, authenticated;
grant select, insert, update, delete on public.ohmi_playground_projects to authenticated;
create policy playground_select on public.ohmi_playground_projects for select to authenticated using ((select auth.uid()) = user_id);
create policy playground_insert on public.ohmi_playground_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy playground_update on public.ohmi_playground_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy playground_delete on public.ohmi_playground_projects for delete to authenticated using ((select auth.uid()) = user_id);
