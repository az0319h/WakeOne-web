-- 2026-10-21: plan 88 — 워크플로우(전자결재) 1단계 코어 스키마 · RLS · 열람 함수 · bucket · notifications CHECK
-- File: 86_workflow_core.sql
-- Plan: 88_workflow-expense-plan.md
-- Date: 2026-10-21
-- Status: Completed
-- Remote migration: 86_workflow_core — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: workflow_* 14 테이블(양식·입력칸·기본 결재선·문서·단계·승인자·참조자·참조문서·이벤트·첨부·임시저장·중요·카운터·관리자)
--          private.is_workflow_admin / private.workflow_can_view_document (SECURITY DEFINER, 비노출 schema)
--          RLS SELECT only (열람 = 작성자 OR 결재선 actor OR 참조자 OR 워크플로우 관리자). anon/authenticated 쓰기 권한 0.
--          Storage bucket workflow-attachments(private, 20MB). notifications.type CHECK += workflow.* 6종(기존 22종 유지).

-- ---------------------------------------------------------------------------
-- 0. private schema (PostgREST 비노출 — RLS helper 전용)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. 워크플로우 관리자
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_admins (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.workflow_admins is
  '워크플로우 관리자 지정 (시스템 관리자는 행 없이도 관리자). plan 88';

-- ---------------------------------------------------------------------------
-- 2. 양식 · 입력칸 · 기본 결재선
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique
    check (template_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 5000),
  emoji text not null default '📄' check (char_length(emoji) <= 16),
  content_default text not null default '',
  content_visible boolean not null default true,
  attachment_visible boolean not null default true,
  attachment_required boolean not null default false,
  attachment_required_when jsonb,
  only_visible_for_admin boolean not null default false,
  edit_policy text not null default 'AUTHOR_AND_APPROVER'
    check (edit_policy in ('AUTHOR_AND_APPROVER', 'AUTHOR_ONLY')),
  approval_step_edit_enabled boolean not null default true,
  display_order integer not null default 0,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_templates_attachment_required_when_shape check (
    attachment_required_when is null
    or (jsonb_typeof(attachment_required_when -> 'field_key') = 'string'
        and jsonb_typeof(attachment_required_when -> 'in') = 'array')
  )
);
comment on table public.workflow_templates is '워크플로우 양식 (공통 틀). plan 88';

create table if not exists public.workflow_template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_templates (id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{0,49}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  type text not null
    check (type in ('STRING', 'DATE', 'SELECT', 'MULTISELECT', 'AMOUNT_OF_MONEY', 'TASK_REFERENCE')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  required_when jsonb,
  prefill_type text not null default 'NONE' check (prefill_type in ('NONE', 'DEFAULT', 'NAME')),
  prefill_default text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint workflow_template_fields_key unique (template_id, field_key),
  constraint workflow_template_fields_required_when_shape check (
    required_when is null
    or (jsonb_typeof(required_when -> 'field_key') = 'string'
        and jsonb_typeof(required_when -> 'in') = 'array')
  )
);
comment on column public.workflow_template_fields.required_when is
  '조건부 필수 {"field_key": "<다른 필드>", "in": ["값", ...]} — 판정은 src/features/workflow/lib/required-rules.ts (클라·서버 공용)';
create index if not exists idx_workflow_template_fields_template
  on public.workflow_template_fields (template_id, display_order);

create table if not exists public.workflow_template_default_approvers (
  template_id uuid not null references public.workflow_templates (id) on delete cascade,
  step integer not null check (step >= 1),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (template_id, user_id)
);
create index if not exists idx_workflow_template_default_approvers_user
  on public.workflow_template_default_approvers (user_id);

create table if not exists public.workflow_template_default_referrers (
  template_id uuid not null references public.workflow_templates (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  notification_setting text not null default 'START_AND_END'
    check (notification_setting in ('START_AND_END', 'END', 'NONE')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (template_id, user_id)
);
create index if not exists idx_workflow_template_default_referrers_user
  on public.workflow_template_default_referrers (user_id);

-- ---------------------------------------------------------------------------
-- 3. 문서 번호 카운터 (연도별, RPC 안에서만 잠금·증가)
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_document_counters (
  year integer primary key check (year between 2000 and 9999),
  last_no integer not null default 0 check (last_no >= 0)
);

-- ---------------------------------------------------------------------------
-- 4. 문서 · 결재 단계 · 승인자 · 참조자 · 참조문서 · 이벤트
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_documents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^\d{4}-\d{4,}$'),
  template_id uuid not null references public.workflow_templates (id) on delete restrict,
  template_key text not null,
  template_snapshot jsonb not null,
  title text not null check (char_length(title) <= 200),
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS', 'DONE', 'DECLINED', 'CANCELED')),
  writer_id uuid not null references public.profiles (user_id) on delete cascade,
  inputs jsonb not null default '[]'::jsonb check (jsonb_typeof(inputs) = 'array'),
  content_html text not null default '' check (char_length(content_html) <= 200000),
  search_text text not null default '',
  current_step integer not null default 1 check (current_step >= 1),
  total_steps integer not null default 1 check (total_steps >= 1),
  edit_policy text not null default 'AUTHOR_AND_APPROVER'
    check (edit_policy in ('AUTHOR_AND_APPROVER', 'AUTHOR_ONLY')),
  approval_step_edit_enabled boolean not null default true,
  written_at timestamptz not null default now(),
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.workflow_documents is
  '워크플로우 문서. template_snapshot = 제출 시점 양식 정의. 쓰기는 service_role RPC 전용. plan 88';
create index if not exists idx_workflow_documents_writer on public.workflow_documents (writer_id);
create index if not exists idx_workflow_documents_status_updated
  on public.workflow_documents (status, updated_at desc);
create index if not exists idx_workflow_documents_updated on public.workflow_documents (updated_at desc, id);
create index if not exists idx_workflow_documents_written on public.workflow_documents (written_at desc, id);
create index if not exists idx_workflow_documents_template on public.workflow_documents (template_id);

create table if not exists public.workflow_approval_steps (
  document_id uuid not null references public.workflow_documents (id) on delete cascade,
  step integer not null check (step >= 1),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ONGOING', 'APPROVED', 'DECLINED')),
  primary key (document_id, step)
);

create table if not exists public.workflow_approval_actors (
  document_id uuid not null references public.workflow_documents (id) on delete cascade,
  step integer not null check (step >= 1),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  status text not null default 'WAITING' check (status in ('WAITING', 'APPROVED', 'DECLINED')),
  position integer not null default 0,
  acted_at timestamptz,
  opinion text check (opinion is null or char_length(opinion) <= 2000),
  primary key (document_id, user_id)
);
create index if not exists idx_workflow_approval_actors_user
  on public.workflow_approval_actors (user_id, status);
create index if not exists idx_workflow_approval_actors_doc_step
  on public.workflow_approval_actors (document_id, step);

create table if not exists public.workflow_document_referrers (
  document_id uuid not null references public.workflow_documents (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  notification_setting text not null default 'START_AND_END'
    check (notification_setting in ('START_AND_END', 'END', 'NONE')),
  position integer not null default 0,
  primary key (document_id, user_id)
);
create index if not exists idx_workflow_document_referrers_user
  on public.workflow_document_referrers (user_id);

create table if not exists public.workflow_document_references (
  document_id uuid not null references public.workflow_documents (id) on delete cascade,
  referenced_document_id uuid not null references public.workflow_documents (id) on delete cascade,
  position integer not null default 0,
  primary key (document_id, referenced_document_id),
  check (document_id <> referenced_document_id)
);
create index if not exists idx_workflow_document_references_ref
  on public.workflow_document_references (referenced_document_id);

create table if not exists public.workflow_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.workflow_documents (id) on delete cascade,
  type text not null
    check (type in ('WRITE', 'CHANGE_STAGE_STAKE_HOLDERS', 'APPROVE', 'DECLINE', 'CANCEL', 'UPDATE', 'COMMENT')),
  actor_id uuid references public.profiles (user_id) on delete set null,
  content text check (content is null or char_length(content) <= 2000),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists idx_workflow_document_events_doc
  on public.workflow_document_events (document_id, created_at);
create index if not exists idx_workflow_document_events_actor
  on public.workflow_document_events (actor_id);

-- ---------------------------------------------------------------------------
-- 5. 임시저장 · 첨부 · 사용자별 상태(중요)
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_drafts (
  id uuid primary key default gen_random_uuid(),
  writer_id uuid not null references public.profiles (user_id) on delete cascade,
  template_id uuid not null references public.workflow_templates (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_workflow_drafts_writer on public.workflow_drafts (writer_id, updated_at desc);
create index if not exists idx_workflow_drafts_template on public.workflow_drafts (template_id);

create table if not exists public.workflow_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (user_id) on delete cascade,
  document_id uuid references public.workflow_documents (id) on delete cascade,
  draft_id uuid references public.workflow_drafts (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 512),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text check (mime_type is null or char_length(mime_type) <= 255),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 20971520),
  status text not null default 'staged' check (status in ('staged', 'bound')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workflow_attachments_single_parent check (document_id is null or draft_id is null),
  constraint workflow_attachments_bound_has_document check ((status = 'bound') = (document_id is not null))
);
create index if not exists idx_workflow_attachments_document on public.workflow_attachments (document_id);
create index if not exists idx_workflow_attachments_draft on public.workflow_attachments (draft_id);
create index if not exists idx_workflow_attachments_owner on public.workflow_attachments (owner_user_id, status);

create table if not exists public.workflow_document_user_states (
  document_id uuid not null references public.workflow_documents (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  starred boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (document_id, user_id)
);
create index if not exists idx_workflow_document_user_states_user
  on public.workflow_document_user_states (user_id) where starred;

-- updated_at triggers
drop trigger if exists trg_workflow_templates_updated_at on public.workflow_templates;
create trigger trg_workflow_templates_updated_at
  before update on public.workflow_templates
  for each row execute function public.set_updated_at();

drop trigger if exists trg_workflow_drafts_updated_at on public.workflow_drafts;
create trigger trg_workflow_drafts_updated_at
  before update on public.workflow_drafts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. 열람 판정 함수 (private, SECURITY DEFINER — RLS 재귀 방지)
-- ---------------------------------------------------------------------------
create or replace function private.is_workflow_admin(p_uid uuid)
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
        or exists (select 1 from public.workflow_admins w where w.user_id = p_uid)
      )
  );
$$;

create or replace function private.workflow_can_view_document(p_document_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null and p_document_id is not null and (
    exists (
      select 1 from public.workflow_documents d
      where d.id = p_document_id and d.writer_id = p_uid
    )
    or exists (
      select 1 from public.workflow_approval_actors a
      where a.document_id = p_document_id and a.user_id = p_uid
    )
    or exists (
      select 1 from public.workflow_document_referrers r
      where r.document_id = p_document_id and r.user_id = p_uid
    )
    or (
      exists (select 1 from public.workflow_documents d2 where d2.id = p_document_id)
      and private.is_workflow_admin(p_uid)
    )
  );
$$;

revoke all on function private.is_workflow_admin(uuid) from public, anon;
revoke all on function private.workflow_can_view_document(uuid, uuid) from public, anon;
grant execute on function private.is_workflow_admin(uuid) to authenticated, service_role;
grant execute on function private.workflow_can_view_document(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. RLS (SELECT only) + 권한
-- ---------------------------------------------------------------------------
alter table public.workflow_admins enable row level security;
alter table public.workflow_templates enable row level security;
alter table public.workflow_template_fields enable row level security;
alter table public.workflow_template_default_approvers enable row level security;
alter table public.workflow_template_default_referrers enable row level security;
alter table public.workflow_document_counters enable row level security;
alter table public.workflow_documents enable row level security;
alter table public.workflow_approval_steps enable row level security;
alter table public.workflow_approval_actors enable row level security;
alter table public.workflow_document_referrers enable row level security;
alter table public.workflow_document_references enable row level security;
alter table public.workflow_document_events enable row level security;
alter table public.workflow_drafts enable row level security;
alter table public.workflow_attachments enable row level security;
alter table public.workflow_document_user_states enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'workflow_admins', 'workflow_templates', 'workflow_template_fields',
    'workflow_template_default_approvers', 'workflow_template_default_referrers',
    'workflow_document_counters', 'workflow_documents', 'workflow_approval_steps',
    'workflow_approval_actors', 'workflow_document_referrers', 'workflow_document_references',
    'workflow_document_events', 'workflow_drafts', 'workflow_attachments',
    'workflow_document_user_states'
  ] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    if t <> 'workflow_document_counters' then
      execute format('grant select on table public.%I to authenticated', t);
    end if;
  end loop;
end $$;

drop policy if exists workflow_admins_select on public.workflow_admins;
create policy workflow_admins_select on public.workflow_admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_system_admin()));

drop policy if exists workflow_templates_select on public.workflow_templates;
create policy workflow_templates_select on public.workflow_templates
  for select to authenticated
  using (
    is_active
    and (not only_visible_for_admin or (select private.is_workflow_admin((select auth.uid()))))
  );

drop policy if exists workflow_template_fields_select on public.workflow_template_fields;
create policy workflow_template_fields_select on public.workflow_template_fields
  for select to authenticated
  using (exists (select 1 from public.workflow_templates t where t.id = template_id));

drop policy if exists workflow_template_default_approvers_select on public.workflow_template_default_approvers;
create policy workflow_template_default_approvers_select on public.workflow_template_default_approvers
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists workflow_template_default_referrers_select on public.workflow_template_default_referrers;
create policy workflow_template_default_referrers_select on public.workflow_template_default_referrers
  for select to authenticated
  using ((select auth.uid()) is not null);

-- counters: SELECT 정책 없음 (RLS on → authenticated 0행)

drop policy if exists workflow_documents_select on public.workflow_documents;
create policy workflow_documents_select on public.workflow_documents
  for select to authenticated
  using (private.workflow_can_view_document(id, (select auth.uid())));

drop policy if exists workflow_approval_steps_select on public.workflow_approval_steps;
create policy workflow_approval_steps_select on public.workflow_approval_steps
  for select to authenticated
  using (private.workflow_can_view_document(document_id, (select auth.uid())));

drop policy if exists workflow_approval_actors_select on public.workflow_approval_actors;
create policy workflow_approval_actors_select on public.workflow_approval_actors
  for select to authenticated
  using (private.workflow_can_view_document(document_id, (select auth.uid())));

drop policy if exists workflow_document_referrers_select on public.workflow_document_referrers;
create policy workflow_document_referrers_select on public.workflow_document_referrers
  for select to authenticated
  using (private.workflow_can_view_document(document_id, (select auth.uid())));

drop policy if exists workflow_document_references_select on public.workflow_document_references;
create policy workflow_document_references_select on public.workflow_document_references
  for select to authenticated
  using (private.workflow_can_view_document(document_id, (select auth.uid())));

drop policy if exists workflow_document_events_select on public.workflow_document_events;
create policy workflow_document_events_select on public.workflow_document_events
  for select to authenticated
  using (private.workflow_can_view_document(document_id, (select auth.uid())));

drop policy if exists workflow_drafts_select on public.workflow_drafts;
create policy workflow_drafts_select on public.workflow_drafts
  for select to authenticated
  using (writer_id = (select auth.uid()));

drop policy if exists workflow_attachments_select on public.workflow_attachments;
create policy workflow_attachments_select on public.workflow_attachments
  for select to authenticated
  using (
    deleted_at is null
    and (
      (status = 'bound' and private.workflow_can_view_document(document_id, (select auth.uid())))
      or (status = 'staged' and owner_user_id = (select auth.uid()))
    )
  );

drop policy if exists workflow_document_user_states_select on public.workflow_document_user_states;
create policy workflow_document_user_states_select on public.workflow_document_user_states
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and private.workflow_can_view_document(document_id, (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 8. Storage bucket (비공개 · 20MB). 객체 접근은 service role + signed URL만 (storage policy 없음)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('workflow-attachments', 'workflow-attachments', false, 20971520)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- ---------------------------------------------------------------------------
-- 9. notifications.type CHECK — 기존 22종 유지 + workflow.* 6종
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_type_check;

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
      'workflow.comment_created'
    )
  );
