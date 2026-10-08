-- File: 72_dev_user_provision_active_status.sql
-- Plan: 70_dev-user-provision-plan.md
-- Date: 2026-10-06
-- Status: Completed
-- Remote migration: applied (72_dev_user_provision_active_status)
-- Summary: Pre-provisioned active profiles must not downgrade to pending_approval on Google OAuth link

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
    approval_requested_at = case
      when public.profiles.status = 'active' then public.profiles.approval_requested_at
      else coalesce(public.profiles.approval_requested_at, excluded.approval_requested_at)
    end,
    status = public.profiles.status
  where public.profiles.email is distinct from excluded.email
     or public.profiles.google_email is distinct from excluded.google_email
     or public.profiles.google_display_name is distinct from excluded.google_display_name
     or public.profiles.approval_requested_at is null;

  return new;
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
