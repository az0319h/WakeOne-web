-- File: 07_profiles_realtime.sql
-- Summary: profiles.status 변경을 클라이언트 Realtime으로 수신 (비활성 즉시 로그아웃)

alter table public.profiles replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
