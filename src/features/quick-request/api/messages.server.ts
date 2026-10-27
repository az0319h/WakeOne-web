import 'server-only';

import { isDongbang, isQuickAdmin } from '@/features/auth/api/quick-access.server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { buildQuickRouteSummary } from '../lib/quick-request-route-label';
import {
  QUICK_CHAT_CONVERSATIONS_LIMIT,
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
import {
  canViewQuickRequest,
  fetchQuickRequestUnreadCounts,
  isQuickRequestLocked,
  listWindowRows,
  matchesQuickRequestSearch,
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

export class QuickRequestChatLockedError extends Error {
  constructor() {
    super('quick_request_locked');
  }
}

// ---------------------------------------------------------------------------
// 역할·권한
// ---------------------------------------------------------------------------

/** 작성자 역할 — 요청자 판정 우선 → 동방특송 → admin. 그 밖(구매물류팀)은 null(쓰기 불가) */
export function resolveChatAuthorRole(
  profile: QuickViewerProfile,
  row: Pick<QuickRequestRow, 'requester_user_id'>
): QuickChatAuthorRole | null {
  if (row.requester_user_id === profile.user_id) return 'requester';
  if (isDongbang(profile)) return 'dongbang';
  if (isQuickAdmin(profile)) return 'admin';
  return null;
}

/** 보는 사람 역할 — 조회 가능한 사람 중 쓰기 역할이 없으면 `logistics`(읽기 전용) */
export function resolveChatViewerRole(
  profile: QuickViewerProfile,
  row: Pick<QuickRequestRow, 'requester_user_id'>
): QuickChatViewerRole {
  return resolveChatAuthorRole(profile, row) ?? 'logistics';
}

export type QuickChatWriteState = {
  role: QuickChatViewerRole;
  canWrite: boolean;
  /** logistics > locked (designer 4.7) */
  readOnlyReason: QuickChatReadOnlyReason | null;
};

export function buildChatWriteState(profile: QuickViewerProfile, row: QuickRequestRow): QuickChatWriteState {
  const role = resolveChatViewerRole(profile, row);
  if (role === 'logistics') {
    return { role, canWrite: false, readOnlyReason: 'logistics' };
  }
  if (isQuickRequestLocked(row.status)) {
    return { role, canWrite: false, readOnlyReason: 'locked' };
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

export function toQuickRequestMessage(row: QuickRequestMessageRow): QuickRequestMessage {
  return {
    id: Number(row.id),
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    body: row.body,
    createdAt: row.created_at
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

async function fetchProfileRows(userIds: string[]): Promise<Map<string, ProfileNameRow>> {
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
  const profiles = await fetchProfileRows(reads.map((read) => read.user_id));

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
      role: resolveChatViewerRole(viewer, row),
      lastReadMessageId: Number(read.last_read_message_id),
      lastReadAt: read.last_read_at
    };
  });
}

export async function buildQuickRequestMessagesPayload(
  profile: QuickViewerProfile & { full_name: string | null; email: string },
  row: QuickRequestRow
): Promise<QuickRequestMessagesData> {
  const [messages, reads] = await Promise.all([listQuickRequestMessages(row.id), listQuickRequestReads(row)]);
  const writeState = buildChatWriteState(profile, row);
  const mine = reads.find((read) => read.userId === profile.user_id);
  const viewer: QuickRequestChatViewer = {
    userId: profile.user_id,
    name: resolveChatAuthorName(profile),
    role: writeState.role
  };

  return {
    request: toChatRequestSummary(row),
    viewer,
    messages: messages.map(toQuickRequestMessage),
    myLastReadMessageId: mine?.lastReadMessageId ?? 0,
    reads,
    canWrite: writeState.canWrite,
    readOnlyReason: writeState.readOnlyReason,
    quickReplies: writeState.canWrite ? [...QUICK_CHAT_QUICK_REPLIES[writeState.role]] : []
  };
}

// ---------------------------------------------------------------------------
// 쓰기 (RPC)
// ---------------------------------------------------------------------------

/** 잠금 검사 + insert + 보낸 사람 읽음 위치 갱신 (SQL 92 `create_quick_request_message`) */
export async function createQuickRequestMessage(input: {
  requestId: string;
  authorUserId: string;
  authorName: string;
  authorRole: QuickChatAuthorRole;
  body: string;
}): Promise<QuickRequestMessageRow> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('create_quick_request_message', {
    p_request: input.requestId,
    p_author: input.authorUserId,
    p_author_name: input.authorName,
    p_author_role: input.authorRole,
    p_body: input.body
  });

  if (error) {
    if (error.message?.includes('quick_request_locked')) {
      throw new QuickRequestChatLockedError();
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

async function fetchLastMessages(requestIds: string[]): Promise<Map<string, QuickRequestMessageRow>> {
  const map = new Map<string, QuickRequestMessageRow>();
  if (requestIds.length === 0) return map;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('quick_request_last_messages', { p_request_ids: requestIds });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as QuickRequestMessageRow[]) {
    map.set(row.quick_request_id, row);
  }
  return map;
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
// 대화 목록 (U-2 · 최근 7일 + 안 읽은 메시지 있는 건 · 최대 100)
// ---------------------------------------------------------------------------

function previewBody(body: string): string {
  const flat = body.trim();
  return flat.length > QUICK_CHAT_PREVIEW_LENGTH ? `${flat.slice(0, QUICK_CHAT_PREVIEW_LENGTH - 1)}…` : flat;
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

export async function listQuickRequestConversations(
  profile: QuickViewerProfile,
  filters: { q?: string | null; tab?: QuickChatConversationTab }
): Promise<QuickRequestConversationsData> {
  const [windowRows, unreadMap] = await Promise.all([
    listWindowRows(profile),
    fetchQuickRequestUnreadRequests(profile.user_id)
  ]);

  const rowsById = new Map(windowRows.map((row) => [row.id, row] as const));
  const extraIds = [...unreadMap.keys()].filter((id) => !rowsById.has(id));
  for (const row of await fetchRowsByIds(extraIds)) {
    if (canViewQuickRequest(profile, row)) {
      rowsById.set(row.id, row);
    }
  }

  const rows = [...rowsById.values()];
  const lastMessages = await fetchLastMessages(rows.map((row) => row.id));
  const keyword = filters.q ? normalizeQuickRequestSearch(filters.q) : '';

  const items: QuickRequestConversation[] = rows
    .filter((row) => !keyword || matchesQuickRequestSearch(row, keyword))
    .map((row) => {
      const last = lastMessages.get(row.id);
      return {
        ...toChatRequestSummary(row),
        lastMessage: last
          ? {
              id: Number(last.id),
              authorName: last.author_name,
              authorRole: last.author_role,
              body: previewBody(last.body),
              createdAt: last.created_at
            }
          : null,
        unreadCount: unreadMap.get(row.id) ?? 0
      };
    });

  // 마지막 메시지 시각 desc · 메시지 없는 건은 그 뒤에 requestedAt desc
  items.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt) || b.lastMessage.id - a.lastMessage.id;
    }
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return b.requestedAt.localeCompare(a.requestedAt);
  });

  const totals = {
    conversations: items.length,
    unreadConversations: items.filter((item) => item.unreadCount > 0).length
  };
  const visible = filters.tab === 'unread' ? items.filter((item) => item.unreadCount > 0) : items;

  return { conversations: visible.slice(0, QUICK_CHAT_CONVERSATIONS_LIMIT), totals };
}

export { fetchQuickRequestUnreadCounts };
