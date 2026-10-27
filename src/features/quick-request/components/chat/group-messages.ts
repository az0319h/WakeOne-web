/**
 * plan 93 C-13 · C-20 — 메시지 목록 파생 (순수 함수 · 단위 테스트 대상).
 * - 날짜 구분선: `dayKey(createdAt)`가 바뀌는 지점 (호출자는 `formatAbsoluteDateKo`를 넘긴다)
 * - 「여기부터 새 메시지」: 남이 쓴 서버 메시지 중 id > 내 읽음 위치인 첫 메시지 앞 (한 번만)
 * - 연속 묶음: 같은 작성자가 5분 안에 보낸 메시지는 첫 번째에만 이름·배지·아바타, 마지막에만 시각
 * 임시(optimistic · id가 문자열) 메시지는 unread 판정에서 제외한다.
 */

export const QUICK_CHAT_GROUP_WINDOW_MS = 5 * 60 * 1000;

export type QuickChatGroupableMessage = {
  /** 서버 id(number) 또는 임시 id(`temp-…`) */
  id: number | string;
  authorUserId: string;
  createdAt: string;
};

export type QuickChatDateItem = { type: 'date'; key: string; label: string };
export type QuickChatUnreadItem = { type: 'unread'; key: string };
export type QuickChatMessageItemGroup<T extends QuickChatGroupableMessage> = {
  type: 'message';
  key: string;
  message: T;
  /** 이름·역할 배지·아바타 표시 */
  isGroupStart: boolean;
  /** 시각 표시 */
  isGroupEnd: boolean;
};

export type QuickChatListItem<T extends QuickChatGroupableMessage> =
  | QuickChatDateItem
  | QuickChatUnreadItem
  | QuickChatMessageItemGroup<T>;

export type GroupMessagesOptions = {
  myUserId: string;
  /** 대화를 연 시점의 내 읽음 위치 (갱신돼도 구분선이 사라지지 않게 호출자가 고정) */
  myLastReadMessageId: number;
  /** 날짜 경계 키 + 라벨 (기본: ISO 앞 10자 — 컴포넌트는 `formatAbsoluteDateKo`를 넘긴다) */
  dayKey?: (createdAt: string) => string;
};

function defaultDayKey(createdAt: string): string {
  return createdAt.slice(0, 10);
}

function isServerId(id: number | string): id is number {
  return typeof id === 'number';
}

function sameGroup(a: QuickChatGroupableMessage, b: QuickChatGroupableMessage): boolean {
  if (a.authorUserId !== b.authorUserId) return false;
  const diff = Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return Number.isFinite(diff) && diff <= QUICK_CHAT_GROUP_WINDOW_MS;
}

export function findFirstUnreadMessageId<T extends QuickChatGroupableMessage>(
  messages: readonly T[],
  options: Pick<GroupMessagesOptions, 'myUserId' | 'myLastReadMessageId'>
): number | null {
  for (const message of messages) {
    if (
      isServerId(message.id) &&
      message.authorUserId !== options.myUserId &&
      message.id > options.myLastReadMessageId
    ) {
      return message.id;
    }
  }
  return null;
}

/** 남이 쓴 메시지 중 내 읽음 위치보다 큰 것의 수 (대시보드·서버 RPC와 같은 규칙) */
export function countUnreadMessages<T extends QuickChatGroupableMessage>(
  messages: readonly T[],
  options: Pick<GroupMessagesOptions, 'myUserId' | 'myLastReadMessageId'>
): number {
  let count = 0;
  for (const message of messages) {
    if (
      isServerId(message.id) &&
      message.authorUserId !== options.myUserId &&
      message.id > options.myLastReadMessageId
    ) {
      count += 1;
    }
  }
  return count;
}

export function groupMessages<T extends QuickChatGroupableMessage>(
  messages: readonly T[],
  options: GroupMessagesOptions
): QuickChatListItem<T>[] {
  const dayKey = options.dayKey ?? defaultDayKey;
  const firstUnreadId = findFirstUnreadMessageId(messages, options);
  const items: QuickChatListItem<T>[] = [];
  let currentDay: string | null = null;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = index > 0 ? messages[index - 1] : null;
    const next = index + 1 < messages.length ? messages[index + 1] : null;
    let boundaryBefore = false;
    let boundaryAfter = false;

    const day = dayKey(message.createdAt);
    if (day !== currentDay) {
      currentDay = day;
      boundaryBefore = true;
      items.push({ type: 'date', key: `date-${day}`, label: day });
    }

    if (firstUnreadId !== null && message.id === firstUnreadId) {
      boundaryBefore = true;
      items.push({ type: 'unread', key: 'unread' });
    }

    if (next) {
      if (dayKey(next.createdAt) !== day) boundaryAfter = true;
      if (firstUnreadId !== null && next.id === firstUnreadId) boundaryAfter = true;
    }

    const isGroupStart = boundaryBefore || !previous || !sameGroup(previous, message);
    const isGroupEnd = boundaryAfter || !next || !sameGroup(message, next);

    items.push({
      type: 'message',
      key: `message-${String(message.id)}`,
      message,
      isGroupStart,
      isGroupEnd
    });
  }

  return items;
}
