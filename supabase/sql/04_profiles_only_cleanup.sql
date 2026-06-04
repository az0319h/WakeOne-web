-- File: 04_profiles_only_cleanup.sql
-- Plan: 02_user-invite-profiles-plan.md
-- Date: 2026-06-04
-- Status: Completed
-- Remote migration: profiles_only_cleanup (20260604085440)
-- Summary: profiles 단일화, password_set_at, mark_password_set, org·audit DROP

-- ---------------------------------------------------------------------------
-- profiles.password_set_at
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists password_set_at timestamptz;

comment on column public.profiles.password_set_at is
  '최초 비밀번호 설정 완료 시각. null이면 대시보드 접근 불가.';

-- 기존 로그인 가능 사용자: 이메일 확인 또는 이미 존재하는 계정은 설정 완료로 간주
update public.profiles p
set password_set_at = coalesce(
  (
    select u.email_confirmed_at
    from auth.users u
    where u.id = p.user_id
  ),
  p.created_at,
  now()
)
where p.password_set_at is null;

-- ---------------------------------------------------------------------------
-- 의존 테이블 제거 (순서: FK 자식 → 부모)
-- ---------------------------------------------------------------------------
drop table if exists public.organization_memberships cascade;
drop table if exists public.organizations cascade;
drop table if exists public.audit_logs cascade;

drop type if exists public.invite_status;
drop type if exists public.org_role;
drop type if exists public.organization_code;

-- ---------------------------------------------------------------------------
-- RPC: 비밀번호 설정 완료 표시
-- ---------------------------------------------------------------------------
create or replace function public.mark_password_set()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set password_set_at = now()
  where user_id = auth.uid()
    and password_set_at is null;
end;
$$;

revoke all on function public.mark_password_set() from public;
grant execute on function public.mark_password_set() to authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user: 초대 계정은 password_set_at null 유지
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, first_name, last_name, password_set_at)
  values (
    new.id,
    coalesce(new.email, ''),
    '',
    '',
    null
  )
  on conflict (user_id) do update
  set email = excluded.email
  where public.profiles.email is distinct from excluded.email;

  return new;
end;
$$;
