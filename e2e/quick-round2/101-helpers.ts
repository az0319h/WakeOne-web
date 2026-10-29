import { expect, type Locator, type Page } from '@playwright/test';
import { createOrgChartTestUser, uniqueOrgChartEmail } from '../helpers/org-chart';
import {
  callAs,
  serviceClient,
  type AccountKey,
  type ApiResult,
  type QuickNotificationRow
} from '../quick-workflow/helpers';

/**
 * plan 101 — 퀵 채팅 참여자(초대 · 목록 · 제외 · 알림) e2e 공용
 * docs/plans/101_quick-chat-participants-plan.md
 * - API 계약: .claude/handoff/101-backend.md §2 · 셀렉터: 101-frontend.md §2
 * - 참여자 행은 `quick_requests` on delete cascade → cleanup이 E2E 건을 지우면 함께 사라진다
 */

export const PART_TEXT = {
  addParticipant: '참여자 추가',
  searchPlaceholder: '이름 또는 이메일 검색',
  candidatesEmpty: '검색 결과가 없습니다.',
  removeTitle: '참여자 제외',
  removeConfirm: '제외',
  leaveTitle: '대화 나가기',
  leaveConfirm: '나가기',
  roleRequester: '요청자',
  roleDongbang: '동방특송',
  roleAdmin: '관리자',
  roleParticipant: '참여자',
  dashboardBadge: '참여',
  cannotInvite: '초대할 수 없는 사용자입니다.',
  alreadyJoined: '이미 참여 중입니다.',
  inviteForbidden: '참여자를 추가할 권한이 없습니다.',
  userNotFound: '사용자를 찾을 수 없습니다.',
  leftToast: '대화에서 나갔습니다.',
  invitedToast: (name: string) => `${name}님을 초대했습니다.`,
  removedToast: (name: string) => `${name}님을 제외했습니다.`,
  invitedBy: (name: string) => `초대: ${name} · `,
  removeDescription: (name: string) => `${name}님을 이 대화에서 제외할까요? 이후 메시지를 볼 수 없습니다.`,
  inviteTitle: (no: string) => `퀵 ${no} 대화 초대`,
  removedTitle: (no: string) => `퀵 ${no} 대화에서 제외됨`,
  systemJoined: (name: string) => `${name}님이 참여했습니다 · `,
  systemRemoved: (name: string) => `${name}님이 제외되었습니다`,
  systemLeft: (name: string) => `${name}님이 나갔습니다`,
  logAdd: '퀵 대화 참여자 추가',
  logRemove: '퀵 대화 참여자 제외'
} as const;

/** D-5 — 참여자 빠른 답장 칩 4개 */
export const PARTICIPANT_REPLIES = ['확인했습니다', '연락 부탁드립니다', '감사합니다', '잠시만 기다려 주세요'] as const;

export const ACTION_ADD = 'quick_request.participant_add';
export const ACTION_REMOVE = 'quick_request.participant_remove';

export type ParticipantDto = {
  userId: string;
  name: string;
  role: 'requester' | 'dongbang' | 'admin' | 'participant';
  invitedBy: { userId: string; name: string } | null;
  invitedAt: string | null;
};
export type ParticipantEventDto = { type: 'joined' | 'removed' | 'left'; userId: string; name: string; at: string };
export type CandidateDto = { userId: string; name: string; email: string; affiliationLabel: string | null };

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function getParticipantsAs(account: AccountKey, requestNo: string): Promise<ApiResult> {
  return callAs(account, (api) => api.get(`/api/quick-request/${requestNo}/participants`));
}

export async function participantsDataAs(
  account: AccountKey,
  requestNo: string
): Promise<{ participants: ParticipantDto[]; events: ParticipantEventDto[] }> {
  const result = await getParticipantsAs(account, requestNo);
  expect(result.status, `GET participants ${requestNo} ${JSON.stringify(result.body)}`).toBe(200);
  return result.body.data as { participants: ParticipantDto[]; events: ParticipantEventDto[] };
}

export function candidatesAs(account: AccountKey, requestNo: string, q: string): Promise<ApiResult> {
  return callAs(account, (api) =>
    api.get(`/api/quick-request/${requestNo}/participants/candidates?q=${encodeURIComponent(q)}`)
  );
}

export async function candidateListAs(account: AccountKey, requestNo: string, q: string): Promise<CandidateDto[]> {
  const result = await candidatesAs(account, requestNo, q);
  expect(result.status, `GET candidates q=${q} ${JSON.stringify(result.body)}`).toBe(200);
  return (result.body.data as { candidates: CandidateDto[] }).candidates;
}

export function inviteAs(account: AccountKey, requestNo: string, userId: string): Promise<ApiResult> {
  return callAs(account, (api) => api.post(`/api/quick-request/${requestNo}/participants`, { data: { userId } }));
}

export function removeParticipantAs(account: AccountKey, requestNo: string, userId: string): Promise<ApiResult> {
  return callAs(account, (api) =>
    api.delete(`/api/quick-request/${requestNo}/participants/${encodeURIComponent(userId)}`)
  );
}

// ---------------------------------------------------------------------------
// DB (service role)
// ---------------------------------------------------------------------------

export type ParticipantDbRow = {
  id: number;
  quick_request_id: string;
  user_id: string;
  invited_by: string;
  invited_at: string;
  removed_at: string | null;
  removed_by: string | null;
};

export async function dbParticipants(requestId: string): Promise<ParticipantDbRow[]> {
  const { data, error } = await serviceClient()
    .from('quick_request_participants')
    .select('id, quick_request_id, user_id, invited_by, invited_at, removed_at, removed_by')
    .eq('quick_request_id', requestId)
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ParticipantDbRow[];
}

/** 수신자 1명의 퀵 알림 중 사건(`participant_invited` 등) 행 */
export async function dbParticipantNotifications(
  requestNo: string,
  event: 'participant_invited' | 'participant_removed',
  recipientUserId: string
): Promise<QuickNotificationRow[]> {
  const { data, error } = await serviceClient()
    .from('notifications')
    .select('id, recipient_user_id, type, title, body, metadata')
    .eq('recipient_user_id', recipientUserId)
    .eq('metadata->>quick_request_no', requestNo)
    .eq('metadata->>quick_request_event', event)
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuickNotificationRow[];
}

/** 일회용 계정 (example.com · `E2E ` 이름 → cleanup RPC가 삭제) */
export async function createDisposableEmployee(
  label: string,
  fullName: string,
  options: { status?: 'active' | 'pending_approval'; systemRole?: 'admin' | 'user' } = {}
): Promise<{ userId: string; email: string; fullName: string }> {
  const email = uniqueOrgChartEmail(label);
  const created = await createOrgChartTestUser(label, {
    email,
    fullName,
    affiliation: 'wake',
    rank: '마케팅팀',
    position_level: '사원',
    system_role: options.systemRole ?? 'user',
    status: options.status ?? 'active',
    phone: '01055550101'
  });
  return { userId: created.userId, email, fullName };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export function participantsButton(page: Page): Locator {
  return page.getByTestId('quick-chat-participants-button').filter({ visible: true }).first();
}

/** 「참여자 N」 클릭 → Popover(lg↑)·Drawer(미만) 컨테이너가 보일 때까지 기다린다 */
export async function openParticipants(page: Page, layout: 'popover' | 'drawer' = 'popover'): Promise<Locator> {
  const button = participantsButton(page);
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
  const container = page.getByTestId(`quick-chat-participants-${layout}`);
  await expect(container).toBeVisible({ timeout: 10_000 });
  await expect(container.getByTestId('quick-chat-participants-panel')).toHaveAttribute('data-mode', 'list');
  return container;
}

export function participantRow(scope: Locator | Page, userId: string): Locator {
  return scope.getByTestId(`quick-chat-participant-${userId}`);
}

export function systemLines(page: Page, type: 'joined' | 'removed' | 'left', userId: string): Locator {
  return page.locator(`[data-event-type="${type}"][data-user-id="${userId}"]`).getByTestId('quick-chat-system-line');
}

export async function closeOverlay(page: Page) {
  await page.keyboard.press('Escape');
}
