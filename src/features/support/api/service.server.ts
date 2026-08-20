import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { AuthProfile } from '@/features/auth/api/types';
import {
  SUPPORT_PAGE_SIZE,
  SUPPORT_STATUSES,
  type SupportComment,
  type SupportCommentAuthorRole,
  type SupportCommentCreatePayload,
  type SupportCreatePayload,
  type SupportFilters,
  type SupportListItem,
  type SupportListResponse,
  type SupportRequest,
  type SupportStatus,
  type SupportCommentUpdatePayload,
  type SupportUpdateContentPayload
} from './types';

type SupportRow = {
  id: number;
  submitted_by: string;
  submitter_name: string;
  submitter_email: string;
  title: string;
  body: string;
  status: SupportStatus;
  status_updated_at: string | null;
  status_updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type SupportCommentRow = {
  id: number;
  support_request_id: number;
  author_user_id: string;
  parent_id: number | null;
  root_comment_id: number | null;
  path: string;
  depth: number;
  body: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileLite = {
  user_id: string;
  full_name: string | null;
  email: string;
  system_role: SupportCommentAuthorRole;
};

export type SupportCursor = {
  created_at: string;
  id: number;
};

const SUPPORT_SELECT = `
  id,
  submitted_by,
  submitter_name,
  submitter_email,
  title,
  body,
  status,
  status_updated_at,
  status_updated_by,
  created_at,
  updated_at
`;

const LIST_SELECT = `
  id,
  submitted_by,
  submitter_name,
  submitter_email,
  title,
  status,
  created_at,
  updated_at
`;

const DEFAULT_LIMIT = SUPPORT_PAGE_SIZE;
const MAX_LIMIT = 50;
const DELETED_COMMENT_BODY = '삭제된 댓글입니다.';

const SUPPORT_COMMENT_SELECT = `
  id,
  support_request_id,
  author_user_id,
  parent_id,
  root_comment_id,
  path,
  depth,
  body,
  is_deleted,
  deleted_at,
  deleted_by,
  created_at,
  updated_at
`;

export function encodeSupportCursor(cursor: SupportCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeSupportCursor(cursor: string): SupportCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as Partial<SupportCursor>;

    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'number') {
      return {
        created_at: parsed.created_at,
        id: parsed.id
      };
    }

    return null;
  } catch {
    return null;
  }
}

function mapSupportRow(row: SupportRow): SupportRequest {
  return {
    id: row.id,
    submitted_by: row.submitted_by,
    submitter_name: row.submitter_name,
    submitter_email: row.submitter_email,
    title: row.title,
    body: row.body,
    status: row.status,
    status_updated_at: row.status_updated_at,
    status_updated_by: row.status_updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapSupportCommentRow(
  row: SupportCommentRow,
  profilesByUserId: Map<string, ProfileLite>
): SupportComment {
  const profile = profilesByUserId.get(row.author_user_id);
  const authorName = profile?.full_name?.trim() || profile?.email || '알 수 없음';

  return {
    id: row.id,
    support_request_id: row.support_request_id,
    author_user_id: row.author_user_id,
    author_name: authorName,
    author_role: profile?.system_role ?? 'user',
    parent_id: row.parent_id,
    root_comment_id: row.root_comment_id,
    path: row.path,
    depth: row.depth,
    body: row.is_deleted ? '' : row.body,
    is_deleted: row.is_deleted,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at
  };
}

function mapListItem(row: SupportRow): SupportListItem {
  return {
    id: row.id,
    submitted_by: row.submitted_by,
    submitter_name: row.submitter_name,
    submitter_email: row.submitter_email,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length < 2) {
    return '제목은 2자 이상이어야 합니다.';
  }
  return null;
}

function validateBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 10) {
    return '본문은 10자 이상이어야 합니다.';
  }
  return null;
}

function validateCommentBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    return '댓글 본문을 입력해 주세요.';
  }
  if (trimmed.length > 5000) {
    return '댓글 본문은 5000자 이하로 입력해 주세요.';
  }
  return null;
}

async function fetchProfilesByUserIds(userIds: string[]): Promise<Map<string, ProfileLite>> {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, system_role')
    .in('user_id', uniqueUserIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as ProfileLite[]).map((profile) => [profile.user_id, profile])
  );
}

function applySupportListFilters<
  T extends {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
    or: (filters: string) => T;
  }
>(query: T, filters: Pick<SupportFilters, 'search' | 'status' | 'submitted_by'>): T {
  let next = query;

  if (filters.submitted_by) {
    next = next.eq('submitted_by', filters.submitted_by);
  }

  if (filters.status && filters.status.length > 0) {
    next = next.in('status', filters.status);
  }

  if (filters.search?.trim()) {
    const escaped = filters.search.trim().replaceAll(',', ' ');
    next = next.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`);
  }

  return next;
}

function applySupportCursor<T extends { or: (filter: string) => T }>(
  query: T,
  cursor: SupportCursor
): T {
  return query.or(
    `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
  );
}

export async function listSupportRequests(
  filters: SupportFilters = {}
): Promise<SupportListResponse> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const supabase = await createClient();

  let query = supabase
    .from('support_requests')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  query = applySupportListFilters(query, filters);

  if (filters.cursor) {
    const decoded = decodeSupportCursor(filters.cursor);
    if (decoded) {
      query = applySupportCursor(query, decoded);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SupportRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    requests: page.map(mapListItem),
    nextCursor:
      hasMore && last
        ? encodeSupportCursor({
            created_at: last.created_at,
            id: last.id
          })
        : null,
    hasMore
  };
}

export async function getSupportRequestById(id: number): Promise<SupportRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('support_requests')
    .select(SUPPORT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapSupportRow(data as SupportRow);
}

export async function getSupportRequestByIdAsService(
  id: number
): Promise<SupportRequest | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('support_requests')
    .select(SUPPORT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapSupportRow(data as SupportRow);
}

export function canAccessSupportRequest(
  supportRequest: SupportRequest,
  profile: Pick<AuthProfile, 'user_id' | 'system_role'>
): boolean {
  return profile.system_role === 'admin' || supportRequest.submitted_by === profile.user_id;
}

export async function listSupportComments(
  supportRequestId: number
): Promise<SupportComment[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('support_comments')
    .select(SUPPORT_COMMENT_SELECT)
    .eq('support_request_id', supportRequestId)
    .order('path', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SupportCommentRow[];
  const profilesByUserId = await fetchProfilesByUserIds(rows.map((row) => row.author_user_id));

  return rows.map((row) => mapSupportCommentRow(row, profilesByUserId));
}

async function mapSingleComment(row: SupportCommentRow): Promise<SupportComment> {
  const profilesByUserId = await fetchProfilesByUserIds([row.author_user_id]);
  return mapSupportCommentRow(row, profilesByUserId);
}

export async function getSupportCommentById(input: {
  supportRequestId: number;
  commentId: number;
}): Promise<SupportComment | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('support_comments')
    .select(SUPPORT_COMMENT_SELECT)
    .eq('support_request_id', input.supportRequestId)
    .eq('id', input.commentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapSingleComment(data as SupportCommentRow);
}

export async function createSupportComment(input: {
  supportRequestId: number;
  authorUserId: string;
  payload: SupportCommentCreatePayload;
  parentId?: number | null;
}): Promise<SupportComment> {
  const bodyError = validateCommentBody(input.payload.body);
  if (bodyError) {
    throw new Error(bodyError);
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('support_comments')
    .insert({
      support_request_id: input.supportRequestId,
      author_user_id: input.authorUserId,
      parent_id: input.parentId ?? null,
      body: input.payload.body.trim()
    })
    .select(SUPPORT_COMMENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '댓글 등록 중 오류가 발생했습니다.');
  }

  return mapSingleComment(data as SupportCommentRow);
}

export async function updateSupportComment(input: {
  supportRequestId: number;
  commentId: number;
  authorUserId: string;
  payload: SupportCommentUpdatePayload;
}): Promise<SupportComment | null> {
  const bodyError = validateCommentBody(input.payload.body);
  if (bodyError) {
    throw new Error(bodyError);
  }

  const existing = await getSupportCommentById({
    supportRequestId: input.supportRequestId,
    commentId: input.commentId
  });

  if (!existing) {
    return null;
  }

  if (existing.author_user_id !== input.authorUserId || existing.is_deleted) {
    throw new Error('FORBIDDEN');
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('support_comments')
    .update({ body: input.payload.body.trim() })
    .eq('support_request_id', input.supportRequestId)
    .eq('id', input.commentId)
    .select(SUPPORT_COMMENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '댓글 수정 중 오류가 발생했습니다.');
  }

  return mapSingleComment(data as SupportCommentRow);
}

export async function softDeleteSupportComment(input: {
  supportRequestId: number;
  commentId: number;
  actorUserId: string;
  actorRole: SupportCommentAuthorRole;
}): Promise<SupportComment | null> {
  const existing = await getSupportCommentById({
    supportRequestId: input.supportRequestId,
    commentId: input.commentId
  });

  if (!existing) {
    return null;
  }

  const isAdmin = input.actorRole === 'admin';
  if (!isAdmin && existing.author_user_id !== input.actorUserId) {
    throw new Error('FORBIDDEN');
  }

  if (existing.is_deleted) {
    return existing;
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('support_comments')
    .update({
      body: DELETED_COMMENT_BODY,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: input.actorUserId
    })
    .eq('support_request_id', input.supportRequestId)
    .eq('id', input.commentId)
    .select(SUPPORT_COMMENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '댓글 삭제 중 오류가 발생했습니다.');
  }

  return mapSingleComment(data as SupportCommentRow);
}

export async function createSupportRequest(input: {
  payload: SupportCreatePayload;
  profile: AuthProfile;
}): Promise<SupportRequest> {
  const titleError = validateTitle(input.payload.title);
  if (titleError) {
    throw new Error(titleError);
  }

  const bodyError = validateBody(input.payload.body);
  if (bodyError) {
    throw new Error(bodyError);
  }

  const submitterName = input.profile.full_name?.trim() || '이름 없음';
  const submitterEmail = input.profile.email.trim();

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('support_requests')
    .insert({
      submitted_by: input.profile.user_id,
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      title: input.payload.title.trim(),
      body: input.payload.body.trim(),
      status: 'pending'
    })
    .select(SUPPORT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '문의 등록 중 오류가 발생했습니다.');
  }

  return mapSupportRow(data as SupportRow);
}

export async function updateSupportRequestContent(input: {
  id: number;
  userId: string;
  payload: SupportUpdateContentPayload;
}): Promise<SupportRequest | null> {
  const titleError = validateTitle(input.payload.title);
  if (titleError) {
    throw new Error(titleError);
  }

  const bodyError = validateBody(input.payload.body);
  if (bodyError) {
    throw new Error(bodyError);
  }

  const supabase = getServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from('support_requests')
    .select(SUPPORT_SELECT)
    .eq('id', input.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!existing) {
    return null;
  }

  const row = existing as SupportRow;
  if (row.submitted_by !== input.userId) {
    throw new Error('FORBIDDEN');
  }

  if (row.status !== 'pending') {
    throw new Error('FORBIDDEN');
  }

  const { data, error } = await supabase
    .from('support_requests')
    .update({
      title: input.payload.title.trim(),
      body: input.payload.body.trim()
    })
    .eq('id', input.id)
    .select(SUPPORT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '문의 수정 중 오류가 발생했습니다.');
  }

  return mapSupportRow(data as SupportRow);
}

const VALID_STATUS_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  pending: ['received'],
  received: ['completed'],
  completed: []
};

export async function updateSupportRequestStatus(input: {
  id: number;
  adminUserId: string;
  status: SupportStatus;
}): Promise<SupportRequest | null> {
  if (!SUPPORT_STATUSES.includes(input.status)) {
    throw new Error('상태 값이 올바르지 않습니다.');
  }

  const supabase = getServiceRoleClient();
  const { data: existing, error: fetchError } = await supabase
    .from('support_requests')
    .select(SUPPORT_SELECT)
    .eq('id', input.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!existing) {
    return null;
  }

  const row = existing as SupportRow;
  const allowed = VALID_STATUS_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw new Error('FORBIDDEN');
  }

  const { data, error } = await supabase
    .from('support_requests')
    .update({
      status: input.status,
      status_updated_at: new Date().toISOString(),
      status_updated_by: input.adminUserId
    })
    .eq('id', input.id)
    .select(SUPPORT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '상태 변경 중 오류가 발생했습니다.');
  }

  return mapSupportRow(data as SupportRow);
}

export function truncateSupportTitle(title: string, max = 100): string {
  const trimmed = title.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}
