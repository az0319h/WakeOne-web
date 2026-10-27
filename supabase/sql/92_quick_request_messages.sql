-- 2026-10-27: plan 93 — 퀵 요청 건별 실시간 대화 · 사용자별 읽음 위치 · 안 읽은 수 RPC · Realtime publication · 알림 type 추가
-- File: 92_quick_request_messages.sql
-- Plan: 93_quick-request-chat-plan.md (r3)
-- Date: 2026-10-27
-- Status: Completed
-- Remote migration: 92_quick_request_messages — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: quick_request_messages (bigint identity · 작성자 이름·역할 스냅샷 · body 1~1000 · 수정/삭제 없음)
--          quick_request_message_reads (user_id, quick_request_id) PK · last_read_message_id 뒤로 가지 않음(greatest)
--          private.can_view_quick_request(uid, request_id) — 요청자 본인 OR viewer-all (SECURITY DEFINER · 비노출 schema)
--          RLS SELECT only(두 테이블 모두 그 건을 볼 수 있는 사람) · 쓰기는 service_role 전용(Route 경유)
--          RPC(service_role 전용 · SECURITY INVOKER): create_quick_request_message(잠금 검사 + insert + 보낸 사람 읽음 위치 갱신 1트랜잭션)
--            · mark_quick_request_messages_read(greatest) · quick_request_unread_counts(건 목록) · quick_request_unread_requests(안 읽은 건 전체 · 90일)
--            · quick_request_unread_total(합계 · 90일) · quick_request_last_messages(건별 마지막 메시지)
--          alter publication supabase_realtime add table quick_request_messages · quick_request_message_reads
--          notifications_type_check: 기존 30종 전부 보존 + quick_request.chat_message (31종)
-- 롤백: alter publication supabase_realtime drop table public.quick_request_messages, public.quick_request_message_reads;
--       drop function public.quick_request_last_messages, public.quick_request_unread_total, public.quick_request_unread_requests,
--                     public.quick_request_unread_counts, public.mark_quick_request_messages_read, public.create_quick_request_message;
--       drop table public.quick_request_message_reads, public.quick_request_messages; drop function private.can_view_quick_request;
--       notifications_type_check에서 quick_request.chat_message 제거(해당 알림 0건일 때)

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.quick_request_messages (
  id bigint generated always as identity primary key,
  quick_request_id uuid not null references public.quick_requests (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete restrict,
  author_name text not null check (char_length(author_name) between 1 and 100),
  author_role text not null check (author_role in ('requester', 'dongbang', 'admin')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
comment on table public.quick_request_messages is
  '퀵 요청 건별 대화. 수정·삭제 없음. 본문은 개인정보 — activity_logs에 저장 금지. 쓰기는 service_role 전용(create_quick_request_message). plan 93';

create index if not exists idx_qrm_request_id
  on public.quick_request_messages (quick_request_id, id);
create index if not exists idx_qrm_request_author
  on public.quick_request_messages (quick_request_id, author_user_id);
create index if not exists idx_qrm_author_user_id
  on public.quick_request_messages (author_user_id);

create table if not exists public.quick_request_message_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  quick_request_id uuid not null references public.quick_requests (id) on delete cascade,
  last_read_message_id bigint not null default 0 check (last_read_message_id >= 0),
  last_read_at timestamptz not null default now(),
  primary key (user_id, quick_request_id)
);
comment on table public.quick_request_message_reads is
  '사용자별 대화 읽음 위치(안 읽은 수·✓✓ 표시). 뒤로 가지 않음(greatest). 본문 없음. plan 93';

create index if not exists idx_qrmr_request
  on public.quick_request_message_reads (quick_request_id);

-- ---------------------------------------------------------------------------
-- 2. 조회 판정 (private · SECURITY DEFINER — RLS 재귀 방지 · 89 can_view_all_quick_requests 재사용)
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
      and (q.requester_user_id = p_uid or private.can_view_all_quick_requests(p_uid))
  );
$$;

revoke all on function private.can_view_quick_request(uuid, uuid) from public, anon;
grant execute on function private.can_view_quick_request(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RLS (SELECT만 · 쓰기는 service_role)
-- ---------------------------------------------------------------------------
alter table public.quick_request_messages enable row level security;
alter table public.quick_request_message_reads enable row level security;

drop policy if exists quick_request_messages_select on public.quick_request_messages;
create policy quick_request_messages_select on public.quick_request_messages
  for select to authenticated
  using (private.can_view_quick_request((select auth.uid()), quick_request_id));

-- 읽음 위치는 그 건을 볼 수 있는 사람끼리 공유(✓✓ 표시·Realtime). 본문 없음
drop policy if exists quick_request_message_reads_select on public.quick_request_message_reads;
create policy quick_request_message_reads_select on public.quick_request_message_reads
  for select to authenticated
  using (private.can_view_quick_request((select auth.uid()), quick_request_id));

revoke all on public.quick_request_messages from anon, authenticated;
revoke all on public.quick_request_message_reads from anon, authenticated;
grant select on public.quick_request_messages to authenticated;
grant select on public.quick_request_message_reads to authenticated;
grant all on public.quick_request_messages to service_role;
grant all on public.quick_request_message_reads to service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC (service_role 전용 · SECURITY INVOKER · Route가 세션 uid를 넘긴다)
-- ---------------------------------------------------------------------------

-- 4-1. 메시지 작성: 잠금(approved/cancelled) 검사 + insert + 보낸 사람 읽음 위치 갱신을 한 트랜잭션으로
create or replace function public.create_quick_request_message(
  p_request uuid,
  p_author uuid,
  p_author_name text,
  p_author_role text,
  p_body text
)
returns public.quick_request_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_row public.quick_request_messages;
begin
  select q.status into v_status
  from public.quick_requests q
  where q.id = p_request
  for update;

  if v_status is null then
    raise exception using errcode = 'P0002', message = 'quick_request_not_found';
  end if;

  if v_status in ('approved', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'quick_request_locked';
  end if;

  insert into public.quick_request_messages (quick_request_id, author_user_id, author_name, author_role, body)
  values (p_request, p_author, p_author_name, p_author_role, btrim(p_body))
  returning * into v_row;

  insert into public.quick_request_message_reads (user_id, quick_request_id, last_read_message_id, last_read_at)
  values (p_author, p_request, v_row.id, now())
  on conflict (user_id, quick_request_id) do update
    set last_read_message_id = greatest(public.quick_request_message_reads.last_read_message_id, excluded.last_read_message_id),
        last_read_at = case
          when excluded.last_read_message_id > public.quick_request_message_reads.last_read_message_id then now()
          else public.quick_request_message_reads.last_read_at
        end;

  return v_row;
end;
$$;

-- 4-2. 읽음 위치 갱신 (뒤로 가지 않음)
create or replace function public.mark_quick_request_messages_read(
  p_user uuid,
  p_request uuid,
  p_message_id bigint
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  insert into public.quick_request_message_reads (user_id, quick_request_id, last_read_message_id, last_read_at)
  values (p_user, p_request, greatest(p_message_id, 0), now())
  on conflict (user_id, quick_request_id) do update
    set last_read_message_id = greatest(public.quick_request_message_reads.last_read_message_id, excluded.last_read_message_id),
        last_read_at = case
          when excluded.last_read_message_id > public.quick_request_message_reads.last_read_message_id then now()
          else public.quick_request_message_reads.last_read_at
        end
  returning last_read_message_id;
$$;

-- 4-3. 안 읽은 수 (지정한 건 목록 · 대시보드 페이지 행)
create or replace function public.quick_request_unread_counts(p_user uuid, p_request_ids uuid[])
returns table (quick_request_id uuid, unread_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.quick_request_id, count(*)::integer
  from public.quick_request_messages m
  left join public.quick_request_message_reads r
    on r.user_id = p_user and r.quick_request_id = m.quick_request_id
  where m.quick_request_id = any (p_request_ids)
    and m.author_user_id <> p_user
    and m.id > coalesce(r.last_read_message_id, 0)
  group by m.quick_request_id;
$$;

-- 4-4. 안 읽은 메시지가 있는 건 전체 (내가 볼 수 있는 건 · 90일 상한) — 대화 목록 「7일 + 안 읽음 있는 건」
create or replace function public.quick_request_unread_requests(p_user uuid)
returns table (quick_request_id uuid, unread_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.quick_request_id, count(*)::integer
  from public.quick_request_messages m
  join public.quick_requests q on q.id = m.quick_request_id
  left join public.quick_request_message_reads r
    on r.user_id = p_user and r.quick_request_id = m.quick_request_id
  where (q.requester_user_id = p_user or private.can_view_all_quick_requests(p_user))
    and q.requested_at >= now() - interval '90 days'
    and m.author_user_id <> p_user
    and m.id > coalesce(r.last_read_message_id, 0)
  group by m.quick_request_id;
$$;

-- 4-5. 사이드바 배지: 내가 볼 수 있는 모든 건의 안 읽은 합계 (90일 상한 [INFERRED])
create or replace function public.quick_request_unread_total(p_user uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(count(*), 0)::integer
  from public.quick_request_messages m
  join public.quick_requests q on q.id = m.quick_request_id
  left join public.quick_request_message_reads r
    on r.user_id = p_user and r.quick_request_id = m.quick_request_id
  where (q.requester_user_id = p_user or private.can_view_all_quick_requests(p_user))
    and q.requested_at >= now() - interval '90 days'
    and m.author_user_id <> p_user
    and m.id > coalesce(r.last_read_message_id, 0);
$$;

-- 4-6. 건별 마지막 메시지 (대화 목록 미리보기)
create or replace function public.quick_request_last_messages(p_request_ids uuid[])
returns table (
  quick_request_id uuid,
  id bigint,
  author_user_id uuid,
  author_name text,
  author_role text,
  body text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (m.quick_request_id)
    m.quick_request_id, m.id, m.author_user_id, m.author_name, m.author_role, m.body, m.created_at
  from public.quick_request_messages m
  where m.quick_request_id = any (p_request_ids)
  order by m.quick_request_id, m.id desc;
$$;

revoke all on function public.create_quick_request_message(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_quick_request_messages_read(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.quick_request_unread_counts(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.quick_request_unread_requests(uuid) from public, anon, authenticated;
revoke all on function public.quick_request_unread_total(uuid) from public, anon, authenticated;
revoke all on function public.quick_request_last_messages(uuid[]) from public, anon, authenticated;
grant execute on function public.create_quick_request_message(uuid, uuid, text, text, text) to service_role;
grant execute on function public.mark_quick_request_messages_read(uuid, uuid, bigint) to service_role;
grant execute on function public.quick_request_unread_counts(uuid, uuid[]) to service_role;
grant execute on function public.quick_request_unread_requests(uuid) to service_role;
grant execute on function public.quick_request_unread_total(uuid) to service_role;
grant execute on function public.quick_request_last_messages(uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Realtime publication (RLS SELECT가 그대로 적용된다)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quick_request_messages'
  ) then
    alter publication supabase_realtime add table public.quick_request_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quick_request_message_reads'
  ) then
    alter publication supabase_realtime add table public.quick_request_message_reads;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. notifications_type_check — 적용 시점 dev 목록(30종, 2026-10-27 SELECT로 확인) 전부 보존 + quick_request.chat_message
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
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
    'quick_request.requester_event',
    'quick_request.chat_message'
  ]::text[]));
