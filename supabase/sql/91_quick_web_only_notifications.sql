-- 2026-10-26: plan 92 — 퀵 카카오톡(오픈채팅) 제거 · 웹 알림 일원화: 발송 기록 테이블 삭제 · quick_requests Realtime publication 추가
-- File: 91_quick_web_only_notifications.sql
-- Plan: 92_quick-web-only-notifications-plan.md
-- Date: 2026-10-26
-- Status: Completed
-- Remote migration: 91_quick_web_only_notifications — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: drop table quick_request_openchat_dispatches (trigger·policy·grant 함께 제거 · dev 0행 확인)
--          alter publication supabase_realtime add table quick_requests (D-7 · 대시보드·상세 실시간 갱신)
--          quick_requests RLS SELECT(요청자 본인 OR viewer-all)가 Realtime에도 그대로 적용 · replica identity 변경 없음
--          Main 적용 순서: 89 → 91 (D-10 · 사용자 수동). SQL 89 파일은 수정하지 않는다
-- 롤백: alter publication supabase_realtime drop table public.quick_requests;
--       (dispatches 테이블은 89_quick_requests_workflow.sql 186~206행·298~312행 블록으로 재생성)

drop table if exists public.quick_request_openchat_dispatches;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quick_requests'
  ) then
    alter publication supabase_realtime add table public.quick_requests;
  end if;
end $$;
