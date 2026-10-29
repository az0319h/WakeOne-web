-- 2026-10-28: plan 98 — 퀵 대화 파일 첨부 (비공개 버킷 · pending → 메시지 연결 · RLS SELECT · RPC 확장 · 본문 빈 값 허용)
-- File: 96_quick_chat_attachments.sql
-- Plan: 98_quick-chat-attachments-plan.md (D-1 · D-2 · D-3 · D-4 · AC-15)
-- Date: 2026-10-28
-- Status: Completed
-- Remote migration: 96_quick_chat_attachments — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary:
--   1) storage.buckets `quick-chat-attachments` — public=false · file_size_limit 10485760 · allowed_mime_types (D-1 MIME + octet-stream)
--      storage.objects 정책 없음(authenticated 0건) — 업로드·보기·다운로드 전부 service_role 서명 URL 경유 (AC-15)
--   2) quick_request_message_attachments — bigint identity · message_id null = pending(prepare만 됨) · uploader · storage_path unique
--      · file_name 1~255 · file_size 1~10MiB · mime_type · extension `^[a-z0-9]{1,8}$` · kind image|file · expires_at(pending 24h)
--      · linked_at(메시지 연결 시각) · created_at. 요청 건·메시지 삭제 시 cascade
--      인덱스: (message_id) · (quick_request_id) · pending 고아 (expires_at) where message_id is null
--   3) RLS SELECT: 연결된 행만(message_id not null) + private.can_view_quick_request. 쓰기는 service_role 전용(authenticated revoke)
--   4) quick_request_messages_body_check — `char_length(btrim(body)) between 1 and 1000` → `char_length(body) <= 1000`
--      (빈 본문은 RPC가 「첨부 ≥ 1」로 검증)
--   5) create_quick_request_message(p_request, p_author, p_author_name, p_author_role, p_body, p_attachment_ids bigint[] default '{}')
--      — 5인자 버전 drop(오버로드 모호성 방지) · 본문 ''+첨부 0 → `quick_request_message_empty` · insert → pending 행을
--      (id ∈ ids ∧ message_id null ∧ uploader = author ∧ request 일치) 조건으로 연결 · 갱신 행 수 ≠ distinct id 수 → `quick_request_attachment_mismatch`(롤백)
--      · 그 밖(잠금 없음 · 읽음 위치 갱신)은 SQL 93 4 그대로
-- 롤백:
--   drop function if exists public.create_quick_request_message(uuid, uuid, text, text, text, bigint[]);
--   create_quick_request_message는 93_quick_realtime_broadcast_chat_unlock.sql 4 본문(5인자)으로 복원 + grant to service_role
--   alter table public.quick_request_messages drop constraint quick_request_messages_body_check;
--   alter table public.quick_request_messages add constraint quick_request_messages_body_check check (char_length(btrim(body)) between 1 and 1000);
--     (빈 본문 메시지가 이미 있으면 먼저 삭제)
--   drop table if exists public.quick_request_message_attachments;
--   버킷: delete from storage.objects where bucket_id = 'quick-chat-attachments'; delete from storage.buckets where id = 'quick-chat-attachments';

-- ---------------------------------------------------------------------------
-- 1. Storage 버킷 (비공개 · 10MiB · MIME allowlist) — storage.objects 정책은 만들지 않는다 (service_role 서명 URL만)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quick-chat-attachments',
  'quick-chat-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/x-hwp',
    'application/haansofthwp',
    'application/vnd.hancom.hwp',
    'application/vnd.hancom.hwpx',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.quick_request_message_attachments (
  id bigint generated always as identity primary key,
  quick_request_id uuid not null references public.quick_requests (id) on delete cascade,
  -- null = pending (prepare만 됨 · 전송 전). 메시지 연결 후에는 메시지와 수명을 같이한다
  message_id bigint null references public.quick_request_messages (id) on delete cascade,
  uploader_user_id uuid not null references auth.users (id) on delete restrict,
  storage_path text not null unique check (char_length(storage_path) between 1 and 512),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size bigint not null check (file_size between 1 and 10485760),
  mime_type text not null check (char_length(mime_type) between 1 and 255),
  extension text not null check (extension ~ '^[a-z0-9]{1,8}$'),
  kind text not null check (kind in ('image', 'file')),
  -- pending 만료(24h) · 연결되면 null (정리 cron은 후속 plan)
  expires_at timestamptz null,
  linked_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint quick_request_message_attachments_link_state_check
    check ((message_id is null and linked_at is null) or (message_id is not null and linked_at is not null and expires_at is null))
);
comment on table public.quick_request_message_attachments is
  '퀵 대화 메시지 첨부. message_id null = pending(prepare만). 파일명·storage_path는 activity_logs·알림에 저장 금지. 쓰기는 service_role 전용(prepare Route · create_quick_request_message). plan 98';

create index if not exists idx_qrma_message
  on public.quick_request_message_attachments (message_id);
create index if not exists idx_qrma_request
  on public.quick_request_message_attachments (quick_request_id, id);
-- 고아 pending (후속 정리 cron · cleanup 스크립트)
create index if not exists idx_qrma_pending_expires
  on public.quick_request_message_attachments (expires_at)
  where message_id is null;

-- ---------------------------------------------------------------------------
-- 3. RLS — 연결된 첨부만, 그 건을 볼 수 있는 사람. 쓰기는 service_role
-- ---------------------------------------------------------------------------
alter table public.quick_request_message_attachments enable row level security;

drop policy if exists quick_request_message_attachments_select on public.quick_request_message_attachments;
create policy quick_request_message_attachments_select on public.quick_request_message_attachments
  for select to authenticated
  using (
    message_id is not null
    and private.can_view_quick_request((select auth.uid()), quick_request_id)
  );

revoke all on public.quick_request_message_attachments from anon, authenticated;
grant select on public.quick_request_message_attachments to authenticated;
grant all on public.quick_request_message_attachments to service_role;

-- ---------------------------------------------------------------------------
-- 4. 본문 CHECK 완화 — 빈 본문 허용(첨부만 메시지). 길이 상한 1,000은 유지
-- ---------------------------------------------------------------------------
alter table public.quick_request_messages drop constraint if exists quick_request_messages_body_check;
alter table public.quick_request_messages
  add constraint quick_request_messages_body_check check (char_length(body) <= 1000);

-- ---------------------------------------------------------------------------
-- 5. RPC — p_attachment_ids 추가 (5인자 버전 drop → 6인자 default '{}')
-- ---------------------------------------------------------------------------
drop function if exists public.create_quick_request_message(uuid, uuid, text, text, text);

create or replace function public.create_quick_request_message(
  p_request uuid,
  p_author uuid,
  p_author_name text,
  p_author_role text,
  p_body text,
  p_attachment_ids bigint[] default '{}'
)
returns public.quick_request_messages
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_row public.quick_request_messages;
  v_body text := btrim(coalesce(p_body, ''));
  v_ids bigint[] := (select coalesce(array_agg(distinct x), '{}'::bigint[]) from unnest(coalesce(p_attachment_ids, '{}'::bigint[])) as x);
  v_expected integer := cardinality(v_ids);
  v_linked integer;
begin
  select q.status into v_status
  from public.quick_requests q
  where q.id = p_request
  for update;

  if v_status is null then
    raise exception using errcode = 'P0002', message = 'quick_request_not_found';
  end if;

  -- plan 94 D-12: approved/cancelled 잠금 검사 없음 — 채팅은 상태와 무관하게 계속된다

  -- plan 98 D-2: 본문 없이 첨부만 허용. 둘 다 없으면 거부
  if v_body = '' and v_expected = 0 then
    raise exception using errcode = 'P0001', message = 'quick_request_message_empty';
  end if;

  insert into public.quick_request_messages (quick_request_id, author_user_id, author_name, author_role, body)
  values (p_request, p_author, p_author_name, p_author_role, v_body)
  returning * into v_row;

  -- plan 98 D-4: pending 첨부 연결 — 소유·건 일치·pending 조건을 한 문장으로. 하나라도 빠지면 롤백
  if v_expected > 0 then
    update public.quick_request_message_attachments a
      set message_id = v_row.id,
          linked_at = now(),
          expires_at = null
    where a.id = any (v_ids)
      and a.message_id is null
      and a.uploader_user_id = p_author
      and a.quick_request_id = p_request;
    get diagnostics v_linked = row_count;

    if v_linked <> v_expected then
      raise exception using errcode = 'P0001', message = 'quick_request_attachment_mismatch';
    end if;
  end if;

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

revoke all on function public.create_quick_request_message(uuid, uuid, text, text, text, bigint[]) from public, anon, authenticated;
grant execute on function public.create_quick_request_message(uuid, uuid, text, text, text, bigint[]) to service_role;
