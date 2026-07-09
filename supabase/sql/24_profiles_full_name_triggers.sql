-- Plan: 19_user-single-name-plan.md (follow-up)
-- Date: 2026-07-09
-- Status: Applied

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, first_name, last_name, password_set_at)
  values (
    new.id,
    coalesce(new.email, ''),
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

  insert into public.profiles (user_id, email, full_name, first_name, last_name)
  values (uid, coalesce(uemail, ''), coalesce(uemail, ''), '', '')
  on conflict (user_id) do nothing;
end;
$$;
