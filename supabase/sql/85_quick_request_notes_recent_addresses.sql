-- 2026-10-21: plan 87 — 퀵 요청 사용자별 특이사항 칩 + 최근 주소 테이블
-- File: 85_quick_request_notes_recent_addresses.sql
-- Plan: 87_quick-request-goods-notes-address-picker-plan.md
-- Date: 2026-10-21
-- Status: Completed
-- Remote migration: 85_quick_request_notes_recent_addresses — dev 적용 완료 (20261021014657 · WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: quick_request_notes (사용자별 칩, 최대 10개 trigger, 「동승 필요」 seed trigger + backfill)
--          quick_request_recent_addresses (사용자별 최근 주소 10개, service_role 전용 RPC upsert+prune)
--          RLS: authenticated 본인 SELECT만. 쓰기는 service role Route Handler 전용.

-- ---------------------------------------------------------------------------
-- 1. quick_request_notes
-- ---------------------------------------------------------------------------
create table if not exists public.quick_request_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quick_request_notes_label_length_check
    check (char_length(btrim(label)) between 1 and 30),
  constraint quick_request_notes_label_trimmed_check
    check (label = btrim(label)),
  constraint quick_request_notes_user_label_key unique (user_id, label)
);

comment on table public.quick_request_notes is
  '퀵 요청 기사님 전달사항 칩 (사용자별 최대 10개, 출발·도착 공용). plan 87';

create index if not exists idx_quick_request_notes_user_created
  on public.quick_request_notes (user_id, created_at, id);

drop trigger if exists trg_quick_request_notes_updated_at on public.quick_request_notes;
create trigger trg_quick_request_notes_updated_at
  before update on public.quick_request_notes
  for each row execute function public.set_updated_at();

-- 10개 상한 (동시 insert 경합은 사용자 단위 advisory lock으로 직렬화)
create or replace function public.quick_request_notes_enforce_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quick_request_notes:' || new.user_id::text, 0)
  );

  select count(*) into v_count
  from public.quick_request_notes
  where user_id = new.user_id;

  if v_count >= 10 then
    raise exception using
      errcode = 'P0001',
      message = 'quick_request_notes_limit_exceeded',
      detail = '특이사항은 최대 10개까지 등록할 수 있습니다.';
  end if;

  return new;
end;
$$;

revoke execute on function public.quick_request_notes_enforce_limit() from public, anon, authenticated;

drop trigger if exists trg_quick_request_notes_enforce_limit on public.quick_request_notes;
create trigger trg_quick_request_notes_enforce_limit
  before insert on public.quick_request_notes
  for each row execute function public.quick_request_notes_enforce_limit();

-- 신규 profile → 「동승 필요」 seed (실패해도 profile 생성은 막지 않음)
create or replace function public.quick_request_notes_seed_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.quick_request_notes (user_id, label)
    values (new.user_id, '동승 필요')
    on conflict (user_id, label) do nothing;
  exception when others then
    raise warning 'quick_request_notes seed failed for %: %', new.user_id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.quick_request_notes_seed_for_profile() from public, anon, authenticated;

drop trigger if exists trg_profiles_seed_quick_request_notes on public.profiles;
create trigger trg_profiles_seed_quick_request_notes
  after insert on public.profiles
  for each row execute function public.quick_request_notes_seed_for_profile();

-- 기존 profiles backfill (1회 · 이미 있으면 skip)
insert into public.quick_request_notes (user_id, label)
select p.user_id, '동승 필요'
from public.profiles p
where not exists (
  select 1 from public.quick_request_notes n where n.user_id = p.user_id
)
on conflict (user_id, label) do nothing;

-- ---------------------------------------------------------------------------
-- 2. quick_request_recent_addresses
-- ---------------------------------------------------------------------------
create table if not exists public.quick_request_recent_addresses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  road_address text not null,
  detail_address text not null,
  contact_name text not null,
  contact_phone text not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint quick_request_recent_addresses_user_address_key
    unique (user_id, road_address, detail_address),
  constraint quick_request_recent_addresses_road_length_check
    check (char_length(road_address) between 1 and 300),
  constraint quick_request_recent_addresses_detail_length_check
    check (char_length(detail_address) between 1 and 300),
  constraint quick_request_recent_addresses_name_length_check
    check (char_length(contact_name) between 1 and 100),
  constraint quick_request_recent_addresses_phone_length_check
    check (char_length(contact_phone) between 1 and 20)
);

comment on table public.quick_request_recent_addresses is
  '퀵 요청 최근 이용 주소 (사용자별 최대 10개, 담당자·연락처 포함 — 사용자 승인 2026-10-21). plan 87';

create index if not exists idx_quick_request_recent_addresses_user_last_used
  on public.quick_request_recent_addresses (user_id, last_used_at desc, id desc);

-- upsert + 10개 prune (한 트랜잭션). p_items 순서 = 최근순 (첫 항목이 가장 최근)
create or replace function public.record_quick_request_recent_addresses(
  p_user_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_count integer := 0;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'p_user_id is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'p_items must be a json array';
  end if;

  with items as (
    select
      btrim(e.value ->> 'roadAddress') as road_address,
      btrim(e.value ->> 'detailAddress') as detail_address,
      btrim(e.value ->> 'contactName') as contact_name,
      btrim(e.value ->> 'contactPhone') as contact_phone,
      e.ordinality as ord
    from jsonb_array_elements(p_items) with ordinality as e(value, ordinality)
  ),
  deduped as (
    select distinct on (road_address, detail_address)
      road_address, detail_address, contact_name, contact_phone, ord
    from items
    order by road_address, detail_address, ord
  ),
  upserted as (
    insert into public.quick_request_recent_addresses as t (
      user_id, road_address, detail_address, contact_name, contact_phone, last_used_at
    )
    select
      p_user_id,
      d.road_address,
      d.detail_address,
      d.contact_name,
      d.contact_phone,
      v_now - ((d.ord - 1) * interval '1 millisecond')
    from deduped d
    on conflict (user_id, road_address, detail_address) do update
      set contact_name = excluded.contact_name,
          contact_phone = excluded.contact_phone,
          last_used_at = excluded.last_used_at
    returning 1
  )
  select count(*) into v_count from upserted;

  delete from public.quick_request_recent_addresses r
  where r.user_id = p_user_id
    and r.id not in (
      select k.id
      from public.quick_request_recent_addresses k
      where k.user_id = p_user_id
      order by k.last_used_at desc, k.id desc
      limit 10
    );

  return v_count;
end;
$$;

revoke execute on function public.record_quick_request_recent_addresses(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_quick_request_recent_addresses(uuid, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. RLS · 권한
-- ---------------------------------------------------------------------------
alter table public.quick_request_notes enable row level security;
alter table public.quick_request_recent_addresses enable row level security;

drop policy if exists quick_request_notes_self_select on public.quick_request_notes;
create policy quick_request_notes_self_select
  on public.quick_request_notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists quick_request_recent_addresses_self_select on public.quick_request_recent_addresses;
create policy quick_request_recent_addresses_self_select
  on public.quick_request_recent_addresses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.quick_request_notes from anon;
revoke all on public.quick_request_recent_addresses from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.quick_request_notes from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.quick_request_recent_addresses from authenticated;
grant select on public.quick_request_notes to authenticated;
grant select on public.quick_request_recent_addresses to authenticated;
grant all on public.quick_request_notes to service_role;
grant all on public.quick_request_recent_addresses to service_role;

-- ---------------------------------------------------------------------------
-- down (수동 롤백 · WakeOne-Dev-Supabase-Mcp execute_sql)
-- ---------------------------------------------------------------------------
-- drop function if exists public.record_quick_request_recent_addresses(uuid, jsonb);
-- drop trigger if exists trg_profiles_seed_quick_request_notes on public.profiles;
-- drop function if exists public.quick_request_notes_seed_for_profile();
-- drop trigger if exists trg_quick_request_notes_enforce_limit on public.quick_request_notes;
-- drop function if exists public.quick_request_notes_enforce_limit();
-- drop table if exists public.quick_request_recent_addresses, public.quick_request_notes;
