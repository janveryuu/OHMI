-- Run only on a test-enabled connection. Every fixture is rolled back.
begin;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-4000-8000-00000000a001','authenticated','authenticated','ohmi-playground-a@example.test','{}','{"ohmi_playground_test":true}'),
 ('00000000-0000-4000-8000-00000000a002','authenticated','authenticated','ohmi-playground-b@example.test','{}','{"ohmi_playground_test":true}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000a001',true);
insert into public.ohmi_playground_projects(id,user_id,name,project) values ('00000000-0000-4000-8000-00000000b001','00000000-0000-4000-8000-00000000a001','Isolation fixture','{"version":1}');
do $$ begin if (select count(*) from public.ohmi_playground_projects where id='00000000-0000-4000-8000-00000000b001')<>1 then raise exception 'owner read failed'; end if; end $$;
update public.ohmi_playground_projects set name='Owner edit',revision=2 where id='00000000-0000-4000-8000-00000000b001';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000a002',true);
do $$ declare n int; begin
 if exists(select 1 from public.ohmi_playground_projects where id='00000000-0000-4000-8000-00000000b001') then raise exception 'cross-owner read leak'; end if;
 update public.ohmi_playground_projects set name='forbidden' where id='00000000-0000-4000-8000-00000000b001'; get diagnostics n=row_count; if n<>0 then raise exception 'cross-owner update leak';end if;
 delete from public.ohmi_playground_projects where id='00000000-0000-4000-8000-00000000b001';get diagnostics n=row_count;if n<>0 then raise exception 'cross-owner delete leak';end if;
 begin insert into public.ohmi_playground_projects(id,user_id,name,project) values(gen_random_uuid(),'00000000-0000-4000-8000-00000000a001','forbidden','{"version":1}');raise exception 'cross-owner insert leak';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000a001',true);
do $$ begin begin update public.ohmi_playground_projects set user_id='00000000-0000-4000-8000-00000000a002' where id='00000000-0000-4000-8000-00000000b001';raise exception 'ownership reassignment allowed';exception when insufficient_privilege then null;end;end $$;
delete from public.ohmi_playground_projects where id='00000000-0000-4000-8000-00000000b001';
set local role anon;
do $$ begin begin perform * from public.ohmi_playground_projects;raise exception 'anonymous read allowed';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
select 'PASS: owner CRUD; cross-owner select/update/delete/insert denied; owner reassignment denied; anonymous denied; fixtures rolled back' as result;
