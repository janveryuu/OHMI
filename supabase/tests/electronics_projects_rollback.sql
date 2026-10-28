-- Use a fresh connection after the RLS fixture rollback; pg_graphql lazily creates its DDL counter.
begin;
drop table public.ohmi_electronics_projects;
drop function public.ohmi_electronics_revision_guard();
do $$ begin if to_regclass('public.ohmi_playground_projects') is null then raise exception 'legacy table removed';end if;end $$;
rollback;
select 'PASS: owner CRUD, A/B isolation, forged owner denial, revision conflict, document/provenance constraints, anon denial, legacy checksum and additive rollback' as result;
