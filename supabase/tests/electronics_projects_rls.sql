-- Synthetic fixtures only; run against the isolated M2 test container.
begin;
insert into auth.users(id,aud,role,email) values
 ('00000000-0000-4000-8000-00000000a001','authenticated','authenticated','electronics-a@example.test'),
 ('00000000-0000-4000-8000-00000000a002','authenticated','authenticated','electronics-b@example.test');
insert into public.ohmi_playground_projects(id,user_id,name,project) values
 ('00000000-0000-4000-8000-00000000c001','00000000-0000-4000-8000-00000000a001','Legacy','{"version":1,"name":"Legacy","parts":[],"wires":[],"mission":"switch","hints":2,"completed":["led"]}');
create temp table legacy_before as select id,md5(row_to_json(p)::text) checksum from public.ohmi_playground_projects p;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000a001',true);
insert into public.ohmi_electronics_projects(id,user_id,name,document,engine_commit) values
 ('00000000-0000-4000-8000-00000000b001','00000000-0000-4000-8000-00000000a001','Circuit','{"format":"designElectronics","version":1,"title":"Circuit","parts":[],"wires":[]}','4d9cb373bd06afb2d99b1548e6c3a0c86992bd56');
update public.ohmi_electronics_projects set revision=2 where id='00000000-0000-4000-8000-00000000b001' and revision=1;
do $$ declare n int; begin
 update public.ohmi_electronics_projects set revision=2 where id='00000000-0000-4000-8000-00000000b001' and revision=1;
 get diagnostics n=row_count; if n<>0 then raise exception 'stale conditional write succeeded'; end if;
 begin update public.ohmi_electronics_projects set revision=2; raise exception 'direct stale revision allowed'; exception when serialization_failure then null; end;
 begin update public.ohmi_electronics_projects set user_id='00000000-0000-4000-8000-00000000a002',revision=3; raise exception 'ownership reassignment allowed'; exception when check_violation or insufficient_privilege then null; end;
 begin update public.ohmi_electronics_projects set document='{}',revision=3; raise exception 'invalid document allowed'; exception when check_violation then null; end;
 begin update public.ohmi_electronics_projects set source_legacy_id='00000000-0000-4000-8000-00000000c001',revision=3; raise exception 'provenance rewrite allowed'; exception when check_violation then null; end;
 if (select count(*) from public.ohmi_electronics_projects)<>1 then raise exception 'owner reopen failed'; end if;
 begin insert into public.ohmi_electronics_projects(id,user_id,name,document,engine_commit,source_legacy_id,source_legacy_revision,legacy_snapshot) values ('00000000-0000-4000-8000-00000000b003','00000000-0000-4000-8000-00000000a001','Circuit','{"format":"designElectronics","version":1,"title":"Circuit","parts":[],"wires":[]}','4d9cb373bd06afb2d99b1548e6c3a0c86992bd56','00000000-0000-4000-8000-00000000c001',99,'{}');raise exception 'false source provenance allowed';exception when serialization_failure then null;end;
end $$;
insert into public.ohmi_electronics_projects(id,user_id,name,document,engine_commit,source_legacy_id,source_legacy_revision,legacy_snapshot)
select '00000000-0000-4000-8000-00000000b004','00000000-0000-4000-8000-00000000a001','Circuit','{"format":"designElectronics","version":1,"title":"Circuit","parts":[],"wires":[]}'::jsonb,'4d9cb373bd06afb2d99b1548e6c3a0c86992bd56',id,revision,project
from public.ohmi_playground_projects where id='00000000-0000-4000-8000-00000000c001';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000a002',true);
do $$ declare n int; begin
 if exists(select from public.ohmi_electronics_projects) then raise exception 'cross-owner read allowed'; end if;
 update public.ohmi_electronics_projects set revision=3;get diagnostics n=row_count;if n<>0 then raise exception 'cross-owner update allowed';end if;
 delete from public.ohmi_electronics_projects;get diagnostics n=row_count;if n<>0 then raise exception 'cross-owner delete allowed';end if;
 begin insert into public.ohmi_electronics_projects(id,user_id,name,document,engine_commit) values ('00000000-0000-4000-8000-00000000b002','00000000-0000-4000-8000-00000000a001','Circuit','{"format":"designElectronics","version":1,"title":"Circuit","parts":[],"wires":[]}','4d9cb373bd06afb2d99b1548e6c3a0c86992bd56'); raise exception 'forged ownership insert allowed'; exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000a001',true);
do $$ declare n int;begin delete from public.ohmi_electronics_projects where id='00000000-0000-4000-8000-00000000b001' and revision=2;get diagnostics n=row_count;if n<>1 then raise exception 'owner delete failed';end if;end $$;
set local role anon;
do $$ begin begin perform * from public.ohmi_electronics_projects;raise exception 'anonymous read allowed';exception when insufficient_privilege then null;end;end $$;
reset role;
do $$ begin
 if exists(select from public.ohmi_playground_projects p join legacy_before b using(id) where md5(row_to_json(p)::text)<>b.checksum) then raise exception 'legacy row changed';end if;
end $$;
rollback;
select 'PASS: owner CRUD, A/B isolation, forged owner denial, revision conflict, document/provenance constraints, anon denial and legacy checksum' as result;
