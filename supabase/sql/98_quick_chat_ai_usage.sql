-- 2026-10-28: plan 100 — 퀵 대화 AI 답장 추천 사용자별 일일 카운터 (KST 하루 100회 · 원자 증가 RPC · service_role 전용 쓰기)
-- File: 98_quick_chat_ai_usage.sql
-- Plan: 100_quick-chat-ai-reply-suggestions-plan.md (D-6 · AC-07) — plan 문서의 「SQL 97」은 번호 밀림(97 다음 = 98)
-- Date: 2026-10-28
-- Status: Completed
-- Remote migration: 98_quick_chat_ai_usage — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary:
--   1) quick_chat_ai_usage — (user_id, day) PK · count ≥ 0 · updated_at. day = 서버가 계산한 KST 날짜(date)
--      RLS: 본인 행 SELECT만(authenticated). INSERT/UPDATE/DELETE 권한 없음 → 쓰기는 service_role RPC 전용
--   2) increment_quick_chat_ai_usage(p_user, p_day, p_limit) returns int — 원자 upsert(+1).
--      한도 도달(count >= p_limit)이면 증가하지 않고 null 반환 → Route 429 {reason:'limit'}.
--      root 결정(2026-10-28): Anthropic 호출 **직전**에 증가 = 「AI까지 간 호출」을 센다(성공·실패 무관 · mock 포함).
--      SECURITY INVOKER · search_path='' · EXECUTE는 service_role만(anon·authenticated·public revoke)
--   본문·추천 문장은 어디에도 저장하지 않는다(카운트 숫자만).
-- 롤백:
--   drop function if exists public.increment_quick_chat_ai_usage(uuid, date, integer);
--   drop table if exists public.quick_chat_ai_usage;

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.quick_chat_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

comment on table public.quick_chat_ai_usage is
  'plan 100 — 퀵 대화 AI 답장 추천 사용자별 일일(KST) 호출 수. 쓰기는 service_role RPC(increment_quick_chat_ai_usage) 전용 · 본문 저장 없음';

alter table public.quick_chat_ai_usage enable row level security;

drop policy if exists quick_chat_ai_usage_select_own on public.quick_chat_ai_usage;
create policy quick_chat_ai_usage_select_own
  on public.quick_chat_ai_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.quick_chat_ai_usage from public, anon, authenticated;
grant select on table public.quick_chat_ai_usage to authenticated;
grant all on table public.quick_chat_ai_usage to service_role;

-- ---------------------------------------------------------------------------
-- 2. 원자 증가 RPC (한도 초과 → null · 증가 없음)
-- ---------------------------------------------------------------------------
create or replace function public.increment_quick_chat_ai_usage(
  p_user uuid,
  p_day date,
  p_limit integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_user is null or p_day is null or p_limit is null or p_limit < 1 then
    return null;
  end if;

  insert into public.quick_chat_ai_usage as u (user_id, day, count, updated_at)
  values (p_user, p_day, 1, now())
  on conflict (user_id, day) do update
    set count = u.count + 1,
        updated_at = now()
    where u.count < p_limit
  returning u.count into v_count;

  -- 충돌 행이 where를 통과하지 못하면(한도 도달) returning 0행 → v_count null
  return v_count;
end;
$$;

comment on function public.increment_quick_chat_ai_usage(uuid, date, integer) is
  'plan 100 D-6 — (user, KST day) 카운트 +1 후 새 값 반환. 이미 p_limit 이상이면 증가 없이 null. service_role 전용';

revoke all on function public.increment_quick_chat_ai_usage(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.increment_quick_chat_ai_usage(uuid, date, integer) to service_role;
