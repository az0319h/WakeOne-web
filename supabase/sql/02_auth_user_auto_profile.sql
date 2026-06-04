-- File: 02_auth_user_auto_profile.sql
-- Plan: 01_supabase-auth-login-plan.md
-- Date: 2026-06-04
-- Status: Completed
-- Remote migration: auth_user_auto_profile (20260604053327)
-- Summary: auth.users INSERT → profiles 자동 생성, ensure_profile_for_user RPC

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    '',
    ''
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 로그인 세션 폴백: 트리거 누락·레거시 계정
create or replace function public.ensure_profile_for_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then
    return;
  end if;

  if exists (select 1 from public.profiles where user_id = uid) then
    return;
  end if;

  select email into uemail from auth.users where id = uid;

  insert into public.profiles (user_id, email, first_name, last_name)
  values (uid, coalesce(uemail, ''), '', '')
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.ensure_profile_for_user() from public;
grant execute on function public.ensure_profile_for_user() to authenticated;

-- 기존 auth.users 중 profiles 없는 계정 백필
insert into public.profiles (user_id, email, first_name, last_name)
select u.id, coalesce(u.email, ''), '', ''
from auth.users u
where not exists (
  select 1 from public.profiles p where p.user_id = u.id
)
on conflict (user_id) do nothing;
