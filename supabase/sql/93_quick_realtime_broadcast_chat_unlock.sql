-- 2026-10-27: plan 94 — 퀵 3테이블 변경을 private Broadcast topic 3종으로 송신(트리거 · realtime.send · 최소 payload) · realtime.messages 정책 · 채팅 잠금 제거
-- File: 93_quick_realtime_broadcast_chat_unlock.sql
-- Plan: 94_quick-realtime-and-small-fixes-plan.md (D-3 · D-5 · D-12)
-- Date: 2026-10-27
-- Status: Completed
-- Remote migration: 93_quick_realtime_broadcast_chat_unlock — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: private.quick_realtime_topic_request_id(text) — `quick-request:{uuid}` topic → uuid (형식 불일치 null · 정책에서 캐스팅 오류 방지)
--          private.quick_realtime_broadcast() — SECURITY DEFINER 트리거 함수. quick_requests INSERT/UPDATE · quick_request_messages INSERT ·
--            quick_request_message_reads INSERT/UPDATE 1행마다 realtime.send(최소 payload {table, op, request_id} · 본문 미전송 · private=true)를
--            topic 3종에 보낸다: quick-request:{request_id} · quick-user:{requester_user_id} · quick-requests:all. 예외는 삼킨다(업무 쓰기 보호)
--          트리거 3: quick_requests_broadcast · quick_request_messages_broadcast · quick_request_message_reads_broadcast
--          realtime.messages 정책: quick_realtime_messages_select(SELECT · 구독 권한 · topic별 private.can_view_quick_request / 본인 uid / can_view_all)
--            + quick_realtime_messages_insert(INSERT · 「입력 중…」 클라이언트 broadcast를 같은 quick-request:{id} 채널로 통합 · D-5)
--          create_quick_request_message — approved/cancelled 잠금(`quick_request_locked`) 검사 제거 (D-12 · 채팅은 잠그지 않는다). 그 밖은 SQL 92 그대로
--          publication supabase_realtime(91·92)은 변경하지 않는다 (92 AC-22 · 93 AC-28 회귀 보존 · 제거는 후속)
-- 롤백: drop trigger quick_requests_broadcast on public.quick_requests;
--       drop trigger quick_request_messages_broadcast on public.quick_request_messages;
--       drop trigger quick_request_message_reads_broadcast on public.quick_request_message_reads;
--       drop function private.quick_realtime_broadcast(); drop function private.quick_realtime_topic_request_id(text);
--       drop policy quick_realtime_messages_select on realtime.messages; drop policy quick_realtime_messages_insert on realtime.messages;
--       create_quick_request_message는 92_quick_request_messages.sql 4-1 본문(잠금 검사 포함)으로 복원

-- ---------------------------------------------------------------------------
-- 1. topic → request_id (정책·트리거 공용 · 형식이 맞지 않으면 null)
-- ---------------------------------------------------------------------------
create or replace function private.quick_realtime_topic_request_id(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^quick-request:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then substring(p_topic from 15)::uuid
    else null
  end;
$$;

revoke all on function private.quick_realtime_topic_request_id(text) from public;
grant execute on function private.quick_realtime_topic_request_id(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Broadcast 트리거 함수 (D-3 · 최소 payload · 본문 미전송)
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
  exception
    when others then
      -- Broadcast 실패가 업무 쓰기를 막지 않는다
      raise warning 'quick_realtime_broadcast failed: %', sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function private.quick_realtime_broadcast() from public;

drop trigger if exists quick_requests_broadcast on public.quick_requests;
create trigger quick_requests_broadcast
  after insert or update on public.quick_requests
  for each row execute function private.quick_realtime_broadcast();

drop trigger if exists quick_request_messages_broadcast on public.quick_request_messages;
create trigger quick_request_messages_broadcast
  after insert on public.quick_request_messages
  for each row execute function private.quick_realtime_broadcast();

drop trigger if exists quick_request_message_reads_broadcast on public.quick_request_message_reads;
create trigger quick_request_message_reads_broadcast
  after insert or update on public.quick_request_message_reads
  for each row execute function private.quick_realtime_broadcast();

-- ---------------------------------------------------------------------------
-- 3. realtime.messages 정책 — private 채널 구독 권한 (topic별)
--    quick-request:{id}  → private.can_view_quick_request(uid, id)  (요청자 본인 OR viewer-all)
--    quick-user:{uid}    → 본인 uid만
--    quick-requests:all  → private.can_view_all_quick_requests(uid) (동방·admin·구매물류팀)
-- ---------------------------------------------------------------------------
drop policy if exists quick_realtime_messages_select on realtime.messages;
create policy quick_realtime_messages_select
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and (
      (
        (select realtime.topic()) like 'quick-request:%'
        and private.can_view_quick_request(
          (select auth.uid()),
          private.quick_realtime_topic_request_id((select realtime.topic()))
        )
      )
      or (select realtime.topic()) = 'quick-user:' || (select auth.uid())::text
      or (
        (select realtime.topic()) = 'quick-requests:all'
        and private.can_view_all_quick_requests((select auth.uid()))
      )
    )
  );

-- D-5 — 「입력 중…」 클라이언트 broadcast(typing)를 quick-request:{id} private 채널로 통합: 그 건을 볼 수 있는 사람만 송신
drop policy if exists quick_realtime_messages_insert on realtime.messages;
create policy quick_realtime_messages_insert
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension = 'broadcast'
    and (select realtime.topic()) like 'quick-request:%'
    and private.can_view_quick_request(
      (select auth.uid()),
      private.quick_realtime_topic_request_id((select realtime.topic()))
    )
  );

-- ---------------------------------------------------------------------------
-- 4. create_quick_request_message — 잠금 검사 제거 (D-12). 그 밖은 SQL 92 4-1 그대로
-- ---------------------------------------------------------------------------
create or replace function public.create_quick_request_message(
  p_request uuid,
  p_author uuid,
  p_author_name text,
  p_author_role text,
  p_body text
)
returns public.quick_request_messages
language plpgsql
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

  -- plan 94 D-12: approved/cancelled 잠금 검사 없음 — 채팅은 상태와 무관하게 계속된다

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
