begin;

create table public.ohmi_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  language text not null default 'english' check (language in ('english', 'filipino', 'taglish')),
  created_at timestamptz not null default now()
);

create table public.ohmi_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_name text not null check (char_length(original_name) between 1 and 180),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (object_path = user_id::text || '/' || id::text || '/assignment.' ||
    case mime_type when 'application/pdf' then 'pdf' when 'image/png' then 'png' else 'jpg' end)
);
create index ohmi_assignments_user_created_idx on public.ohmi_assignments (user_id, created_at desc);

create table public.ohmi_assignment_steps (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 500),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, user_id) references public.ohmi_assignments(id, user_id) on delete cascade
);
create index ohmi_steps_user_idx on public.ohmi_assignment_steps (user_id);
create index ohmi_steps_assignment_created_idx on public.ohmi_assignment_steps (assignment_id, created_at);

alter table public.ohmi_profiles enable row level security;
alter table public.ohmi_assignments enable row level security;
alter table public.ohmi_assignment_steps enable row level security;

revoke all on public.ohmi_profiles, public.ohmi_assignments, public.ohmi_assignment_steps from anon, authenticated;
grant select, insert on public.ohmi_profiles to authenticated;
grant update (display_name, language) on public.ohmi_profiles to authenticated;
grant select, insert, delete on public.ohmi_assignments, public.ohmi_assignment_steps to authenticated;
grant update (status) on public.ohmi_assignments to authenticated;
grant update (completed) on public.ohmi_assignment_steps to authenticated;
grant all on public.ohmi_profiles, public.ohmi_assignments, public.ohmi_assignment_steps to service_role;

create policy ohmi_profiles_select on public.ohmi_profiles for select to authenticated using ((select auth.uid()) = id);
create policy ohmi_profiles_insert on public.ohmi_profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy ohmi_profiles_update on public.ohmi_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy ohmi_assignments_select on public.ohmi_assignments for select to authenticated using ((select auth.uid()) = user_id);
create policy ohmi_assignments_insert on public.ohmi_assignments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ohmi_assignments_update on public.ohmi_assignments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ohmi_assignments_delete on public.ohmi_assignments for delete to authenticated using ((select auth.uid()) = user_id);

create policy ohmi_steps_select on public.ohmi_assignment_steps for select to authenticated using ((select auth.uid()) = user_id);
create policy ohmi_steps_insert on public.ohmi_assignment_steps for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ohmi_steps_update on public.ohmi_assignment_steps for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ohmi_steps_delete on public.ohmi_assignment_steps for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ohmi-assignments', 'ohmi-assignments', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
do $$
begin
  if exists (select 1 from storage.buckets where id = 'ohmi-assignments' and
    (public or file_size_limit is distinct from 10485760 or allowed_mime_types is distinct from array['application/pdf', 'image/png', 'image/jpeg'])) then
    raise exception 'Existing OHMI bucket configuration differs; inspect it before applying this migration';
  end if;
end $$;

create policy ohmi_files_select on storage.objects for select to authenticated
using (bucket_id = 'ohmi-assignments' and exists (
  select 1 from public.ohmi_assignments a where a.object_path = name and a.user_id = (select auth.uid())
));
create policy ohmi_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'ohmi-assignments' and exists (
  select 1 from public.ohmi_assignments a where a.object_path = name and a.user_id = (select auth.uid()) and a.status = 'pending'
));
create policy ohmi_files_delete on storage.objects for delete to authenticated
using (bucket_id = 'ohmi-assignments' and exists (
  select 1 from public.ohmi_assignments a where a.object_path = name and a.user_id = (select auth.uid())
));

commit;
notify pgrst, 'reload schema';
