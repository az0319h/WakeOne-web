-- File: 56_google_auth_approval_migration.sql
-- Plan: 57_google-auth-approval-migration-plan.md
-- Date: 2026-10-02
-- Status: Approved
-- Remote migration: applied (version 20261002022941)
-- Summary: Google OAuth 신규 사용자를 승인 대기 상태로 생성하고 승인 metadata를 profiles에 보존

-- profiles.status: Google OAuth approval lifecycle
do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  where c.conrelid = 'public.profiles'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status%'
    and pg_get_constraintdef(c.oid) like '%active%'
    and pg_get_constraintdef(c.oid) like '%inactive%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.profiles
  alter column status set default 'active';

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'inactive', 'pending_approval', 'rejected'));

comment on column public.profiles.status is
  'active: 승인 완료. inactive: 비활성. pending_approval: Google 신규 가입 승인 대기. rejected: 가입 요청 거절.';

alter table public.profiles
  add column if not exists google_email text,
  add column if not exists google_display_name text,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists rejection_reason text;

comment on column public.profiles.google_email is
  'Google OAuth에서 받은 참고용 이메일. 업무 email/full_name을 자동 덮어쓰지 않는다.';
comment on column public.profiles.google_display_name is
  'Google OAuth에서 받은 참고용 display name. 업무 full_name을 자동 덮어쓰지 않는다.';
comment on column public.profiles.approval_requested_at is
  'Google 신규 가입 승인 요청 생성 시각.';
comment on column public.profiles.approved_at is
  '관리자 수락 시각.';
comment on column public.profiles.approved_by is
  '관리자 수락 처리자.';
comment on column public.profiles.rejected_at is
  '관리자 거절 시각.';
comment on column public.profiles.rejected_by is
  '관리자 거절 처리자.';
comment on column public.profiles.rejection_reason is
  '관리자 거절 사유. 이메일 발송에는 사용하지 않는다.';

create index if not exists profiles_google_email_lower_idx
  on public.profiles (lower(google_email))
  where google_email is not null;

create index if not exists profiles_pending_approval_created_idx
  on public.profiles (approval_requested_at desc)
  where status = 'pending_approval';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  google_email text := lower(nullif(trim(coalesce(new.email, new.raw_user_meta_data ->> 'email', '')), ''));
  google_name text := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  )), '');
  is_google boolean := provider = 'google';
begin
  insert into public.profiles (
    user_id,
    email,
    full_name,
    first_name,
    last_name,
    password_set_at,
    status,
    google_email,
    google_display_name,
    approval_requested_at
  )
  values (
    new.id,
    coalesce(google_email, ''),
    case when is_google then '' else coalesce(google_email, '') end,
    '',
    '',
    null,
    case when is_google then 'pending_approval' else 'active' end,
    case when is_google then google_email else null end,
    case when is_google then google_name else null end,
    case when is_google then now() else null end
  )
  on conflict (user_id) do update
  set
    email = case
      when public.profiles.status = 'pending_approval'
        then public.profiles.email
      else excluded.email
    end,
    google_email = coalesce(public.profiles.google_email, excluded.google_email),
    google_display_name = coalesce(public.profiles.google_display_name, excluded.google_display_name),
    approval_requested_at = coalesce(public.profiles.approval_requested_at, excluded.approval_requested_at)
  where public.profiles.email is distinct from excluded.email
     or public.profiles.google_email is distinct from excluded.google_email
     or public.profiles.google_display_name is distinct from excluded.google_display_name
     or public.profiles.approval_requested_at is null;

  return new;
end;
$$;

create or replace function public.ensure_profile_for_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_record auth.users%rowtype;
  provider text;
  google_email text;
  google_name text;
  is_google boolean;
begin
  if uid is null then
    return;
  end if;

  if exists (select 1 from public.profiles where user_id = uid) then
    return;
  end if;

  select * into user_record from auth.users where id = uid;
  if not found then
    return;
  end if;

  provider := coalesce(user_record.raw_app_meta_data ->> 'provider', '');
  google_email := lower(nullif(trim(coalesce(user_record.email, user_record.raw_user_meta_data ->> 'email', '')), ''));
  google_name := nullif(trim(coalesce(
    user_record.raw_user_meta_data ->> 'full_name',
    user_record.raw_user_meta_data ->> 'name'
  )), '');
  is_google := provider = 'google';

  insert into public.profiles (
    user_id,
    email,
    full_name,
    first_name,
    last_name,
    status,
    google_email,
    google_display_name,
    approval_requested_at
  )
  values (
    uid,
    coalesce(google_email, ''),
    case when is_google then '' else coalesce(google_email, '') end,
    '',
    '',
    case when is_google then 'pending_approval' else 'active' end,
    case when is_google then google_email else null end,
    case when is_google then google_name else null end,
    case when is_google then now() else null end
  )
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.ensure_google_auth_profile(
  p_google_email text,
  p_google_display_name text default null
)
returns table (
  user_id uuid,
  status text,
  google_email text,
  google_display_name text,
  approval_requested_at timestamptz,
  approval_request_log_needed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized_email text := lower(nullif(trim(p_google_email), ''));
  normalized_name text := nullif(trim(p_google_display_name), '');
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  perform public.ensure_profile_for_user();

  update public.profiles p
  set
    google_email = coalesce(p.google_email, normalized_email),
    google_display_name = coalesce(p.google_display_name, normalized_name),
    approval_requested_at = case
      when p.status = 'pending_approval' then coalesce(p.approval_requested_at, now())
      else p.approval_requested_at
    end
  where p.user_id = uid
    and (
      p.google_email is null
      or p.google_display_name is null
      or (p.status = 'pending_approval' and p.approval_requested_at is null)
    );

  return query
  select
    p.user_id,
    p.status,
    p.google_email,
    p.google_display_name,
    p.approval_requested_at,
    p.status = 'pending_approval'
      and not exists (
        select 1
        from public.activity_logs al
        where al.action = 'user.approval_request'
          and al.target_user_id = p.user_id
          and al.http_status >= 200
          and al.http_status < 300
      ) as approval_request_log_needed
  from public.profiles p
  where p.user_id = uid;
end;
$$;

grant execute on function public.ensure_google_auth_profile(text, text) to authenticated;

create or replace function public.profile_status_for_email(p_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.status
  from public.profiles p
  where lower(p.email) = lower(trim(p_email))
     or lower(coalesce(p.google_email, '')) = lower(trim(p_email))
  limit 1;
$$;
