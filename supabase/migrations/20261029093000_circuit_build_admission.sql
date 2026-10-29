-- Local draft: reuse existing owner/replay/lease protections without changing chat routing.
begin;
create or replace function public.ohmi_reserve_circuit_build(
  p_user_id uuid, p_request_id uuid, p_conversation_id uuid, p_hash text, p_language text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_conversation_id is null then raise exception 'Conversation unavailable'; end if;
  result := public.ohmi_reserve_ai(p_user_id,p_request_id,'chat',p_conversation_id,
    p_hash,p_language,'openai/gpt-oss-120b',null,p_conversation_id);
  if (result->>'fresh')::boolean then
    update public.ohmi_ai_requests set operation='circuit_build' where id=p_request_id;
    result := result || jsonb_build_object('operation','circuit_build');
  elsif result->>'operation' is distinct from 'circuit_build' then
    raise exception 'Request replay does not match';
  end if;
  return result;
end $$;
revoke execute on function public.ohmi_reserve_circuit_build(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ohmi_reserve_circuit_build(uuid,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
