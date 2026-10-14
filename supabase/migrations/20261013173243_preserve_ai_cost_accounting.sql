begin;
-- Keep non-content billing metrics after account deletion so project limits cannot reset.
alter table public.ohmi_ai_requests drop constraint ohmi_ai_requests_user_id_fkey;
alter table public.ohmi_ai_requests alter column user_id drop not null;
alter table public.ohmi_ai_requests add constraint ohmi_ai_requests_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;
notify pgrst,'reload schema';
commit;
