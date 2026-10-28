-- M2 draft: apply only after separate approval for the hosted database.
-- Independent storage; legacy rows, schema and policies remain unchanged.
create table public.ohmi_electronics_projects (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 80 and char_length(btrim(name)) > 0),
 document jsonb not null check (coalesce(
   jsonb_typeof(document) = 'object' and document->>'format' = 'designElectronics'
   and document->>'version' = '1' and document ? 'title'
   and name = document->>'title' and jsonb_typeof(document->'parts') = 'array'
   and jsonb_array_length(document->'parts') <= 200
   and jsonb_typeof(document->'wires') = 'array' and jsonb_array_length(document->'wires') <= 800
   and octet_length(document::text) <= 1048576
 ,false)),
 engine_commit text not null check (engine_commit ~ '^[0-9a-f]{40}$'),
 revision integer not null default 1 check (revision > 0),
 source_legacy_id uuid,
 source_legacy_revision integer,
 legacy_snapshot jsonb,
 check (coalesce((source_legacy_id is null and source_legacy_revision is null and legacy_snapshot is null)
     or (source_legacy_id is not null and source_legacy_revision > 0
         and jsonb_typeof(legacy_snapshot) = 'object' and octet_length(legacy_snapshot::text) <= 65536),false)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index electronics_owner_updated on public.ohmi_electronics_projects(user_id, updated_at desc, id desc);
alter table public.ohmi_electronics_projects enable row level security;
revoke all on public.ohmi_electronics_projects from public, anon, authenticated;
grant select,insert,update,delete on public.ohmi_electronics_projects to authenticated;
create policy electronics_select on public.ohmi_electronics_projects for select to authenticated using ((select auth.uid()) = user_id);
create policy electronics_insert on public.ohmi_electronics_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy electronics_update on public.ohmi_electronics_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy electronics_delete on public.ohmi_electronics_projects for delete to authenticated using ((select auth.uid()) = user_id);

create function public.ohmi_electronics_revision_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_op = 'INSERT' then
   if new.revision <> 1 then raise exception 'New electronics projects must start at revision 1' using errcode='23514'; end if;
   if new.source_legacy_id is not null and not exists (
     select 1 from public.ohmi_playground_projects p where p.id=new.source_legacy_id and p.user_id=new.user_id
       and p.revision=new.source_legacy_revision and p.project=new.legacy_snapshot
   ) then raise exception 'Legacy source changed or is not owned by this account' using errcode='40001'; end if;
 else
   if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at
     or new.source_legacy_id is distinct from old.source_legacy_id
     or new.source_legacy_revision is distinct from old.source_legacy_revision
     or new.legacy_snapshot is distinct from old.legacy_snapshot then
       raise exception 'Electronics ownership and source provenance are immutable' using errcode='23514';
   end if;
   if new.revision <> old.revision + 1 then raise exception 'Stale electronics revision' using errcode='40001'; end if;
 end if;
 new.updated_at := pg_catalog.clock_timestamp();
 return new;
end $$;
revoke all on function public.ohmi_electronics_revision_guard() from public, anon, authenticated;
create trigger electronics_revision_guard before insert or update on public.ohmi_electronics_projects
for each row execute function public.ohmi_electronics_revision_guard();
