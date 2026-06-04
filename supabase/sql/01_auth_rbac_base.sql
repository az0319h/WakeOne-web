-- File: 01_auth_rbac_base.sql
-- Plan: 01_supabase-auth-login-plan.md
-- Date: 2026-06-04
-- Status: Completed
-- Remote migration: auth_rbac_base (20260604050942)
-- Summary: Auth + RBAC base schema (profiles, org tables — org removed in 04)

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'system_role' and n.nspname = 'public'
  ) then
    create type public.system_role as enum ('admin', 'user');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'organization_code' and n.nspname = 'public'
  ) then
    create type public.organization_code as enum ('wake', 'sans', 'ansan');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'org_role' and n.nspname = 'public'
  ) then
    create type public.org_role as enum ('owner', 'manager', 'member', 'viewer');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'invite_status' and n.nspname = 'public'
  ) then
    create type public.invite_status as enum ('pending', 'accepted', 'expired');
  end if;
end$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code public.organization_code not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  phone text,
  system_role public.system_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  department text not null,
  org_role public.org_role not null default 'member',
  is_primary boolean not null default false,
  invite_status public.invite_status not null default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id, department)
);

create unique index if not exists idx_memberships_primary_per_user
  on public.organization_memberships (user_id)
  where is_primary = true;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.organizations (code, name)
values
  ('wake', 'WAKE'),
  ('sans', 'SANS'),
  ('ansan', 'ANSAN')
on conflict (code) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_organization_memberships_updated_at on public.organization_memberships;
create trigger trg_organization_memberships_updated_at
before update on public.organization_memberships
for each row
execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists organizations_select_authenticated on public.organizations;
create policy organizations_select_authenticated
on public.organizations
for select
to authenticated
using (true);

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists memberships_select_self_or_admin on public.organization_memberships;
create policy memberships_select_self_or_admin
on public.organization_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists memberships_modify_admin_only on public.organization_memberships;
create policy memberships_modify_admin_only
on public.organization_memberships
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists audit_logs_admin_only on public.audit_logs;
create policy audit_logs_admin_only
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);
