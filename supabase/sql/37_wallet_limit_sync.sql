-- File: 37_wallet_limit_sync.sql
-- Plan: 32_wallet-kbcard-sync-plan.md (예정)
-- Date: 2026-08-03
-- Status: In Progress
-- Summary: KB국민카드 한도 동기화 로그(wallet_syncs) 단일 테이블 + self/admin RLS.
--   kbcard 반자동 실행 → POST /api/wallet/sync (service role) 가 append-only 로 기록.
--   현재 스냅샷(Hero) = 사용자별 최신 1행, 동기화 기록(타임라인) = 사용자별 전체 행.

create table if not exists public.wallet_syncs (
  id bigint generated always as identity primary key,
  request_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  matched_name text not null,
  monthly_limit numeric(14, 0) not null check (monthly_limit >= 0),
  monthly_remaining numeric(14, 0) not null check (monthly_remaining >= 0),
  previous_remaining numeric(14, 0) check (previous_remaining is null or previous_remaining >= 0),
  status text not null check (status in ('matched', 'unmatched')),
  source text not null default 'kbcard',
  synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint wallet_syncs_matched_name_length check (char_length(matched_name) <= 100),
  constraint wallet_syncs_user_id_status_check check (
    (status = 'matched' and user_id is not null)
    or (status = 'unmatched' and user_id is null)
  )
);

-- Hero 스냅샷(사용자별 최신) + 타임라인(사용자별 최신순)
create index if not exists idx_wallet_syncs_user_synced_at
  on public.wallet_syncs (user_id, synced_at desc);

-- 무한 스크롤 cursor 페이징
create index if not exists idx_wallet_syncs_user_id_desc
  on public.wallet_syncs (user_id, id desc);

-- admin 전체 최근순
create index if not exists idx_wallet_syncs_created_at
  on public.wallet_syncs (created_at desc);

-- append-only 보장 (service role 도 update/delete 차단)
create or replace function public.prevent_wallet_syncs_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'wallet_syncs is append-only';
end;
$$;

drop trigger if exists trg_wallet_syncs_no_update on public.wallet_syncs;
create trigger trg_wallet_syncs_no_update
before update or delete on public.wallet_syncs
for each row execute function public.prevent_wallet_syncs_mutation();

alter table public.wallet_syncs enable row level security;

-- 일반 사용자는 본인 행만, admin 은 전체 조회 (활동 로그와 동일 정책)
drop policy if exists wallet_syncs_select_self_or_admin on public.wallet_syncs;
create policy wallet_syncs_select_self_or_admin
on public.wallet_syncs
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

-- 쓰기는 service role 전용 (kbcard sync API)
revoke insert, update, delete on public.wallet_syncs from authenticated;
revoke insert, update, delete on public.wallet_syncs from anon;
