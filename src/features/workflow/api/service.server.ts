import 'server-only';

import {
  EXCLUDE_DONGBANG_OR_FILTER,
  getAffiliationLabel,
  type Affiliation
} from '@/features/users/constants/organization';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { WorkflowNotificationSetting } from '../lib/approval-line-rules';
import { inputItemsToValues } from '../lib/inputs';
import { computeWorkflowPermissions, type WorkflowDocumentStatus, type WorkflowEditPolicy } from '../lib/permissions';
import type { WorkflowRequiredWhen } from '../lib/required-rules';
import { buildWorkflowSummary } from '../lib/summary';
import type {
  WorkflowActorStatus,
  WorkflowAdmin,
  WorkflowAttachment,
  WorkflowCounts,
  WorkflowDefaultLine,
  WorkflowDocumentDetail,
  WorkflowDraftDetail,
  WorkflowDraftListItem,
  WorkflowDraftPayload,
  WorkflowEvent,
  WorkflowEventPayload,
  WorkflowEventType,
  WorkflowGroup,
  WorkflowListRow,
  WorkflowMember,
  WorkflowPersonSummary,
  WorkflowScope,
  WorkflowSort,
  WorkflowStepStatus,
  WorkflowTab,
  WorkflowTemplateDetail,
  WorkflowTemplateField,
  WorkflowTemplateListItem,
  WorkflowTemplateSnapshot
} from './types';

export const WORKFLOW_ATTACHMENT_BUCKET = 'workflow-attachments';
export const WORKFLOW_NOT_FOUND_MESSAGE = '문서를 찾을 수 없습니다.';

// ---------------------------------------------------------------------------
// RPC 오류 규약: 'WF{HTTP}:{문구}'
// ---------------------------------------------------------------------------
export class WorkflowRpcError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'WorkflowRpcError';
    this.status = status;
  }
}

export function toWorkflowRpcError(error: { message?: string } | null | undefined): WorkflowRpcError {
  const raw = error?.message ?? '';
  const match = /^WF(\d{3}):([\s\S]*)$/.exec(raw);
  if (match) {
    return new WorkflowRpcError(Number(match[1]), match[2].trim());
  }
  return new WorkflowRpcError(500, raw || '처리 중 오류가 발생했습니다.');
}

async function callWorkflowRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    throw toWorkflowRpcError(error);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// 구성원 (프로필은 RLS상 본인만 보이므로 service role로 표시 정보만 채운다)
// ---------------------------------------------------------------------------
const MEMBER_COLUMNS = 'user_id, full_name, email, avatar_url, affiliation, position_level, status';

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  affiliation: Affiliation | null;
  position_level: string | null;
  status: string;
};

function toMember(row: ProfileRow): WorkflowMember {
  return {
    user_id: row.user_id,
    full_name: row.full_name?.trim() || row.email,
    email: row.email,
    avatar_url: row.avatar_url,
    affiliation: row.affiliation,
    affiliation_label: getAffiliationLabel(row.affiliation),
    position_level: row.position_level,
    is_active: row.status === 'active'
  };
}

function unknownMember(userId: string): WorkflowMember {
  return {
    user_id: userId,
    full_name: '알 수 없음',
    email: '',
    avatar_url: null,
    affiliation: null,
    affiliation_label: null,
    position_level: null,
    is_active: false
  };
}

function toPerson(member: WorkflowMember): WorkflowPersonSummary {
  return { user_id: member.user_id, full_name: member.full_name, avatar_url: member.avatar_url };
}

export async function fetchMembersByIds(ids: Iterable<string>): Promise<Map<string, WorkflowMember>> {
  const unique = [...new Set([...ids].filter(Boolean))];
  const map = new Map<string, WorkflowMember>();
  if (unique.length === 0) return map;

  const supabase = getServiceRoleClient();
  for (let offset = 0; offset < unique.length; offset += 200) {
    const batch = unique.slice(offset, offset + 200);
    const { data, error } = await supabase.from('profiles').select(MEMBER_COLUMNS).in('user_id', batch);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as ProfileRow[]) {
      map.set(row.user_id, toMember(row));
    }
  }
  return map;
}

function memberOf(map: Map<string, WorkflowMember>, id: string): WorkflowMember {
  return map.get(id) ?? unknownMember(id);
}

/** 결재선 Combobox용 active 구성원 (plan 89 — 워크플로우에 접근할 수 없는 동방특송 제외) */
export async function listActiveMembers(): Promise<WorkflowMember[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(MEMBER_COLUMNS)
    .eq('status', 'active')
    .or(EXCLUDE_DONGBANG_OR_FILTER)
    .order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProfileRow[]).map(toMember);
}

// ---------------------------------------------------------------------------
// 양식
// ---------------------------------------------------------------------------
type TemplateRow = {
  id: string;
  template_key: string;
  name: string;
  description: string;
  emoji: string;
  content_default: string;
  content_visible: boolean;
  attachment_visible: boolean;
  attachment_required: boolean;
  attachment_required_when: WorkflowRequiredWhen | null;
  only_visible_for_admin: boolean;
  edit_policy: WorkflowEditPolicy;
  approval_step_edit_enabled: boolean;
  display_order: number;
  tags: string[] | null;
};

type FieldRow = {
  field_key: string;
  name: string;
  type: WorkflowTemplateField['type'];
  options: unknown;
  required: boolean;
  required_when: WorkflowRequiredWhen | null;
  prefill_type: WorkflowTemplateField['prefill_type'];
  prefill_default: string | null;
  display_order: number;
};

const TEMPLATE_COLUMNS =
  'id, template_key, name, description, emoji, content_default, content_visible, attachment_visible, attachment_required, attachment_required_when, only_visible_for_admin, edit_policy, approval_step_edit_enabled, display_order, tags';

function toField(row: FieldRow): WorkflowTemplateField {
  return {
    field_key: row.field_key,
    name: row.name,
    type: row.type,
    options: Array.isArray(row.options) ? row.options.filter((o): o is string => typeof o === 'string') : [],
    required: row.required,
    required_when: row.required_when ?? null,
    prefill_type: row.prefill_type,
    prefill_default: row.prefill_default,
    display_order: row.display_order
  };
}

function toTemplateListItem(row: TemplateRow): WorkflowTemplateListItem {
  return {
    id: row.id,
    template_key: row.template_key,
    name: row.name,
    emoji: row.emoji,
    tags: row.tags ?? [],
    display_order: row.display_order
  };
}

/** 작성 가능한 양식 (사용자 세션 RLS — 관리자 전용 양식은 관리자에게만) */
export async function listWorkflowTemplates(): Promise<WorkflowTemplateListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workflow_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TemplateRow[]).map(toTemplateListItem);
}

export type WorkflowTemplateDefinition = Omit<WorkflowTemplateDetail, 'default_line'>;

/**
 * 양식 정의 (필드 포함). via='session'이면 RLS(작성 가능 여부)로 읽고, 'service'면 관리자 설정용으로 읽는다.
 * 서버 검증은 항상 이 DB 정의를 쓴다(클라이언트가 보낸 규칙은 신뢰하지 않음).
 */
export async function getWorkflowTemplateDefinition(
  templateKey: string,
  via: 'session' | 'service' = 'session'
): Promise<WorkflowTemplateDefinition | null> {
  const supabase = via === 'session' ? await createClient() : getServiceRoleClient();
  const { data, error } = await supabase
    .from('workflow_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as TemplateRow;

  const { data: fields, error: fieldError } = await supabase
    .from('workflow_template_fields')
    .select('field_key, name, type, options, required, required_when, prefill_type, prefill_default, display_order')
    .eq('template_id', row.id)
    .order('display_order', { ascending: true });
  if (fieldError) throw new Error(fieldError.message);

  return {
    ...toTemplateListItem(row),
    description: row.description,
    content_default: row.content_default,
    content_visible: row.content_visible,
    attachment_visible: row.attachment_visible,
    attachment_required: row.attachment_required,
    attachment_required_when: row.attachment_required_when ?? null,
    only_visible_for_admin: row.only_visible_for_admin,
    edit_policy: row.edit_policy,
    approval_step_edit_enabled: row.approval_step_edit_enabled,
    fields: ((fields ?? []) as FieldRow[]).map(toField)
  };
}

export async function getWorkflowDefaultLine(templateId: string): Promise<WorkflowDefaultLine> {
  const supabase = await createClient();
  const [approvers, referrers] = await Promise.all([
    supabase
      .from('workflow_template_default_approvers')
      .select('step, user_id, position')
      .eq('template_id', templateId)
      .order('step', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from('workflow_template_default_referrers')
      .select('user_id, notification_setting, position')
      .eq('template_id', templateId)
      .order('position', { ascending: true })
  ]);
  if (approvers.error) throw new Error(approvers.error.message);
  if (referrers.error) throw new Error(referrers.error.message);

  const approverRows = (approvers.data ?? []) as { step: number; user_id: string }[];
  const referrerRows = (referrers.data ?? []) as {
    user_id: string;
    notification_setting: WorkflowNotificationSetting;
  }[];
  const members = await fetchMembersByIds([
    ...approverRows.map((r) => r.user_id),
    ...referrerRows.map((r) => r.user_id)
  ]);

  const stepMap = new Map<number, WorkflowMember[]>();
  for (const row of approverRows) {
    const list = stepMap.get(row.step) ?? [];
    list.push(memberOf(members, row.user_id));
    stepMap.set(row.step, list);
  }

  return {
    steps: [...stepMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, actors], index) => ({ step: index + 1, actors })),
    referrers: referrerRows.map((row) => ({
      member: memberOf(members, row.user_id),
      notification_setting: row.notification_setting
    }))
  };
}

export async function getWorkflowTemplateDetail(templateKey: string): Promise<WorkflowTemplateDetail | null> {
  const definition = await getWorkflowTemplateDefinition(templateKey, 'session');
  if (!definition) return null;
  return { ...definition, default_line: await getWorkflowDefaultLine(definition.id) };
}

// ---------------------------------------------------------------------------
// 문서 목록 · 건수 (사용자 세션 RLS — invoker 함수)
// ---------------------------------------------------------------------------
export type WorkflowListParams = {
  tab: WorkflowTab;
  scope: WorkflowScope;
  group: WorkflowGroup | null;
  q: string | null;
  writerIds: string[];
  templateKeys: string[];
  updatedFrom: string | null;
  updatedTo: string | null;
  sort: WorkflowSort;
  limit: number;
  offset: number;
  excludeId: string | null;
};

type ListRpcRow = {
  id: string;
  code: string;
  status: WorkflowDocumentStatus;
  current_step: number;
  total_steps: number;
  template_key: string;
  template_name: string;
  template_emoji: string;
  fields: WorkflowTemplateField[];
  inputs: { field_key: string; value: unknown }[];
  writer_id: string;
  written_at: string;
  updated_at: string;
  attachment_count: number;
  approver_ids: string[];
  approval_required: boolean;
  starred: boolean;
};

export async function listWorkflowDocuments(
  params: WorkflowListParams
): Promise<{ rows: WorkflowListRow[]; total: number; nextCursor: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('workflow_list_documents', {
    p_tab: params.tab,
    p_scope: params.scope,
    p_group: params.group,
    p_q: params.q,
    p_writer_ids: params.writerIds.length ? params.writerIds : null,
    p_template_keys: params.templateKeys.length ? params.templateKeys : null,
    p_updated_from: params.updatedFrom,
    p_updated_to: params.updatedTo,
    p_sort: params.sort,
    p_limit: params.limit,
    p_offset: params.offset,
    p_exclude_id: params.excludeId
  });
  if (error) throw new Error(error.message);

  const result = (data ?? { total: 0, rows: [] }) as { total: number; rows: ListRpcRow[] };
  const rows = result.rows ?? [];

  const memberIds = new Set<string>();
  for (const row of rows) {
    memberIds.add(row.writer_id);
    [...new Set(row.approver_ids)].slice(0, 3).forEach((id) => memberIds.add(id));
  }
  const members = await fetchMembersByIds(memberIds);

  const mapped: WorkflowListRow[] = rows.map((row) => {
    const approverIds = [...new Set(row.approver_ids ?? [])];
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      current_step: row.current_step,
      total_steps: row.total_steps,
      template: { key: row.template_key, name: row.template_name, emoji: row.template_emoji },
      writer: toPerson(memberOf(members, row.writer_id)),
      written_at: row.written_at,
      updated_at: row.updated_at,
      summary: buildWorkflowSummary(row.fields ?? [], inputItemsToValues(row.inputs)),
      attachment_count: Number(row.attachment_count) || 0,
      approvers_preview: approverIds.slice(0, 3).map((id) => toPerson(memberOf(members, id))),
      approvers_total: approverIds.length,
      my_state: { approval_required: Boolean(row.approval_required), starred: Boolean(row.starred) }
    };
  });

  const total = Number(result.total) || 0;
  const nextOffset = params.offset + rows.length;
  return {
    rows: mapped,
    total,
    nextCursor: rows.length > 0 && nextOffset < total ? String(nextOffset) : null
  };
}

export async function countWorkflowDocuments(
  params: Pick<WorkflowListParams, 'scope' | 'q' | 'writerIds' | 'templateKeys' | 'updatedFrom' | 'updatedTo'>
): Promise<WorkflowCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('workflow_document_counts', {
    p_scope: params.scope,
    p_q: params.q,
    p_writer_ids: params.writerIds.length ? params.writerIds : null,
    p_template_keys: params.templateKeys.length ? params.templateKeys : null,
    p_updated_from: params.updatedFrom,
    p_updated_to: params.updatedTo
  });
  if (error) throw new Error(error.message);
  const counts = (data ?? {}) as Partial<WorkflowCounts>;
  return {
    in_progress: Number(counts.in_progress) || 0,
    done: Number(counts.done) || 0,
    star: Number(counts.star) || 0,
    all: Number(counts.all) || 0,
    approval_required: Number(counts.approval_required) || 0
  };
}

// ---------------------------------------------------------------------------
// 문서 상세 (사용자 세션 RLS → 열람 불가는 null = 404)
// ---------------------------------------------------------------------------
type DocumentRow = {
  id: string;
  code: string;
  template_key: string;
  template_snapshot: WorkflowTemplateSnapshot;
  title: string;
  status: WorkflowDocumentStatus;
  writer_id: string;
  inputs: { field_key: string; value: unknown }[];
  content_html: string;
  current_step: number;
  total_steps: number;
  edit_policy: WorkflowEditPolicy;
  approval_step_edit_enabled: boolean;
  written_at: string;
  updated_at: string;
  completed_at: string | null;
  canceled_at: string | null;
};

const DOCUMENT_COLUMNS =
  'id, code, template_key, template_snapshot, title, status, writer_id, inputs, content_html, current_step, total_steps, edit_policy, approval_step_edit_enabled, written_at, updated_at, completed_at, canceled_at';

type ActorRow = {
  step: number;
  user_id: string;
  status: WorkflowActorStatus;
  position: number;
  acted_at: string | null;
};

type AttachmentRow = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

function toAttachment(row: AttachmentRow): WorkflowAttachment {
  return {
    id: row.id,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at
  };
}

export async function getWorkflowDocumentDetail(
  documentId: string,
  viewerId: string
): Promise<WorkflowDocumentDetail | null> {
  const supabase = await createClient();
  const { data: docData, error: docError } = await supabase
    .from('workflow_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .maybeSingle();
  if (docError) throw new Error(docError.message);
  if (!docData) return null;
  const doc = docData as DocumentRow;

  const [steps, actors, referrers, references, events, attachments, state] = await Promise.all([
    supabase
      .from('workflow_approval_steps')
      .select('step, status')
      .eq('document_id', documentId)
      .order('step', { ascending: true }),
    supabase
      .from('workflow_approval_actors')
      .select('step, user_id, status, position, acted_at')
      .eq('document_id', documentId)
      .order('step', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from('workflow_document_referrers')
      .select('user_id, notification_setting, position')
      .eq('document_id', documentId)
      .order('position', { ascending: true }),
    supabase
      .from('workflow_document_references')
      .select('referenced_document_id, position')
      .eq('document_id', documentId)
      .order('position', { ascending: true }),
    supabase
      .from('workflow_document_events')
      .select('id, type, actor_id, content, payload, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true }),
    supabase
      .from('workflow_attachments')
      .select('id, file_name, mime_type, size_bytes, created_at')
      .eq('document_id', documentId)
      .eq('status', 'bound')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('workflow_document_user_states')
      .select('starred')
      .eq('document_id', documentId)
      .eq('user_id', viewerId)
      .maybeSingle()
  ]);
  for (const result of [steps, actors, referrers, references, events, attachments, state]) {
    if (result.error) throw new Error(result.error.message);
  }

  const actorRows = (actors.data ?? []) as ActorRow[];
  const referrerRows = (referrers.data ?? []) as {
    user_id: string;
    notification_setting: WorkflowNotificationSetting;
  }[];
  const eventRows = (events.data ?? []) as {
    id: string;
    type: WorkflowEventType;
    actor_id: string | null;
    content: string | null;
    payload: WorkflowEventPayload | null;
    created_at: string;
  }[];
  const referenceIds = ((references.data ?? []) as { referenced_document_id: string }[]).map(
    (row) => row.referenced_document_id
  );

  // 참조문서: 열람 가능한 것만 (RLS)
  let referenceDocs: { id: string; code: string; status: WorkflowDocumentStatus; writer_id: string; template_snapshot: WorkflowTemplateSnapshot }[] = [];
  if (referenceIds.length > 0) {
    const { data, error } = await supabase
      .from('workflow_documents')
      .select('id, code, status, writer_id, template_snapshot')
      .in('id', referenceIds);
    if (error) throw new Error(error.message);
    referenceDocs = (data ?? []) as typeof referenceDocs;
  }

  const members = await fetchMembersByIds([
    doc.writer_id,
    ...actorRows.map((row) => row.user_id),
    ...referrerRows.map((row) => row.user_id),
    ...eventRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)),
    ...referenceDocs.map((row) => row.writer_id)
  ]);

  const stepRows = (steps.data ?? []) as { step: number; status: WorkflowStepStatus }[];
  const referenceOrder = new Map(referenceIds.map((id, index) => [id, index]));

  return {
    id: doc.id,
    code: doc.code,
    title: doc.title,
    status: doc.status,
    current_step: doc.current_step,
    total_steps: doc.total_steps,
    template: {
      key: doc.template_key,
      name: doc.template_snapshot?.name ?? doc.title,
      emoji: doc.template_snapshot?.emoji ?? '📄'
    },
    template_snapshot: doc.template_snapshot,
    writer: memberOf(members, doc.writer_id),
    written_at: doc.written_at,
    updated_at: doc.updated_at,
    completed_at: doc.completed_at,
    canceled_at: doc.canceled_at,
    edit_policy: doc.edit_policy,
    approval_step_edit_enabled: doc.approval_step_edit_enabled,
    inputs: (doc.inputs ?? []).map((item) => ({
      field_key: item.field_key,
      value: inputItemsToValues([item])[item.field_key] ?? ''
    })),
    values: inputItemsToValues(doc.inputs),
    content_html: doc.content_html ?? '',
    attachments: ((attachments.data ?? []) as AttachmentRow[]).map(toAttachment),
    references: referenceDocs
      .sort((a, b) => (referenceOrder.get(a.id) ?? 0) - (referenceOrder.get(b.id) ?? 0))
      .map((row) => ({
        id: row.id,
        code: row.code,
        template_name: row.template_snapshot?.name ?? '',
        emoji: row.template_snapshot?.emoji ?? '📄',
        writer_name: memberOf(members, row.writer_id).full_name,
        status: row.status
      })),
    steps: stepRows.map((step) => ({
      step: step.step,
      status: step.status,
      actors: actorRows
        .filter((actor) => actor.step === step.step)
        .map((actor) => ({
          ...memberOf(members, actor.user_id),
          status: actor.status,
          acted_at: actor.acted_at
        }))
    })),
    referrers: referrerRows.map((row) => ({
      ...memberOf(members, row.user_id),
      notification_setting: row.notification_setting
    })),
    events: eventRows.map(
      (row): WorkflowEvent => ({
        id: row.id,
        type: row.type,
        actor: row.actor_id ? toPerson(memberOf(members, row.actor_id)) : null,
        content: row.content,
        payload: row.payload ?? {},
        created_at: row.created_at
      })
    ),
    permissions: computeWorkflowPermissions({
      viewerId,
      writerId: doc.writer_id,
      status: doc.status,
      currentStep: doc.current_step,
      editPolicy: doc.edit_policy,
      approvalStepEditEnabled: doc.approval_step_edit_enabled,
      actors: actorRows
    }),
    starred: Boolean((state.data as { starred?: boolean } | null)?.starred)
  };
}

/** 열람 가능 여부 + 로그 라벨용 헤더 (사용자 세션 RLS). 열람 불가면 null */
export type WorkflowDocumentHeader = {
  id: string;
  code: string;
  template_key: string;
  template_name: string;
  status: WorkflowDocumentStatus;
  writer_id: string;
  current_step: number;
  approval_step_edit_enabled: boolean;
};

export async function getVisibleWorkflowDocumentHeader(
  documentId: string
): Promise<WorkflowDocumentHeader | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workflow_documents')
    .select('id, code, template_key, template_name:template_snapshot->>name, status, writer_id, current_step, approval_step_edit_enabled')
    .eq('id', documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WorkflowDocumentHeader | null) ?? null;
}

/** 수정(PATCH) 사전 검증용 문서 컨텍스트 — 열람 확인 후에만 호출 (service role) */
export type WorkflowDocumentEditContext = {
  id: string;
  code: string;
  status: WorkflowDocumentStatus;
  writer_id: string;
  current_step: number;
  edit_policy: WorkflowEditPolicy;
  approval_step_edit_enabled: boolean;
  template_key: string;
  template_snapshot: WorkflowTemplateSnapshot;
  inputs: { field_key: string; value: unknown }[];
  content_html: string;
  actors: { user_id: string; step: number; status: WorkflowActorStatus }[];
  bound_attachment_ids: string[];
};

export async function getWorkflowDocumentEditContext(
  documentId: string
): Promise<WorkflowDocumentEditContext | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('workflow_documents')
    .select('id, code, status, writer_id, current_step, edit_policy, approval_step_edit_enabled, template_key, template_snapshot, inputs, content_html')
    .eq('id', documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [actors, attachments] = await Promise.all([
    supabase.from('workflow_approval_actors').select('user_id, step, status').eq('document_id', documentId),
    supabase
      .from('workflow_attachments')
      .select('id')
      .eq('document_id', documentId)
      .eq('status', 'bound')
      .is('deleted_at', null)
  ]);
  if (actors.error) throw new Error(actors.error.message);
  if (attachments.error) throw new Error(attachments.error.message);

  return {
    ...(data as Omit<WorkflowDocumentEditContext, 'actors' | 'bound_attachment_ids'>),
    actors: (actors.data ?? []) as WorkflowDocumentEditContext['actors'],
    bound_attachment_ids: ((attachments.data ?? []) as { id: string }[]).map((row) => row.id)
  };
}

// ---------------------------------------------------------------------------
// 첨부 (Storage — service role 전용, signed URL)
// ---------------------------------------------------------------------------
export async function createWorkflowSignedUpload(storagePath: string): Promise<{ signedUrl: string; token: string; path: string }> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(WORKFLOW_ATTACHMENT_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) {
    throw new Error(error?.message ?? 'Signed upload URL 생성에 실패했습니다.');
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

export async function getWorkflowStorageObjectSize(storagePath: string): Promise<number | null> {
  const supabase = getServiceRoleClient();
  const slashIndex = storagePath.lastIndexOf('/');
  const folder = slashIndex >= 0 ? storagePath.slice(0, slashIndex) : '';
  const fileName = slashIndex >= 0 ? storagePath.slice(slashIndex + 1) : storagePath;

  const { data, error } = await supabase.storage
    .from(WORKFLOW_ATTACHMENT_BUCKET)
    .list(folder, { limit: 10, search: fileName });
  if (!error && data?.length) {
    const object = data.find((item) => item.name === fileName);
    const size = (object?.metadata as { size?: number } | null | undefined)?.size;
    if (typeof size === 'number') return size;
  }
  return null;
}

export async function removeWorkflowStorageObjects(paths: unknown): Promise<void> {
  const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string' && p.length > 0) : [];
  if (list.length === 0) return;
  try {
    const supabase = getServiceRoleClient();
    const { error } = await supabase.storage.from(WORKFLOW_ATTACHMENT_BUCKET).remove(list);
    if (error) console.error('[workflow] storage remove failed:', error.message);
  } catch (error) {
    console.error('[workflow] storage remove failed:', error instanceof Error ? error.message : 'unknown');
  }
}

/** 열람자(RLS)만 bound 첨부의 짧은 signed URL을 받는다 */
export async function createWorkflowAttachmentDownload(input: {
  documentId: string;
  attachmentId: string;
  download: boolean;
}): Promise<{ url: string; file_name: string; mime_type: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workflow_attachments')
    .select('id, file_name, mime_type, storage_path')
    .eq('id', input.attachmentId)
    .eq('document_id', input.documentId)
    .eq('status', 'bound')
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { file_name: string; mime_type: string | null; storage_path: string };

  const admin = getServiceRoleClient();
  const { data: signed, error: signError } = await admin.storage
    .from(WORKFLOW_ATTACHMENT_BUCKET)
    .createSignedUrl(row.storage_path, 60, input.download ? { download: row.file_name } : undefined);
  if (signError || !signed?.signedUrl) {
    throw new Error(signError?.message ?? '다운로드 URL 생성에 실패했습니다.');
  }
  return { url: signed.signedUrl, file_name: row.file_name, mime_type: row.mime_type };
}

// ---------------------------------------------------------------------------
// 임시저장 (본인만 — 사용자 세션 RLS)
// ---------------------------------------------------------------------------
type DraftRow = {
  id: string;
  payload: Partial<WorkflowDraftPayload> | null;
  created_at: string;
  updated_at: string;
  workflow_templates: { template_key: string; name: string; emoji: string } | null;
};

function toDraftListItem(row: DraftRow): WorkflowDraftListItem {
  return {
    id: row.id,
    template: {
      key: row.workflow_templates?.template_key ?? '',
      name: row.workflow_templates?.name ?? '',
      emoji: row.workflow_templates?.emoji ?? '📄'
    },
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listWorkflowDrafts(): Promise<WorkflowDraftListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workflow_drafts')
    .select('id, payload, created_at, updated_at, workflow_templates(template_key, name, emoji)')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DraftRow[]).map(toDraftListItem);
}

export async function getWorkflowDraft(draftId: string): Promise<WorkflowDraftDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workflow_drafts')
    .select('id, payload, created_at, updated_at, workflow_templates(template_key, name, emoji)')
    .eq('id', draftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as DraftRow;

  const { data: attachments, error: attachmentError } = await supabase
    .from('workflow_attachments')
    .select('id, file_name, mime_type, size_bytes, created_at')
    .eq('draft_id', draftId)
    .eq('status', 'staged')
    .order('created_at', { ascending: true });
  if (attachmentError) throw new Error(attachmentError.message);

  const payload = row.payload ?? {};
  return {
    ...toDraftListItem(row),
    payload: {
      values: (payload.values ?? {}) as WorkflowDraftPayload['values'],
      content_html: typeof payload.content_html === 'string' ? payload.content_html : '',
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      referrers: Array.isArray(payload.referrers) ? payload.referrers : []
    },
    attachments: ((attachments ?? []) as AttachmentRow[]).map(toAttachment)
  };
}

// ---------------------------------------------------------------------------
// 워크플로우 관리자
// ---------------------------------------------------------------------------
export async function listWorkflowAdmins(): Promise<WorkflowAdmin[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('workflow_admins')
    .select('user_id, granted_by, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { user_id: string; granted_by: string | null; created_at: string }[];
  const members = await fetchMembersByIds(rows.map((row) => row.user_id));
  return rows.map((row) => ({
    ...memberOf(members, row.user_id),
    granted_by: row.granted_by,
    created_at: row.created_at
  }));
}

// ---------------------------------------------------------------------------
// 쓰기 RPC 래퍼 (service role · p_actor_user_id로 RPC가 권한·상태 재검사)
// ---------------------------------------------------------------------------
export type WorkflowRpcDocumentResult = {
  document_id: string;
  code: string;
  template_key: string;
  template_name: string;
  writer_id: string;
  status: WorkflowDocumentStatus;
  current_step: number;
  total_steps: number;
  notify?: Record<string, string[]>;
  removed_storage_paths?: string[];
  attachment_count?: number;
  changed_field_keys?: string[];
  diff_lines?: string[];
  changed?: boolean;
  step?: number;
  event_id?: string;
  starred?: boolean;
};

export function submitWorkflowDocument(args: {
  actorUserId: string;
  templateId: string;
  inputs: unknown[];
  contentHtml: string;
  searchText: string;
  steps: string[][];
  referrers: { user_id: string; notification_setting: WorkflowNotificationSetting }[];
  referenceIds: string[];
  attachmentIds: string[];
  draftId: string | null;
}) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_submit_document', {
    p_actor_user_id: args.actorUserId,
    p_template_id: args.templateId,
    p_inputs: args.inputs,
    p_content_html: args.contentHtml,
    p_search_text: args.searchText,
    p_steps: args.steps,
    p_referrers: args.referrers,
    p_reference_ids: args.referenceIds,
    p_attachment_ids: args.attachmentIds,
    p_draft_id: args.draftId
  });
}

export function updateWorkflowDocument(args: {
  actorUserId: string;
  documentId: string;
  inputs: unknown[];
  contentHtml: string;
  searchText: string;
  referenceIds: string[];
  addAttachmentIds: string[];
  removeAttachmentIds: string[];
  changedFieldKeys: string[];
}) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_update_document', {
    p_actor_user_id: args.actorUserId,
    p_document_id: args.documentId,
    p_inputs: args.inputs,
    p_content_html: args.contentHtml,
    p_search_text: args.searchText,
    p_reference_ids: args.referenceIds,
    p_add_attachment_ids: args.addAttachmentIds,
    p_remove_attachment_ids: args.removeAttachmentIds,
    p_changed_field_keys: args.changedFieldKeys
  });
}

export function approveWorkflowDocument(actorUserId: string, documentId: string, opinion: string | null) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_approve', {
    p_actor_user_id: actorUserId,
    p_document_id: documentId,
    p_opinion: opinion
  });
}

export function declineWorkflowDocument(actorUserId: string, documentId: string, reason: string | null) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_decline', {
    p_actor_user_id: actorUserId,
    p_document_id: documentId,
    p_reason: reason
  });
}

export function cancelWorkflowDocument(actorUserId: string, documentId: string) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_cancel_document', {
    p_actor_user_id: actorUserId,
    p_document_id: documentId
  });
}

export function changeWorkflowApprovalLine(args: {
  actorUserId: string;
  documentId: string;
  steps: string[][];
  referrers: { user_id: string; notification_setting: WorkflowNotificationSetting }[];
}) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_change_approval_line', {
    p_actor_user_id: args.actorUserId,
    p_document_id: args.documentId,
    p_steps: args.steps,
    p_referrers: args.referrers
  });
}

export function addWorkflowComment(actorUserId: string, documentId: string, content: string) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_add_comment', {
    p_actor_user_id: actorUserId,
    p_document_id: documentId,
    p_content: content
  });
}

export function setWorkflowStar(actorUserId: string, documentId: string, starred: boolean) {
  return callWorkflowRpc<WorkflowRpcDocumentResult>('workflow_set_star', {
    p_actor_user_id: actorUserId,
    p_document_id: documentId,
    p_starred: starred
  });
}

export function saveWorkflowDraft(args: {
  actorUserId: string;
  draftId: string | null;
  templateId: string;
  payload: WorkflowDraftPayload;
  attachmentIds: string[];
}) {
  return callWorkflowRpc<{
    draft_id: string;
    created: boolean;
    template_key: string;
    template_name: string;
    attachment_count: number;
    removed_storage_paths: string[];
  }>('workflow_save_draft', {
    p_actor_user_id: args.actorUserId,
    p_draft_id: args.draftId,
    p_template_id: args.templateId,
    p_payload: args.payload,
    p_attachment_ids: args.attachmentIds
  });
}

export function deleteWorkflowDraft(actorUserId: string, draftId: string) {
  return callWorkflowRpc<{ draft_id: string; template_key: string; removed_storage_paths: string[] }>(
    'workflow_delete_draft',
    { p_actor_user_id: actorUserId, p_draft_id: draftId }
  );
}

export function registerWorkflowAttachment(args: {
  actorUserId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
}) {
  return callWorkflowRpc<WorkflowAttachment & { status: string }>('workflow_register_attachment', {
    p_actor_user_id: args.actorUserId,
    p_storage_path: args.storagePath,
    p_file_name: args.fileName,
    p_mime_type: args.mimeType,
    p_size_bytes: args.sizeBytes
  });
}

export function deleteWorkflowStagedAttachment(actorUserId: string, attachmentId: string) {
  return callWorkflowRpc<{ attachment_id: string; storage_path: string }>('workflow_delete_staged_attachment', {
    p_actor_user_id: actorUserId,
    p_attachment_id: attachmentId
  });
}

export function setWorkflowTemplatePolicy(args: {
  actorUserId: string;
  templateId: string;
  steps: string[][];
  referrers: { user_id: string; notification_setting: WorkflowNotificationSetting }[];
  approvalStepEditEnabled: boolean | null;
}) {
  return callWorkflowRpc<{ template_id: string; template_key: string; template_name: string; step_count: number }>(
    'workflow_set_template_policy',
    {
      p_actor_user_id: args.actorUserId,
      p_template_id: args.templateId,
      p_steps: args.steps,
      p_referrers: args.referrers,
      p_approval_step_edit_enabled: args.approvalStepEditEnabled
    }
  );
}

export function grantWorkflowAdmin(actorUserId: string, userId: string) {
  return callWorkflowRpc<{ user_id: string }>('workflow_grant_admin', {
    p_actor_user_id: actorUserId,
    p_user_id: userId
  });
}

export function revokeWorkflowAdmin(actorUserId: string, userId: string) {
  return callWorkflowRpc<{ user_id: string }>('workflow_revoke_admin', {
    p_actor_user_id: actorUserId,
    p_user_id: userId
  });
}

/** 알림 문구용 작성자 이름 */
export async function getMemberName(userId: string): Promise<string> {
  const members = await fetchMembersByIds([userId]);
  return memberOf(members, userId).full_name;
}
