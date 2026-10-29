-- 2026-10-28: plan 101 — 퀵 대화 초대 참여자 (테이블 · can_view_quick_request 확장 · quick_requests SELECT 정책 · unread/대화 목록 RPC 범위 · author_role participant · Broadcast 트리거 참여자 topic)
-- File: 97_quick_request_participants.sql
-- Plan: 101_quick-chat-participants-plan.md (D-2 · D-3 · D-10 · D-11 · AC-16) — plan 문서의 「SQL 98」은 번호 당겨짐(96 다음 = 97)
-- Date: 2026-10-28
-- Status: Completed
-- Remote migration: 97_quick_request_participants — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
--   r1 2026-10-28: §7 트리거 함수 보정(중첩 if) → dev `97_quick_request_participants_r1_broadcast_fix`로 §7 함수만 재적용. 이 파일은 보정 후 본문(Main에는 이 파일 1회 적용)
-- Summary:
--   1) quick_request_participants — bigint identity · (quick_request_id, user_id) unique · invited_by · invited_at · removed_at(null = 활성) · removed_by
--      soft 제외 · 재초대는 같은 행 복구(removed_at null · invited_at 갱신 — service 레이어). 요청 건 삭제 시 cascade
--      인덱스: (user_id) where removed_at is null (대시보드 「참여 건」 서브쿼리) · (quick_request_id)
--      RLS SELECT: private.can_view_quick_request. 쓰기는 service_role 전용(authenticated revoke)
--   2) private.is_quick_request_participant(p_uid, p_request_id) — 활성(removed_at null) 참여자 여부 · SECURITY DEFINER(private · RLS 재귀 방지)
--   3) private.can_view_quick_request — 기존(요청자 OR viewer-all) OR 활성 참여자. 메시지·읽음·첨부·realtime.messages 정책이 모두 이 함수를 쓰므로
--      참여자는 자동으로 대화·첨부·`quick-request:{id}` topic 권한을 얻는다(별도 정책 변경 없음)
--   4) quick_requests_select 정책 — 요청자 OR viewer-all OR 활성 참여자 (SQL 89 L307 교체)
--   5) quick_request_messages_author_role_check — ('requester','dongbang','admin','participant')
--   6) quick_request_unread_total · quick_request_unread_requests — 범위에 `or private.is_quick_request_participant(p_user, q.id)`
--      quick_request_conversations_page — visible CTE에 참여 건 포함 (p_view_all or 요청자 or 참여자). quick_request_last_messages는 범위 조건이 없어 그대로
--   7) private.quick_realtime_broadcast — (a) quick_request_participants INSERT/UPDATE도 처리 (request_id = new.quick_request_id)
--      (b) 모든 테이블에서 활성 참여자마다 `quick-user:{participant}` topic에도 송신 (94 D-3 topic은 요청자 기준이라 참여자 대시보드 갱신용)
--      (c) participants 행 자체의 user_id에게도 송신(제외된 사람 화면이 다음 refetch에서 404를 받도록)
--      트리거 quick_request_participants_broadcast (after insert or update)
-- 롤백:
--   drop trigger if exists quick_request_participants_broadcast on public.quick_request_participants;
--   private.quick_realtime_broadcast() → 93_quick_realtime_broadcast_chat_unlock.sql 2 본문
--   quick_request_conversations_page → 95_quick_period_recent_address_phone.sql 4 본문 · unread_total/unread_requests → 92_quick_request_messages.sql 본문
--   alter table public.quick_request_messages drop constraint quick_request_messages_author_role_check;
--   alter table public.quick_request_messages add constraint quick_request_messages_author_role_check check (author_role in ('requester','dongbang','admin'));
--     (participant 메시지가 이미 있으면 먼저 삭제)
--   drop policy quick_requests_select on public.quick_requests; → 89 본문(요청자 OR can_view_all_quick_requests)
--   private.can_view_quick_request → 92_quick_request_messages.sql 본문 (요청자 OR can_view_all)
--   drop function if exists private.is_quick_request_participant(uuid, uuid);
--   drop table if exists public.quick_request_participants;

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.quick_request_participants (
  id bigint generated always as identity primary key,
  quick_request_id uuid not null references public.quick_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  invited_at timestamptz not null default now(),
  removed_at timestamptz null,
  removed_by uuid null references auth.users(id) on delete set null,
  constraint quick_request_participants_request_user_key unique (quick_request_id, user_id)
);

comment on table public.quick_request_participants is
  'plan 101 — 퀵 대화 초대 참여자. removed_at null = 활성. 요청자·동방·admin은 규칙으로 계산하며 여기에 넣지 않는다';

create index if not exists idx_qrp_user_active
  on public.quick_request_participants (user_id)
  where removed_at is null;

create index if not exists idx_qrp_request
  on public.quick_request_participants (quick_request_id);

alter table public.quick_request_participants enable row level security;

revoke all on public.quick_request_participants from anon, authenticated;
grant select on public.quick_request_participants to authenticated;
grant all on public.quick_request_participants to service_role;

-- ---------------------------------------------------------------------------
-- 2. 활성 참여자 판정 (정책·RPC·can_view 공용)
-- ---------------------------------------------------------------------------
create or replace function private.is_quick_request_participant(p_uid uuid, p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null and p_request_id is not null and exists (
    select 1
    from public.quick_request_participants p
    where p.quick_request_id = p_request_id
      and p.user_id = p_uid
      and p.removed_at is null
  );
$$;

revoke all on function private.is_quick_request_participant(uuid, uuid) from public;
grant execute on function private.is_quick_request_participant(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. can_view_quick_request — 요청자 OR viewer-all OR 활성 참여자
-- ---------------------------------------------------------------------------
create or replace function private.can_view_quick_request(p_uid uuid, p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null and p_request_id is not null and exists (
    select 1
    from public.quick_requests q
    where q.id = p_request_id
      and (
        q.requester_user_id = p_uid
        or private.can_view_all_quick_requests(p_uid)
        or private.is_quick_request_participant(p_uid, q.id)
      )
  );
$$;

-- 참여자 테이블 RLS SELECT (can_view가 참여자를 포함하므로 자기 참여 건의 명단을 볼 수 있다)
drop policy if exists quick_request_participants_select on public.quick_request_participants;
create policy quick_request_participants_select
  on public.quick_request_participants
  for select
  to authenticated
  using (private.can_view_quick_request((select auth.uid()), quick_request_id));

-- ---------------------------------------------------------------------------
-- 4. quick_requests SELECT 정책 — 참여자 포함
-- ---------------------------------------------------------------------------
drop policy if exists quick_requests_select on public.quick_requests;
create policy quick_requests_select
  on public.quick_requests
  for select
  to authenticated
  using (
    requester_user_id = (select auth.uid())
    or private.can_view_all_quick_requests((select auth.uid()))
    or private.is_quick_request_participant((select auth.uid()), id)
  );

-- ---------------------------------------------------------------------------
-- 5. author_role CHECK — participant 추가
-- ---------------------------------------------------------------------------
alter table public.quick_request_messages drop constraint if exists quick_request_messages_author_role_check;
alter table public.quick_request_messages
  add constraint quick_request_messages_author_role_check
  check (author_role in ('requester', 'dongbang', 'admin', 'participant'));

-- ---------------------------------------------------------------------------
-- 6. unread RPC 2종 · 대화 목록 RPC — 범위에 참여 건 포함
-- ---------------------------------------------------------------------------
create or replace function public.quick_request_unread_total(p_user uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(count(*), 0)::integer
  from public.quick_request_messages m
  join public.quick_requests q on q.id = m.quick_request_id
  left join public.quick_request_message_reads r
    on r.user_id = p_user and r.quick_request_id = m.quick_request_id
  where (
      q.requester_user_id = p_user
      or private.can_view_all_quick_requests(p_user)
      or private.is_quick_request_participant(p_user, q.id)
    )
    and q.requested_at >= now() - interval '90 days'
    and m.author_user_id <> p_user
    and m.id > coalesce(r.last_read_message_id, 0);
$$;

create or replace function public.quick_request_unread_requests(p_user uuid)
returns table (quick_request_id uuid, unread_count integer)
language sql
stable
set search_path = ''
as $$
  select m.quick_request_id, count(*)::integer
  from public.quick_request_messages m
  join public.quick_requests q on q.id = m.quick_request_id
  left join public.quick_request_message_reads r
    on r.user_id = p_user and r.quick_request_id = m.quick_request_id
  where (
      q.requester_user_id = p_user
      or private.can_view_all_quick_requests(p_user)
      or private.is_quick_request_participant(p_user, q.id)
    )
    and q.requested_at >= now() - interval '90 days'
    and m.author_user_id <> p_user
    and m.id > coalesce(r.last_read_message_id, 0)
  group by m.quick_request_id;
$$;

-- 95 4 본문 + visible CTE에 참여 건 (그 밖은 그대로)
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
set search_path = ''
as $$
  with visible as (
    select q.id, q.requested_at, q.search_text
    from public.quick_requests q
    where (
      p_view_all
      or q.requester_user_id = p_user
      or exists (
        select 1
        from public.quick_request_participants p
        where p.quick_request_id = q.id
          and p.user_id = p_user
          and p.removed_at is null
      )
    )
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

-- ---------------------------------------------------------------------------
-- 7. Broadcast 트리거 — participants 테이블 + 활성 참여자 quick-user topic
-- ---------------------------------------------------------------------------
create or replace function private.quick_realtime_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_requester uuid;
  v_payload jsonb;
  v_user uuid;
begin
  begin
    if tg_table_name = 'quick_requests' then
      v_request_id := new.id;
      v_requester := new.requester_user_id;
    else
      v_request_id := new.quick_request_id;
      select q.requester_user_id into v_requester
      from public.quick_requests q
      where q.id = v_request_id;
    end if;

    if v_request_id is null then
      return null;
    end if;

    -- payload는 invalidate 신호로만 쓴다 (record/old_record 없음 → topic 권한이 유일한 벽이어도 본문이 새지 않는다)
    v_payload := jsonb_build_object(
      'table', tg_table_name,
      'op', tg_op,
      'request_id', v_request_id
    );

    perform realtime.send(v_payload, tg_op, 'quick-request:' || v_request_id::text, true);
    if v_requester is not null then
      perform realtime.send(v_payload, tg_op, 'quick-user:' || v_requester::text, true);
    end if;
    perform realtime.send(v_payload, tg_op, 'quick-requests:all', true);

    -- plan 101 — 활성 초대 참여자마다 quick-user topic (대시보드·사이드바 배지 갱신 · 건당 소수)
    for v_user in
      select p.user_id
      from public.quick_request_participants p
      where p.quick_request_id = v_request_id
        and p.removed_at is null
        and (v_requester is null or p.user_id <> v_requester)
    loop
      perform realtime.send(v_payload, tg_op, 'quick-user:' || v_user::text, true);
    end loop;

    -- 제외된 사람(removed_at 설정 행)에게도 1회 — 열려 있는 화면이 다음 refetch에서 404를 받도록
    -- r1: 중첩 if — PL/pgSQL은 and 식 전체를 한 번에 평가하므로 다른 테이블 행에서 `new.removed_at` 참조가 예외를 냈다(실시간 전면 중단 · 2026-10-28 frontend-dev 발견)
    if tg_table_name = 'quick_request_participants' then
      if new.removed_at is not null then
        perform realtime.send(v_payload, tg_op, 'quick-user:' || new.user_id::text, true);
      end if;
    end if;
  exception
    when others then
      -- Broadcast 실패가 업무 쓰기를 막지 않는다
      raise warning 'quick_realtime_broadcast failed: %', sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function private.quick_realtime_broadcast() from public;

drop trigger if exists quick_request_participants_broadcast on public.quick_request_participants;
create trigger quick_request_participants_broadcast
  after insert or update on public.quick_request_participants
  for each row execute function private.quick_realtime_broadcast();
