-- File: 08_revoke_user_sessions.sql
-- Summary: admin 비활성화 시 대상 user의 auth 세션·리프레시 토큰 폐기 (service_role RPC)

create or replace function public.revoke_user_sessions(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  delete from auth.sessions where user_id = target_user_id;
  delete from auth.refresh_tokens where user_id = target_user_id::text;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
