-- 2026-10-21: plan 89 — 퀵 업무 흐름(등록·접수·배차·승인·취소) · 동방특송 소속 · 오픈채팅 webhook 발송 기록
-- File: 89_quick_requests_workflow.sql
-- Plan: 89_quick-workflow-dongbang-openchat-plan.md
-- Date: 2026-10-21
-- Status: Completed
-- Remote migration: 89_quick_requests_workflow — dev 적용 완료 (20261021143313 · WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: profiles_affiliation_check += 'dongbang' (기존 wake/sans/sans_foundry 유지)
--          private.is_dongbang_user / private.can_view_all_quick_requests (SECURITY DEFINER, 비노출 schema)
--          quick_request_counters (연도별 순번) · quick_requests · quick_request_openchat_dispatches
--          public.format_quick_request_no (YYYY-NN, 최소 2자리 · lpad 미사용) · public.create_quick_request (service_role 전용)
--          private.quick_requests_guard_update trigger (approved/cancelled 잠금 · 허용 전이만)
--          RLS SELECT only: quick_requests = 요청자 본인 OR viewer-all(admin·동방·wake 구매물류팀) / dispatches = viewer-all
--          notifications_type_check += quick_request.vendor_event · quick_request.requester_event (기존 28종 유지)
--          announcements · announcement_attachments · storage(announcement-attachments) SELECT 에서 동방특송 제외

-- ---------------------------------------------------------------------------
-- 0. 소속 CHECK (기존 값 보존 + dongbang)
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_affiliation_check;
alter table public.profiles
  add constraint profiles_affiliation_check
  check (affiliation = any (array['wake'::text, 'sans'::text, 'sans_foundry'::text, 'dongbang'::text]));

-- ---------------------------------------------------------------------------
-- 1. 판정 함수 (private · SECURITY DEFINER — RLS 재귀 방지)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_dongbang_user(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null and exists (
    select 1
    from public.profiles p
    where p.user_id = p_uid
      and p.affiliation = 'dongbang'
  );
$$;

create or replace function private.can_view_all_quick_requests(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null and exists (
    select 1
    from public.profiles p
    where p.user_id = p_uid
      and p.status = 'active'
      and (
        p.system_role = 'admin'::public.system_role
        or p.affiliation = 'dongbang'
        or (p.system_role = 'user'::public.system_role
            and p.affiliation = 'wake'
            and p.rank = '구매물류팀')
      )
  );
$$;

revoke all on function private.is_dongbang_user(uuid) from public, anon;
revoke all on function private.can_view_all_quick_requests(uuid) from public, anon;
grant execute on function private.is_dongbang_user(uuid) to authenticated, service_role;
grant execute on function private.can_view_all_quick_requests(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 연도별 카운터
-- ---------------------------------------------------------------------------
create table if not exists public.quick_request_counters (
  year integer primary key check (year between 2000 and 9999),
  last_seq integer not null default 0 check (last_seq >= 0)
);
comment on table public.quick_request_counters is
  '퀵 요청번호 연도별 순번 (KST 연도). 쓰기는 create_quick_request RPC 전용. plan 89';

-- ---------------------------------------------------------------------------
-- 3. quick_requests
-- ---------------------------------------------------------------------------
create table if not exists public.quick_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique check (request_no ~ '^\d{4}-\d{2,}$'),
  request_year integer not null,
  request_seq integer not null check (request_seq > 0),
  status text not null default 'requested'
    check (status in ('requested', 'dispatching', 'dispatched', 'approved', 'cancelled')),
  requester_user_id uuid not null references auth.users (id) on delete restrict,
  requester_name text not null check (char_length(btrim(requester_name)) between 1 and 100),
  requester_phone text null check (requester_phone is null or requester_phone ~ '^\d{11}$'),
  goods_size text not null check (goods_size in ('xs', 's', 'm', 'other')),
  item_description text not null default '' check (char_length(item_description) <= 500),
  vehicle_types text[] not null check (cardinality(vehicle_types) between 1 and 20),
  vehicle_other_text text null check (vehicle_other_text is null or char_length(vehicle_other_text) <= 100),
  vehicle_count integer not null check (vehicle_count > 0 and vehicle_count <= 999),
  freight_payment text not null check (freight_payment in ('monthly', 'collect')),
  origin jsonb not null check (jsonb_typeof(origin) = 'object'),
  stopovers jsonb not null default '[]'::jsonb check (jsonb_typeof(stopovers) = 'array'),
  destination jsonb not null check (jsonb_typeof(destination) = 'object'),
  requested_at timestamptz not null default now(),
  estimated_amount integer null check (estimated_amount is null or estimated_amount >= 0),
  final_amount integer null check (final_amount is null or final_amount >= 0),
  dispatch_vehicle_info text null check (dispatch_vehicle_info is null or char_length(dispatch_vehicle_info) <= 100),
  driver_name text null check (driver_name is null or char_length(driver_name) <= 50),
  driver_phone text null check (driver_phone is null or driver_phone ~ '^\d{11}$'),
  accepted_at timestamptz null,
  accepted_by uuid null references auth.users (id) on delete set null,
  dispatched_at timestamptz null,
  dispatched_by uuid null references auth.users (id) on delete set null,
  final_amount_set_at timestamptz null,
  final_amount_set_by uuid null references auth.users (id) on delete set null,
  approved_at timestamptz null,
  approved_by uuid null references auth.users (id) on delete set null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references auth.users (id) on delete set null,
  cancel_reason text null check (cancel_reason is null or char_length(cancel_reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quick_requests_year_seq_key unique (request_year, request_seq),
  constraint quick_requests_approved_requires_final check (status <> 'approved' or final_amount is not null)
);
comment on table public.quick_requests is
  '퀵 요청 (요청번호 YYYY-NN · 상태 requested→dispatching→dispatched→approved | cancelled). 쓰기는 service_role 전용. plan 89';

create index if not exists idx_quick_requests_requested_at
  on public.quick_requests (requested_at desc);
create index if not exists idx_quick_requests_status_requested_at
  on public.quick_requests (status, requested_at desc);
create index if not exists idx_quick_requests_requester_requested_at
  on public.quick_requests (requester_user_id, requested_at desc);

drop trigger if exists trg_quick_requests_updated_at on public.quick_requests;
create trigger trg_quick_requests_updated_at
  before update on public.quick_requests
  for each row execute function public.set_updated_at();

-- 잠금·전이 방어선 (Route는 `where status = 기대값` 조건부 update로 경합을 409 처리한다)
create or replace function private.quick_requests_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('approved', 'cancelled') then
    raise exception using
      errcode = 'P0001',
      message = 'quick_request_locked',
      detail = '완료되었거나 취소된 요청은 변경할 수 없습니다.';
  end if;

  if new.id <> old.id
     or new.request_no <> old.request_no
     or new.request_year <> old.request_year
     or new.request_seq <> old.request_seq
     or new.requester_user_id <> old.requester_user_id then
    raise exception using errcode = 'P0001', message = 'quick_request_immutable_field';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'requested' and new.status in ('dispatching', 'cancelled'))
    or (old.status = 'dispatching' and new.status in ('dispatched', 'cancelled'))
    or (old.status = 'dispatched' and new.status in ('approved', 'cancelled'))
  ) then
    raise exception using errcode = 'P0001', message = 'quick_request_invalid_transition';
  end if;

  return new;
end;
$$;

revoke all on function private.quick_requests_guard_update() from public, anon, authenticated;

drop trigger if exists trg_quick_requests_guard_update on public.quick_requests;
create trigger trg_quick_requests_guard_update
  before update on public.quick_requests
  for each row execute function private.quick_requests_guard_update();

-- ---------------------------------------------------------------------------
-- 4. 오픈채팅 webhook 발송 기록 (이벤트당 1행 · 다시 보내기는 같은 행 갱신)
-- ---------------------------------------------------------------------------
create table if not exists public.quick_request_openchat_dispatches (
  id bigint generated always as identity primary key,
  quick_request_id uuid not null references public.quick_requests (id) on delete cascade,
  event text not null check (event in ('created', 'accepted', 'dispatched', 'cancelled')),
  status text not null check (status in ('sent', 'failed', 'not_configured')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  http_status integer null,
  error_message text null check (error_message is null or char_length(error_message) <= 500),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  last_attempt_at timestamptz null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quick_request_openchat_dispatches_request_event_key unique (quick_request_id, event)
);
comment on table public.quick_request_openchat_dispatches is
  '퀵 요청 오픈채팅 webhook 발송 기록 (payload = 재전송 원본). 쓰기는 service_role 전용. plan 89';

drop trigger if exists trg_quick_request_openchat_dispatches_updated_at on public.quick_request_openchat_dispatches;
create trigger trg_quick_request_openchat_dispatches_updated_at
  before update on public.quick_request_openchat_dispatches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. 요청번호 · 생성 RPC (service_role 전용)
-- ---------------------------------------------------------------------------
-- 순번 9 → '2026-09', 10 → '2026-10', 100 → '2026-100' (lpad는 자리를 자르므로 쓰지 않는다)
create or replace function public.format_quick_request_no(p_year integer, p_seq integer)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select p_year::text || '-' ||
    case when p_seq < 10 then '0' || p_seq::text else p_seq::text end;
$$;

create or replace function public.create_quick_request(p_requester uuid, p_payload jsonb)
returns public.quick_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_year integer;
  v_seq integer;
  v_row public.quick_requests;
begin
  if p_requester is null then
    raise exception using errcode = '22023', message = 'p_requester is required';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'p_payload must be a json object';
  end if;

  select p.full_name, p.phone, p.status, p.affiliation
    into v_profile
  from public.profiles p
  where p.user_id = p_requester;

  if not found or v_profile.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'quick_request_requester_inactive';
  end if;
  if v_profile.affiliation = 'dongbang' then
    raise exception using errcode = 'P0001', message = 'quick_request_requester_forbidden';
  end if;

  -- KST 연도 · counter 행 upsert(행 잠금)로 순번을 원자적으로 발급
  v_year := extract(year from (now() at time zone 'Asia/Seoul'))::integer;
  insert into public.quick_request_counters as c (year, last_seq)
  values (v_year, 1)
  on conflict (year) do update set last_seq = c.last_seq + 1
  returning c.last_seq into v_seq;

  insert into public.quick_requests (
    request_no, request_year, request_seq, status,
    requester_user_id, requester_name, requester_phone,
    goods_size, item_description, vehicle_types, vehicle_other_text, vehicle_count,
    freight_payment, origin, stopovers, destination
  ) values (
    public.format_quick_request_no(v_year, v_seq), v_year, v_seq, 'requested',
    p_requester,
    coalesce(nullif(btrim(v_profile.full_name), ''), '이름 없음'),
    case when v_profile.phone ~ '^\d{11}$' then v_profile.phone else null end,
    p_payload ->> 'goodsSize',
    coalesce(p_payload ->> 'itemDescription', ''),
    array(select jsonb_array_elements_text(p_payload -> 'vehicleTypes')),
    nullif(btrim(coalesce(p_payload ->> 'vehicleOtherText', '')), ''),
    (p_payload ->> 'vehicleCount')::integer,
    p_payload ->> 'freightPayment',
    p_payload -> 'origin',
    coalesce(p_payload -> 'stopovers', '[]'::jsonb),
    p_payload -> 'destination'
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.format_quick_request_no(integer, integer) from public, anon, authenticated;
grant execute on function public.format_quick_request_no(integer, integer) to service_role;
revoke all on function public.create_quick_request(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_quick_request(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 6. RLS (SELECT only) · 권한
-- ---------------------------------------------------------------------------
alter table public.quick_request_counters enable row level security;
alter table public.quick_requests enable row level security;
alter table public.quick_request_openchat_dispatches enable row level security;

drop policy if exists quick_requests_select on public.quick_requests;
create policy quick_requests_select
  on public.quick_requests
  for select
  to authenticated
  using (
    requester_user_id = (select auth.uid())
    or private.can_view_all_quick_requests((select auth.uid()))
  );

drop policy if exists quick_request_openchat_dispatches_select on public.quick_request_openchat_dispatches;
create policy quick_request_openchat_dispatches_select
  on public.quick_request_openchat_dispatches
  for select
  to authenticated
  using (private.can_view_all_quick_requests((select auth.uid())));

revoke all on public.quick_request_counters from anon, authenticated;
revoke all on public.quick_requests from anon, authenticated;
revoke all on public.quick_request_openchat_dispatches from anon, authenticated;
grant select on public.quick_requests to authenticated;
grant select on public.quick_request_openchat_dispatches to authenticated;
grant all on public.quick_request_counters to service_role;
grant all on public.quick_requests to service_role;
grant all on public.quick_request_openchat_dispatches to service_role;

-- ---------------------------------------------------------------------------
-- 7. notifications.type CHECK (적용 시점 dev 정의 28종 전부 + 퀵 2종)
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'user.approval_request_admin',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'contract.import_admin',
      'contract.import_author',
      'wallet.sync_admin',
      'wallet.sync_recipient',
      'wallet.balance_email',
      'wallet.balance_email_admin',
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created',
      'benefit.import_operations',
      'benefit.import_applicant',
      'benefit.document_cancel_operations',
      'benefit.document_cancel_applicant',
      'benefit.document_restore_operations',
      'benefit.document_restore_applicant',
      'workflow.approval_requested',
      'workflow.referrer_requested',
      'workflow.completed',
      'workflow.declined',
      'workflow.canceled',
      'workflow.comment_created',
      'quick_request.vendor_event',
      'quick_request.requester_event'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. 공지 직접 조회에서 동방특송 제외 (plan 39 정책 true → not dongbang)
-- ---------------------------------------------------------------------------
drop policy if exists announcements_authenticated_select on public.announcements;
create policy announcements_authenticated_select
  on public.announcements
  for select
  to authenticated
  using (not private.is_dongbang_user((select auth.uid())));

drop policy if exists announcement_attachments_authenticated_select on public.announcement_attachments;
create policy announcement_attachments_authenticated_select
  on public.announcement_attachments
  for select
  to authenticated
  using (not private.is_dongbang_user((select auth.uid())));

drop policy if exists announcement_attachments_storage_authenticated_select on storage.objects;
create policy announcement_attachments_storage_authenticated_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'announcement-attachments'
    and not private.is_dongbang_user((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- down (수동 롤백 · dongbang 사용자 0명일 때만 CHECK 원복 가능)
-- ---------------------------------------------------------------------------
-- (공지 정책 3개를 using (true) / using (bucket_id = 'announcement-attachments')로 재생성)
-- drop function if exists public.create_quick_request(uuid, jsonb);
-- drop function if exists public.format_quick_request_no(integer, integer);
-- drop table if exists public.quick_request_openchat_dispatches, public.quick_requests, public.quick_request_counters;
-- drop function if exists private.quick_requests_guard_update();
-- drop function if exists private.can_view_all_quick_requests(uuid);
-- drop function if exists private.is_dongbang_user(uuid);
-- notifications_type_check / profiles_affiliation_check 를 이전 목록으로 재정의
