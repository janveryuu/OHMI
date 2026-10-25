-- Requires the onboarding migration. All synthetic identities and changes are rolled back.
begin;

select set_config('test.old_user', gen_random_uuid()::text, true), set_config('test.new_user', gen_random_uuid()::text, true), set_config('test.other_user', gen_random_uuid()::text, true);
insert into auth.users(id, created_at, is_anonymous)
select current_setting('test.old_user')::uuid, starts_at - interval '1 second', false from ohmi_private.onboarding_rollout
union all select current_setting('test.new_user')::uuid, starts_at + interval '1 second', false from ohmi_private.onboarding_rollout
union all select current_setting('test.other_user')::uuid, starts_at + interval '1 second', false from ohmi_private.onboarding_rollout;
insert into public.ohmi_profiles(id,display_name) values(current_setting('test.old_user')::uuid,'Unchanged existing profile');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.old_user'),'role','authenticated')::text,true);
do $test$ begin assert public.ohmi_claim_onboarding() = false, 'Existing account must never be invited'; end $test$;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.new_user'),'role','authenticated')::text,true);
do $test$ begin
 assert public.ohmi_claim_onboarding() = true, 'New account must claim once';
 assert public.ohmi_claim_onboarding() = false, 'Returning/other-device claim must fail';
 begin update public.ohmi_profiles set onboarding_invited_at=null where id=auth.uid(); raise exception 'Unexpected write access'; exception when insufficient_privilege then null; end;
 assert (select count(*) from public.ohmi_profiles)=1, 'RLS must isolate profiles';
end $test$;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.other_user'),'role','authenticated')::text,true);
do $test$ begin assert public.ohmi_claim_onboarding() = true, 'Accounts must claim independently'; end $test$;
reset role;
do $test$ begin
 assert (select onboarding_invited_at is null and display_name='Unchanged existing profile' from public.ohmi_profiles where id=current_setting('test.old_user')::uuid), 'Existing profile must remain unchanged';
 assert not has_function_privilege('anon','public.ohmi_claim_onboarding()','execute'), 'Anonymous access must be denied';
 assert not has_table_privilege('authenticated','ohmi_private.onboarding_rollout','select'), 'Rollout metadata must stay private';
end $test$;
select 'old/new/returning/cross-device/independent-account/RLS/column-grant/anonymous checks passed; transaction rolled back' as result;
rollback;
