-- 2026-10-27: plan 95 — 워크플로우 양식 4테이블 SELECT 정책에 동방특송 제외 조건 추가 (D-8 RLS 감사 결과)
-- File: 94_dongbang_visibility_rls.sql
-- Plan: 95_dongbang-visibility-audit-plan.md (D-8 · AC-10 · 감사표 S-12)
-- Date: 2026-10-27
-- Status: Completed
-- Remote migration: 94_dongbang_visibility_rls — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: Dev `pg_policies` 감사 — `qual = 'true'` SELECT 정책 0건. 단, authenticated 전체 허용에 준하는 SELECT 정책 4개가
--          워크플로우 양식 테이블에 있었다(SQL 86): workflow_template_default_approvers · workflow_template_default_referrers
--          (`auth.uid() is not null`) · workflow_templates(`is_active and (not only_visible_for_admin or is_workflow_admin)`) ·
--          workflow_template_fields(templates 가시성 cascade). 동방특송은 전자결재 allowlist 밖(89)이지만 세션 클라이언트로 읽으면
--          양식·기본 결재선이 보였으므로 4개 정책에 `and not private.is_dongbang_user((select auth.uid()))`를 추가한다.
--          그 밖 SELECT 정책은 본인/admin/문서 가시성 함수(`workflow_can_view_document`·`can_view_quick_request`)로 이미 제한됨.
--          퀵·알림·프로필·push 테이블은 대상 아님(동방 허용 범위). 적용 전 동방 세션(Dev · execute_sql `set local role authenticated`):
--          templates 1 · fields 15 · approvers 0 · referrers 0 행 → 적용 후 전부 0행(approvers·referrers는 Dev에 데이터 0건이라 정책만 확인).

-- ---------------------------------------------------------------------------
-- 1) workflow_templates — SQL 86 조건 + 동방 제외
-- ---------------------------------------------------------------------------
drop policy if exists workflow_templates_select on public.workflow_templates;
create policy workflow_templates_select on public.workflow_templates
  for select to authenticated
  using (
    is_active
    and (not only_visible_for_admin or (select private.is_workflow_admin((select auth.uid()))))
    and not private.is_dongbang_user((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 2) workflow_template_fields — templates cascade + 명시 제외
-- ---------------------------------------------------------------------------
drop policy if exists workflow_template_fields_select on public.workflow_template_fields;
create policy workflow_template_fields_select on public.workflow_template_fields
  for select to authenticated
  using (
    exists (select 1 from public.workflow_templates t where t.id = template_id)
    and not private.is_dongbang_user((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 3) workflow_template_default_approvers / 4) _referrers — 로그인 전원 → 동방 제외
-- ---------------------------------------------------------------------------
drop policy if exists workflow_template_default_approvers_select on public.workflow_template_default_approvers;
create policy workflow_template_default_approvers_select on public.workflow_template_default_approvers
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and not private.is_dongbang_user((select auth.uid()))
  );

drop policy if exists workflow_template_default_referrers_select on public.workflow_template_default_referrers;
create policy workflow_template_default_referrers_select on public.workflow_template_default_referrers
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and not private.is_dongbang_user((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- down (수동 롤백) — SQL 86 L366~387 정책 4개를 그대로 다시 만든다
-- ---------------------------------------------------------------------------
-- drop policy if exists workflow_templates_select on public.workflow_templates;
-- create policy workflow_templates_select on public.workflow_templates for select to authenticated
--   using (is_active and (not only_visible_for_admin or (select private.is_workflow_admin((select auth.uid())))));
-- drop policy if exists workflow_template_fields_select on public.workflow_template_fields;
-- create policy workflow_template_fields_select on public.workflow_template_fields for select to authenticated
--   using (exists (select 1 from public.workflow_templates t where t.id = template_id));
-- drop policy if exists workflow_template_default_approvers_select on public.workflow_template_default_approvers;
-- create policy workflow_template_default_approvers_select on public.workflow_template_default_approvers for select to authenticated
--   using ((select auth.uid()) is not null);
-- drop policy if exists workflow_template_default_referrers_select on public.workflow_template_default_referrers;
-- create policy workflow_template_default_referrers_select on public.workflow_template_default_referrers for select to authenticated
--   using ((select auth.uid()) is not null);
