import 'server-only';

import {
  canManageQuickRequestParticipants,
  isDongbang,
  isQuickAdmin
} from '@/features/auth/api/quick-access.server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { isChatAiSuggestEnabled } from './ai-suggest.server';
import { buildQuickRouteSummary } from '../lib/quick-request-route-label';
import {
  QUICK_CHAT_CONVERSATIONS_MAX_LIMIT,
  QUICK_CHAT_CONVERSATIONS_PAGE_SIZE,
  QUICK_CHAT_MESSAGES_LIMIT,
  QUICK_CHAT_PREVIEW_LENGTH,
  QUICK_CHAT_QUICK_REPLIES,
  type QuickChatAuthorRole,
  type QuickChatConversationTab,
  type QuickChatReadOnlyReason,
  type QuickChatViewerRole
} from '../schemas/quick-request-chat';
import type {
  QuickRequestChatRequestSummary,
  QuickRequestChatViewer,
  QuickRequestConversation,
  QuickRequestConversationsData,
  QuickRequestMessage,
  QuickRequestMessageRead,
  QuickRequestMessagesData
} from './types';
import type { QuickRange } from '../lib/quick-request-range';
import {
  buildChatBodyWithAttachmentSummary,
  type QuickChatAttachmentKind
} from '../schemas/quick-request-attachment';
import {
  listQuickChatAttachmentKindsByMessageIds,
  listQuickChatAttachmentsByMessageIds,
  toQuickRequestMessageAttachment,
  type QuickRequestMessageAttachmentRow
} from './attachments.server';
import { canViewAllQuickRequests } from '@/features/auth/api/quick-access.server';
import {
  encodeConversationCursor,
  type QuickConversationCursor
} from './cursor.server';
import {
  buildQuickRequestParticipantsData,
  listActiveParticipantUserIds
} from './participants.server';
import {
  fetchQuickRequestUnreadCounts,
  listParticipantRequestIds,
  normalizeQuickRequestSearch,
  QUICK_REQUEST_COLUMNS,
  type QuickRequestRow,
  type QuickViewerProfile
} from './workflow.server';

/**
 * plan 93 — 퀵 요청 건별 대화 서버 데이터 접근 (service role).
 * 권한·역할·읽음 위치·안 읽은 수·대화 목록은 여기서 계산하고, Route Handler는 응답·로그·분기만 맡는다.
 * 쓰기는 모두 SQL 92 RPC(service_role 전용) 경유 — 클라이언트 직접 INSERT 없음.
 */

const MESSAGES_TABLE = 'quick_request_messages';
const READS_TABLE = 'quick_request_message_reads';
const MESSAGE_COLUMNS = 'id, quick_request_id, author_user_id, author_name, author_role, body, created_at';
const AUTHOR_NAME_MAX_LENGTH = 100;
const CHAT_NOTIFICATION_TYPE = 'quick_request.chat_message';

export type QuickRequestMessageRow = {
  id: number;
  quick_request_id: string;
  author_user_id: string;
  author_name: string;
  author_role: QuickChatAuthorRole;
  body: string;
  created_at: string;
};

type ProfileNameRow = Pick<QuickViewerProfile, 'user_id' | 'system_role' | 'affiliation' | 'rank'> & {
  full_name: string | null;
  email: string | null;
  status: string | null;
};

// ---------------------------------------------------------------------------
// 역할·권한
// ---------------------------------------------------------------------------

/**
 * 작성자 역할 — 요청자 판정 우선 → 동방특송 → admin → 초대 참여자(plan 101 · `isParticipant`는 호출부가 DB로 확인). 그 밖(구매물류팀)은 null(쓰기 불가).
 * admin은 초대 대상이 아니므로(D-2 r1) 초대되었더라도 계속 admin이다.
 */
export function resolveChatAuthorRole(
  profile: QuickViewerProfile,
  row: Pick<QuickRequestRow, 'requester_user_id'>,
  isParticipant = false
): QuickChatAuthorRole | null {
  if (row.requester_user_id === profile.user_id) return 'requester';
  if (isDongbang(profile)) return 'dongbang';
  if (isQuickAdmin(profile)) return 'admin';
  if (isParticipant) return 'participant';
  return null;
}

/** 보는 사람 역할 — 조회 가능한 사람 중 쓰기 역할이 없으면 `logistics`(읽기 전용) */
export function resolveChatViewerRole(
  profile: QuickViewerProfile,
  row: Pick<QuickRequestRow, 'requester_user_id'>,
  isParticipant = false
): QuickChatViewerRole {
  return resolveChatAuthorRole(profile, row, isParticipant) ?? 'logistics';
}

export type QuickChatWriteState = {
  role: QuickChatViewerRole;
  canWrite: boolean;
  /** plan 94 D-12 — 승인·취소 건도 대화 가능. 읽기 전용은 구매물류팀(`logistics`)뿐 */
  readOnlyReason: QuickChatReadOnlyReason | null;
};

export function buildChatWriteState(
  profile: QuickViewerProfile,
  row: QuickRequestRow,
  isParticipant = false
): QuickChatWriteState {
  const role = resolveChatViewerRole(profile, row, isParticipant);
  if (role === 'logistics') {
    return { role, canWrite: false, readOnlyReason: 'logistics' };
  }
  return { role, canWrite: true, readOnlyReason: null };
}

/** 작성 시점 스냅샷 이름 (profiles.full_name → email) */
export function resolveChatAuthorName(profile: { full_name: string | null; email: string }): string {
  const name = profile.full_name?.trim() || profile.email;
  return name.slice(0, AUTHOR_NAME_MAX_LENGTH);
}

// ---------------------------------------------------------------------------
// 매핑
// ---------------------------------------------------------------------------

/** plan 98 — `attachments`는 빈 배열이라도 항상 존재 */
export function toQuickRequestMessage(
  row: QuickRequestMessageRow,
  attachments: readonly QuickRequestMessageAttachmentRow[] = []
): QuickRequestMessage {
  return {
    id: Number(row.id),
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    body: row.body,
    createdAt: row.created_at,
    attachments: attachments.map(toQuickRequestMessageAttachment)
  };
}

function toChatRequestSummary(row: QuickRequestRow): QuickRequestChatRequestSummary {
  return {
    id: row.id,
    requestNo: row.request_no,
    status: row.status,
    requesterUserId: row.requester_user_id,
    requesterName: row.requester_name,
    route: buildQuickRouteSummary(row.origin, row.destination, row.stopovers),
    requestedAt: row.requested_at
  };
}

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

/** 최근 500개 · 오름차순 */
export async function listQuickRequestMessages(requestId: string): Promise<QuickRequestMessageRow[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select(MESSAGE_COLUMNS)
    .eq('quick_request_id', requestId)
    .order('id', { ascending: false })
    .limit(QUICK_CHAT_MESSAGES_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as QuickRequestMessageRow[]).reverse();
}

export async function fetchProfileRows(userIds: string[]): Promise<Map<string, ProfileNameRow>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ProfileNameRow>();
  if (unique.length === 0) return map;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, system_role, affiliation, rank, status')
    .in('user_id', unique);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as ProfileNameRow[]) {
    map.set(row.user_id, row);
  }
  return map;
}

/** 읽음 위치 전원(본인 포함) + 이름·역할 (✓✓ 판정은 FE가 상대편만 골라 쓴다, C-12) */
export async function listQuickRequestReads(row: QuickRequestRow): Promise<QuickRequestMessageRead[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(READS_TABLE)
    .select('user_id, last_read_message_id, last_read_at')
    .eq('quick_request_id', row.id);

  if (error) {
    throw new Error(error.message);
  }

  const reads = (data ?? []) as { user_id: string; last_read_message_id: number; last_read_at: string }[];
  // plan 101 — 읽은 사람이 초대 참여자면 role='participant' (C-12 ✓✓ 상대편 판정에 참여자 포함)
  const [profiles, participantIds] = await Promise.all([
    fetchProfileRows(reads.map((read) => read.user_id)),
    listActiveParticipantUserIds(row.id)
  ]);
  const participantSet = new Set(participantIds);

  return reads.map((read) => {
    const profile = profiles.get(read.user_id);
    const viewer: QuickViewerProfile = {
      user_id: read.user_id,
      system_role: profile?.system_role ?? 'user',
      affiliation: profile?.affiliation ?? null,
      rank: profile?.rank ?? null,
      status: (profile?.status as QuickViewerProfile['status']) ?? 'inactive'
    };
    return {
      userId: read.user_id,
      name: profile ? resolveChatAuthorName({ full_name: profile.full_name, email: profile.email ?? '알 수 없음' }) : '알 수 없음',
      role: resolveChatViewerRole(viewer, row, participantSet.has(read.user_id)),
      lastReadMessageId: Number(read.last_read_message_id),
      lastReadAt: read.last_read_at
    };
  });
}

/**
 * plan 101 — `isParticipant`(Route가 `resolveQuickRequestAccess`로 확인) → viewer.role='participant' · 쓰기 가능 · 칩 참여자 세트.
 * `participants`·`events`는 1회 조회로 같이 돌려준다(헤더 N · 패널 · 시스템 줄 · designer §5).
 */
export async function buildQuickRequestMessagesPayload(
  profile: QuickViewerProfile & { full_name: string | null; email: string },
  row: QuickRequestRow,
  options: { isParticipant?: boolean } = {}
): Promise<QuickRequestMessagesData> {
  const isParticipant = options.isParticipant ?? false;
  const [messages, reads, participantsData] = await Promise.all([
    listQuickRequestMessages(row.id),
    listQuickRequestReads(row),
    buildQuickRequestParticipantsData(row)
  ]);
  // plan 98 — 첨부는 메시지 id로 한 번에 (500개 상한 유지)
  const attachmentsByMessage = await listQuickChatAttachmentsByMessageIds(messages.map((message) => Number(message.id)));
  const writeState = buildChatWriteState(profile, row, isParticipant);
  const mine = reads.find((read) => read.userId === profile.user_id);
  const viewer: QuickRequestChatViewer = {
    userId: profile.user_id,
    name: resolveChatAuthorName(profile),
    role: writeState.role,
    canManageParticipants: canManageQuickRequestParticipants(profile, row)
  };

  return {
    request: toChatRequestSummary(row),
    viewer,
    participants: participantsData.participants,
    events: participantsData.events,
    messages: messages.map((message) => toQuickRequestMessage(message, attachmentsByMessage.get(Number(message.id)) ?? [])),
    myLastReadMessageId: mine?.lastReadMessageId ?? 0,
    reads,
    canWrite: writeState.canWrite,
    readOnlyReason: writeState.readOnlyReason,
    quickReplies: writeState.canWrite ? [...QUICK_CHAT_QUICK_REPLIES[writeState.role]] : [],
    // plan 100 D-1 — env ON && 쓰기 가능(구매물류팀 false)
    aiSuggest: { enabled: writeState.canWrite && isChatAiSuggestEnabled() }
  };
}

// ---------------------------------------------------------------------------
// 쓰기 (RPC)
// ---------------------------------------------------------------------------

/** RPC가 거부한 사유 (SQL 96 `raise exception … message`) — Route가 400으로 옮긴다 */
export class QuickRequestMessageRpcError extends Error {
  readonly reason: 'empty' | 'attachment_mismatch';

  constructor(reason: 'empty' | 'attachment_mismatch', message: string) {
    super(message);
    this.name = 'QuickRequestMessageRpcError';
    this.reason = reason;
  }
}

/**
 * insert + 보낸 사람 읽음 위치 갱신 (SQL 92 `create_quick_request_message` · SQL 93 잠금 제거 · SQL 96 `p_attachment_ids`).
 * plan 98 — pending 첨부를 같은 트랜잭션에서 연결. 소유·건·pending 불일치면 `attachment_mismatch`(롤백) · 본문·첨부 모두 없으면 `empty`.
 */
export async function createQuickRequestMessage(input: {
  requestId: string;
  authorUserId: string;
  authorName: string;
  authorRole: QuickChatAuthorRole;
  body: string;
  attachmentIds?: readonly number[];
}): Promise<QuickRequestMessageRow> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('create_quick_request_message', {
    p_request: input.requestId,
    p_author: input.authorUserId,
    p_author_name: input.authorName,
    p_author_role: input.authorRole,
    p_body: input.body,
    p_attachment_ids: [...new Set(input.attachmentIds ?? [])]
  });

  if (error) {
    if (error.message.includes('quick_request_message_empty')) {
      throw new QuickRequestMessageRpcError('empty', error.message);
    }
    if (error.message.includes('quick_request_attachment_mismatch')) {
      throw new QuickRequestMessageRpcError('attachment_mismatch', error.message);
    }
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as QuickRequestMessageRow | null;
  if (!row?.id) {
    throw new Error('create_quick_request_message returned no row');
  }
  return row;
}

export async function messageBelongsToRequest(requestId: string, messageId: number): Promise<boolean> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select('id')
    .eq('id', messageId)
    .eq('quick_request_id', requestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data);
}

/** 읽음 위치 갱신 — 뒤로 가지 않는다(greatest). 반환 = 갱신 후 위치 */
export async function markQuickRequestMessagesRead(
  userId: string,
  requestId: string,
  lastMessageId: number
): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('mark_quick_request_messages_read', {
    p_user: userId,
    p_request: requestId,
    p_message_id: lastMessageId
  });

  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}

/** C-21 — 그 건의 `quick_request.chat_message` 알림 중 본인·unread → read. 다른 퀵 알림은 건드리지 않는다 */
export async function markQuickChatNotificationsRead(userId: string, requestId: string): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .eq('type', CHAT_NOTIFICATION_TYPE)
    .eq('status', 'unread')
    .eq('metadata->>quick_request_id', requestId)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).length;
}

// ---------------------------------------------------------------------------
// 안 읽은 수
// ---------------------------------------------------------------------------

/** 안 읽은 메시지가 있는 건 전체 (내가 볼 수 있는 건 · 90일) */
export async function fetchQuickRequestUnreadRequests(userId: string): Promise<Map<string, number>> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('quick_request_unread_requests', { p_user: userId });

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, number>();
  for (const row of (data ?? []) as { quick_request_id: string; unread_count: number }[]) {
    map.set(row.quick_request_id, Number(row.unread_count));
  }
  return map;
}

export async function fetchQuickRequestUnreadTotal(userId: string): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('quick_request_unread_total', { p_user: userId });

  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}

// ---------------------------------------------------------------------------
// 알림 수신자 조회 (resolveChatRecipients 입력)
// ---------------------------------------------------------------------------

/** 그 건에 `author_role='admin'` 메시지를 쓴 admin (방금 insert한 메시지 포함) */
export async function listChatAdminParticipantIds(requestId: string): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select('author_user_id')
    .eq('quick_request_id', requestId)
    .eq('author_role', 'admin');

  if (error) {
    throw new Error(error.message);
  }
  return [...new Set((data ?? []).map((row) => row.author_user_id as string))];
}

/** 주어진 사용자 중 `status<>'active'`(또는 프로필 없음) */
export async function listInactiveUserIds(userIds: string[]): Promise<string[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const profiles = await fetchProfileRows(unique);
  return unique.filter((userId) => profiles.get(userId)?.status !== 'active');
}

// ---------------------------------------------------------------------------
// 대화 목록 (plan 97 D-5 — 기간 ∪ 안 읽음(90일) · 검색 · 탭 · 커서 20건 · SQL 95 RPC quick_request_conversations_page)
// ---------------------------------------------------------------------------

function previewBody(body: string): string {
  const flat = body.trim();
  return flat.length > QUICK_CHAT_PREVIEW_LENGTH ? `${flat.slice(0, QUICK_CHAT_PREVIEW_LENGTH - 1)}…` : flat;
}

/** plan 98 D-9 · U-6 — `{본문 120자} (사진 2장·파일 1개)` / 본문 없음 → `사진 1장` (파일명 없음) */
export function buildConversationPreview(body: string, kinds: readonly QuickChatAttachmentKind[]): string {
  return buildChatBodyWithAttachmentSummary(previewBody(body), kinds);
}

async function fetchRowsByIds(ids: string[]): Promise<QuickRequestRow[]> {
  if (ids.length === 0) return [];
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('quick_requests').select(QUICK_REQUEST_COLUMNS).in('id', ids);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as QuickRequestRow[];
}

type ConversationPageItem = {
  id: string;
  has_message: boolean;
  sort_at: string;
  last_message_id: number | null;
  last_author_name: string | null;
  last_author_role: QuickChatAuthorRole | null;
  last_body: string | null;
  last_created_at: string | null;
  unread_count: number;
};

type ConversationPage = {
  items: ConversationPageItem[];
  total: number;
  unreadTotal: number;
};

export function clampQuickChatConversationsLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? QUICK_CHAT_CONVERSATIONS_PAGE_SIZE, 1), QUICK_CHAT_CONVERSATIONS_MAX_LIMIT);
}

export type QuickRequestConversationsQuery = {
  q?: string | null;
  tab?: QuickChatConversationTab;
  range: QuickRange;
  cursor?: QuickConversationCursor | null;
  limit?: number;
};

/**
 * 집합 = 선택 기간 안 건 ∪ 내가 안 읽은 메시지가 있는 건(기간 무관 · 90일 · 사이드바 합계와 동일 상한) · 조회 범위(본인 | viewer-all).
 * 정렬 = 메시지 있는 건(마지막 메시지 시각 desc) → 없는 건(요청 시각 desc) · tiebreak id desc — 93 정렬 유지.
 * 커서 = 직전 페이지 마지막 행의 (has_message, sort_at, id) · `totals`는 첫 페이지(cursor 없음)에만, tab 무관(q 적용 후).
 */
export async function listQuickRequestConversations(
  profile: QuickViewerProfile,
  filters: QuickRequestConversationsQuery
): Promise<QuickRequestConversationsData> {
  const limit = clampQuickChatConversationsLimit(filters.limit);
  const keyword = filters.q ? normalizeQuickRequestSearch(filters.q) : '';
  const viewAll = canViewAllQuickRequests(profile);
  const supabase = getServiceRoleClient();
  // plan 101 — RPC(SQL 97)가 참여 건을 범위에 넣는다. 행 `isParticipant` 표시용으로 참여 건 id를 한 번 더 읽는다(비-viewer-all만)
  const participantSet = new Set(viewAll ? [] : await listParticipantRequestIds(profile.user_id));
  const { data, error } = await supabase.rpc('quick_request_conversations_page', {
    p_user: profile.user_id,
    p_view_all: viewAll,
    p_from: filters.range.fromIso,
    p_to: filters.range.toIso,
    p_q: keyword || null,
    p_unread_only: filters.tab === 'unread',
    p_cursor_has_message: filters.cursor?.hasMessage ?? null,
    p_cursor_sort_at: filters.cursor?.sortAt ?? null,
    p_cursor_id: filters.cursor?.requestId ?? null,
    p_limit: limit
  });

  if (error) {
    throw new Error(error.message);
  }

  const page = (data ?? { items: [], total: 0, unreadTotal: 0 }) as ConversationPage;
  const items = page.items.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor =
    page.items.length > limit && last
      ? encodeConversationCursor({ hasMessage: last.has_message, sortAt: last.sort_at, requestId: last.id })
      : null;

  const [rowsList, kindsByMessage] = await Promise.all([
    fetchRowsByIds(items.map((item) => item.id)),
    listQuickChatAttachmentKindsByMessageIds(
      items.flatMap((item) => (item.last_message_id != null ? [Number(item.last_message_id)] : []))
    )
  ]);
  const rowsById = new Map(rowsList.map((row) => [row.id, row] as const));
  const conversations: QuickRequestConversation[] = [];
  for (const item of items) {
    const row = rowsById.get(item.id);
    if (!row) continue;
    conversations.push({
      ...toChatRequestSummary(row),
      lastMessage:
        item.last_message_id != null && item.last_author_role && item.last_created_at
          ? {
              id: Number(item.last_message_id),
              authorName: item.last_author_name ?? '',
              authorRole: item.last_author_role,
              body: buildConversationPreview(item.last_body ?? '', kindsByMessage.get(Number(item.last_message_id)) ?? []),
              createdAt: item.last_created_at
            }
          : null,
      unreadCount: Number(item.unread_count ?? 0),
      isParticipant: participantSet.has(row.id) && row.requester_user_id !== profile.user_id
    });
  }

  return {
    conversations,
    nextCursor,
    ...(filters.cursor
      ? {}
      : { totals: { conversations: Number(page.total ?? 0), unreadConversations: Number(page.unreadTotal ?? 0) } })
  };
}

export { fetchQuickRequestUnreadCounts };
