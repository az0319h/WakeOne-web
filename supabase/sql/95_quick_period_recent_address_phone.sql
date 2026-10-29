-- 2026-10-28: plan 97 — 퀵 기간 필터·DB 페이지네이션 · 최근 주소 출발/도착 분리 · 전화번호 9~11자리
-- File: 95_quick_period_recent_address_phone.sql
-- Plan: 97_quick-period-filter-recent-address-split-phone-plan.md (D-3 · D-5 · D-8 · D-9 · D-10 · OQ-1)
-- Date: 2026-10-28
-- Status: Completed
-- Remote migration: 95_quick_period_recent_address_phone — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary:
--   1) quick_request_recent_addresses — 기존 행 전부 삭제(사용자 결정 Q3 · dev 4행) → `direction` not null check('origin'|'destination')
--      → unique (user_id, direction, road_address, detail_address) → 인덱스 (user_id, direction, last_used_at desc, id desc)
--      → RPC record_quick_request_recent_addresses: item.direction 필수 · dedupe (direction, 도로명, 상세) · **10개 prune 제거**(상한 없음)
--   2) 전화 9~11자리 — profiles_phone_format(not valid 유지) · quick_requests_requester_phone_check · quick_requests_driver_phone_check
--      · create_quick_request 스냅샷 조건 `^\d{9,11}$` (SQL 89 본문 그대로, 조건만 완화)
--   3) OQ-1 결정 — 경유지 검색은 RPC 대신 **stored generated column `quick_requests.search_text`**(요청번호·요청자·출발/경유/도착 도로명+상세
--      lower) + PostgREST `ilike` + `range()`/`count` 로 처리. 기존 메모리 검색(`matchesQuickRequestSearch`)과 같은 필드 범위
--   4) 「퀵 대화」 목록 커서 — RPC quick_request_conversations_page(기간 ∪ 안 읽음(90일) · 검색 · 탭 · keyset (has_message, sort_at, id) desc)
--      · service_role 전용 · jsonb {items, total, unreadTotal}
-- 롤백(역순 · 삭제된 최근 주소 행은 복구 불가 · 사용자 승인):
--   drop function if exists public.quick_request_conversations_page(uuid, boolean, timestamptz, timestamptz, text, boolean, boolean, timestamptz, uuid, integer);
--   alter table public.quick_requests drop column if exists search_text; drop function if exists public.quick_request_search_text(text, text, jsonb, jsonb, jsonb);
--   전화 CHECK 3곳 11자리 고정 규칙(SQL 11·89 원본) 복원 · create_quick_request SQL 89 본문 · recent_addresses: drop index idx_qrra_user_dir_last_used,
--   drop constraint quick_request_recent_addresses_user_dir_address_key, drop column direction, unique (user_id, road_address, detail_address) 복원, RPC SQL 85 본문

-- ---------------------------------------------------------------------------
-- 1) 최근 주소 — direction 분리 · 상한 없음
-- ---------------------------------------------------------------------------
delete from public.quick_request_recent_addresses;

alter table public.quick_request_recent_addresses
  add column direction text not null
    constraint quick_request_recent_addresses_direction_check check (direction in ('origin', 'destination'));

alter table public.quick_request_recent_addresses
  drop constraint if exists quick_request_recent_addresses_user_address_key;

alter table public.quick_request_recent_addresses
  add constraint quick_request_recent_addresses_user_dir_address_key
    unique (user_id, direction, road_address, detail_address);

drop index if exists public.idx_quick_request_recent_addresses_user_last_used;

create index if not exists idx_qrra_user_dir_last_used
  on public.quick_request_recent_addresses (user_id, direction, last_used_at desc, id desc);

comment on column public.quick_request_recent_addresses.direction is
  'plan 97 — origin(출발 칸) | destination(경유·도착 칸). 목록은 direction별로 분리 조회';

comment on table public.quick_request_recent_addresses is
  'plan 87/97 — 사용자별 최근 이용 주소 (출발/도착 분리 · 상한 없음 · service_role RPC upsert만). 클라이언트 직접 INSERT 없음';

-- item: {direction, roadAddress, detailAddress, contactName, contactPhone} · upsert만 (prune 없음)
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

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e(value)
    where coalesce(e.value ->> 'direction', '') not in ('origin', 'destination')
  ) then
    raise exception using errcode = '22023', message = 'p_items[].direction must be origin or destination';
  end if;

  with items as (
    select
      e.value ->> 'direction' as direction,
      btrim(e.value ->> 'roadAddress') as road_address,
      btrim(e.value ->> 'detailAddress') as detail_address,
      btrim(e.value ->> 'contactName') as contact_name,
      btrim(e.value ->> 'contactPhone') as contact_phone,
      e.ordinality as ord
    from jsonb_array_elements(p_items) with ordinality as e(value, ordinality)
  ),
  deduped as (
    select distinct on (direction, road_address, detail_address)
      direction, road_address, detail_address, contact_name, contact_phone, ord
    from items
    order by direction, road_address, detail_address, ord
  ),
  upserted as (
    insert into public.quick_request_recent_addresses as t (
      user_id, direction, road_address, detail_address, contact_name, contact_phone, last_used_at
    )
    select
      p_user_id,
      d.direction,
      d.road_address,
      d.detail_address,
      d.contact_name,
      d.contact_phone,
      v_now - ((d.ord - 1) * interval '1 millisecond')
    from deduped d
    on conflict (user_id, direction, road_address, detail_address) do update
      set contact_name = excluded.contact_name,
          contact_phone = excluded.contact_phone,
          last_used_at = excluded.last_used_at
    returning 1
  )
  select count(*) into v_count from upserted;

  return v_count;
end;
$$;

revoke execute on function public.record_quick_request_recent_addresses(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_quick_request_recent_addresses(uuid, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2) 전화 9~11자리 — CHECK 3곳 + create_quick_request 스냅샷 조건
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles
  add constraint profiles_phone_format check (phone is null or phone ~ '^\d{9,11}$') not valid;

alter table public.quick_requests drop constraint if exists quick_requests_requester_phone_check;
alter table public.quick_requests
  add constraint quick_requests_requester_phone_check
    check (requester_phone is null or requester_phone ~ '^\d{9,11}$');

alter table public.quick_requests drop constraint if exists quick_requests_driver_phone_check;
alter table public.quick_requests
  add constraint quick_requests_driver_phone_check
    check (driver_phone is null or driver_phone ~ '^\d{9,11}$');

-- SQL 89 본문 그대로 · 요청자 연락처 스냅샷 조건만 완화
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
    case when v_profile.phone ~ '^\d{9,11}$' then v_profile.phone else null end,
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

-- ---------------------------------------------------------------------------
-- 3) OQ-1 — 검색용 generated column (요청번호 · 요청자 · 출발/경유/도착 도로명+상세 · lower)
--    PostgREST `search_text=ilike.%keyword%` + `range()` + `count:'exact'` 로 DB 페이지네이션 (경유지 포함)
-- ---------------------------------------------------------------------------
create or replace function public.quick_request_search_text(
  p_request_no text,
  p_requester_name text,
  p_origin jsonb,
  p_stopovers jsonb,
  p_destination jsonb
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(concat_ws(
    e'\n',
    p_request_no,
    p_requester_name,
    p_origin ->> 'roadAddress',
    p_origin ->> 'detailAddress',
    (
      select string_agg(concat_ws(e'\n', s.value ->> 'roadAddress', s.value ->> 'detailAddress'), e'\n' order by s.ordinality)
      from jsonb_array_elements(
        case when jsonb_typeof(p_stopovers) = 'array' then p_stopovers else '[]'::jsonb end
      ) with ordinality as s(value, ordinality)
    ),
    p_destination ->> 'roadAddress',
    p_destination ->> 'detailAddress'
  ));
$$;

revoke execute on function public.quick_request_search_text(text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

alter table public.quick_requests
  add column if not exists search_text text
    generated always as (
      public.quick_request_search_text(request_no, requester_name, origin, stopovers, destination)
    ) stored;

comment on column public.quick_requests.search_text is
  'plan 97 OQ-1 — 목록 검색용 (요청번호·요청자·출발/경유/도착 도로명+상세 · lower). generated stored · 응답에는 내보내지 않는다';

-- ---------------------------------------------------------------------------
-- 4) 「퀵 대화」 목록 커서 페이지 (D-5)
--    집합 = (기간 안 건) ∪ (안 읽은 메시지 있는 건 · 90일 · 사이드바와 동일) · 검색 · 탭(unread) · 정렬 (has_message desc, sort_at desc, id desc)
--    cursor = 직전 페이지 마지막 행의 (has_message, sort_at, id). totals는 탭 무관(검색 적용 후)
-- ---------------------------------------------------------------------------
create or replace function public.quick_request_conversations_page(
  p_user uuid,
  p_view_all boolean,
  p_from timestamptz,
  p_to timestamptz,
  p_q text,
  p_unread_only boolean,
  p_cursor_has_message boolean,
  p_cursor_sort_at timestamptz,
  p_cursor_id uuid,
  p_limit integer
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with visible as (
    select q.id, q.requested_at, q.search_text
    from public.quick_requests q
    where (p_view_all or q.requester_user_id = p_user)
  ),
  unread as (
    select m.quick_request_id, count(*)::integer as unread_count
    from public.quick_request_messages m
    join visible v on v.id = m.quick_request_id
    left join public.quick_request_message_reads r
      on r.user_id = p_user and r.quick_request_id = m.quick_request_id
    where v.requested_at >= now() - interval '90 days'
      and m.author_user_id <> p_user
      and m.id > coalesce(r.last_read_message_id, 0)
    group by m.quick_request_id
  ),
  candidates as (
    select v.id, v.requested_at, coalesce(u.unread_count, 0) as unread_count
    from visible v
    left join unread u on u.quick_request_id = v.id
    where (
        ((p_from is null or v.requested_at >= p_from) and (p_to is null or v.requested_at < p_to))
        or u.unread_count > 0
      )
      and (
        p_q is null or p_q = ''
        or v.search_text like '%' || replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
  ),
  last_message as (
    select distinct on (m.quick_request_id)
      m.quick_request_id, m.id, m.author_name, m.author_role, m.body, m.created_at
    from public.quick_request_messages m
    join candidates c on c.id = m.quick_request_id
    order by m.quick_request_id, m.id desc
  ),
  ranked as (
    select
      c.id,
      (l.id is not null) as has_message,
      coalesce(l.created_at, c.requested_at) as sort_at,
      l.id as last_message_id,
      l.author_name as last_author_name,
      l.author_role as last_author_role,
      l.body as last_body,
      l.created_at as last_created_at,
      c.unread_count
    from candidates c
    left join last_message l on l.quick_request_id = c.id
  ),
  page as (
    select *
    from ranked r
    where (not p_unread_only or r.unread_count > 0)
      and (
        p_cursor_sort_at is null
        or (r.has_message, r.sort_at, r.id) < (coalesce(p_cursor_has_message, false), p_cursor_sort_at, p_cursor_id)
      )
    order by r.has_message desc, r.sort_at desc, r.id desc
    limit greatest(coalesce(p_limit, 20), 1) + 1
  )
  select jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.has_message desc, p.sort_at desc, p.id desc) from page p),
      '[]'::jsonb
    ),
    'total', (select count(*) from ranked),
    'unreadTotal', (select count(*) from ranked where unread_count > 0)
  );
$$;

revoke all on function public.quick_request_conversations_page(uuid, boolean, timestamptz, timestamptz, text, boolean, boolean, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.quick_request_conversations_page(uuid, boolean, timestamptz, timestamptz, text, boolean, boolean, timestamptz, uuid, integer)
  to service_role;
