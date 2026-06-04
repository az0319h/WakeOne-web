-- File: 03_fix_profiles_rls_recursion.sql
-- Plan: 01_supabase-auth-login-plan.md
-- Date: 2026-06-04
-- Status: Completed
-- Remote migration: fix_profiles_rls_recursion (20260604053602)
-- Summary: profiles RLS 재귀 수정 (is_system_admin security definer)

create or replace function public.is_system_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and system_role = 'admin'::public.system_role
  );
$$;

revoke all on function public.is_system_admin() from public;
grant execute on function public.is_system_admin() to authenticated;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (auth.uid() = user_id or public.is_system_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (auth.uid() = user_id or public.is_system_admin())
with check (auth.uid() = user_id or public.is_system_admin());

drop policy if exists memberships_select_self_or_admin on public.organization_memberships;
create policy memberships_select_self_or_admin
on public.organization_memberships
for select
to authenticated
using (user_id = auth.uid() or public.is_system_admin());

drop policy if exists memberships_modify_admin_only on public.organization_memberships;
create policy memberships_modify_admin_only
on public.organization_memberships
for all
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists audit_logs_admin_only on public.audit_logs;
create policy audit_logs_admin_only
on public.audit_logs
for select
to authenticated
using (public.is_system_admin());
