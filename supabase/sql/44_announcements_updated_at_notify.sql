-- 2026-08-10: announcements updated_at — notify(notified_at)만 변경 시 bump 금지
-- File: 44_announcements_updated_at_notify.sql
-- Plan: 39_announcements-plan.md
-- Reason: create 직후 fan-out이 notified_at UPDATE → set_updated_at → 「수정됨」 오표시

create or replace function public.set_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (
    old.title is distinct from new.title
    or old.body is distinct from new.body
    or old.priority is distinct from new.priority
    or old.is_pinned is distinct from new.is_pinned
  ) then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
before update on public.announcements
for each row
execute function public.set_announcements_updated_at();

-- 기존 notify-only bump 보정 (updated_at이 created_at 직후 2초 이내면 동기화)
update public.announcements
set updated_at = created_at
where updated_at > created_at
  and updated_at <= created_at + interval '2 seconds';
