/**
 * plan 93 C-13 · C-20 — 메시지 목록 파생 (순수 함수 · 단위 테스트 대상).
 * - 날짜 구분선: `dayKey(createdAt)`가 바뀌는 지점 (호출자는 `formatAbsoluteDateKo`를 넘긴다)
 * - 「여기부터 새 메시지」: 남이 쓴 서버 메시지 중 id > 내 읽음 위치인 첫 메시지 앞 (한 번만)
 * - 연속 묶음: 같은 작성자가 5분 안에 보낸 메시지는 첫 번째에만 이름·배지·아바타, 마지막에만 시각
 * 임시(optimistic · id가 문자열) 메시지는 unread 판정에서 제외한다.
 *
 * plan 101 D-7 — 참여자 이벤트(`events` · 초대/제외/나가기)를 **시스템 줄**(`type: 'system'`)로 메시지 시각 순에 끼운다.
 * 메시지 순서(서버 id 순 · 임시 행 뒤)는 그대로 두고, 이벤트는 `at ≤ 다음 메시지 createdAt`인 자리에 삽입(동률이면 이벤트가 앞).
 * 날짜 경계는 메시지·이벤트 공통으로 판정(이벤트만 있는 날도 date 구분선 1개) · 이벤트는 양쪽 메시지 묶음을 끊는다.
 */

export const QUICK_CHAT_GROUP_WINDOW_MS = 5 * 60 * 1000;

export type QuickChatGroupableMessage = {
  /** 서버 id(number) 또는 임시 id(`temp-…`) */
  id: number | string;
  authorUserId: string;
  createdAt: string;
};

/** plan 101 — 시스템 줄 원천 (`GET …/messages` `events[]`) */
export type QuickChatSystemEvent = {
  type: 'joined' | 'removed' | 'left';
  userId: string;
  name: string;
  /** ISO · joined = invited_at · removed/left = removed_at */
  at: string;
};

export type QuickChatDateItem = { type: 'date'; key: string; label: string };
export type QuickChatUnreadItem = { type: 'unread'; key: string };
export type QuickChatSystemItem = { type: 'system'; key: string; event: QuickChatSystemEvent };
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
  | QuickChatSystemItem
  | QuickChatMessageItemGroup<T>;

export type GroupMessagesOptions = {
  myUserId: string;
  /** 대화를 연 시점의 내 읽음 위치 (갱신돼도 구분선이 사라지지 않게 호출자가 고정) */
  myLastReadMessageId: number;
  /** 날짜 경계 키 + 라벨 (기본: ISO 앞 10자 — 컴포넌트는 `formatAbsoluteDateKo`를 넘긴다) */
  dayKey?: (createdAt: string) => string;
  /** plan 101 — 참여자 이벤트 (없으면 기존 출력과 동일) */
  events?: readonly QuickChatSystemEvent[];
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

type TimelineEntry<T extends QuickChatGroupableMessage> =
  | { kind: 'message'; at: string; message: T }
  | { kind: 'event'; at: string; event: QuickChatSystemEvent };

function timeOf(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

/**
 * 메시지 순서는 유지하고 이벤트를 시각 순으로 끼운다 — 이벤트 `at ≤ 메시지 createdAt`이면 그 메시지 앞(동률 포함).
 * 임시(optimistic) 메시지는 항상 뒤이므로 그보다 늦은 이벤트도 임시 행 앞에 온다(서버 행 기준으로만 비교).
 */
export function buildChatTimeline<T extends QuickChatGroupableMessage>(
  messages: readonly T[],
  events: readonly QuickChatSystemEvent[]
): TimelineEntry<T>[] {
  if (events.length === 0) {
    return messages.map((message) => ({ kind: 'message', at: message.createdAt, message }));
  }
  const sortedEvents = [...events].sort((a, b) => timeOf(a.at) - timeOf(b.at));
  const timeline: TimelineEntry<T>[] = [];
  let eventIndex = 0;

  for (const message of messages) {
    if (isServerId(message.id)) {
      const messageTime = timeOf(message.createdAt);
      while (eventIndex < sortedEvents.length && timeOf(sortedEvents[eventIndex].at) <= messageTime) {
        const event = sortedEvents[eventIndex];
        timeline.push({ kind: 'event', at: event.at, event });
        eventIndex += 1;
      }
    } else {
      // 임시 행 앞에서 남은 이벤트를 모두 비운다 (임시 행은 「지금」이므로 어떤 이벤트보다 뒤)
      while (eventIndex < sortedEvents.length) {
        const event = sortedEvents[eventIndex];
        timeline.push({ kind: 'event', at: event.at, event });
        eventIndex += 1;
      }
    }
    timeline.push({ kind: 'message', at: message.createdAt, message });
  }
  while (eventIndex < sortedEvents.length) {
    const event = sortedEvents[eventIndex];
    timeline.push({ kind: 'event', at: event.at, event });
    eventIndex += 1;
  }
  return timeline;
}

export function systemItemKey(event: QuickChatSystemEvent): string {
  return `system-${event.type}-${event.userId}-${event.at}`;
}

export function groupMessages<T extends QuickChatGroupableMessage>(
  messages: readonly T[],
  options: GroupMessagesOptions
): QuickChatListItem<T>[] {
  const dayKey = options.dayKey ?? defaultDayKey;
  const firstUnreadId = findFirstUnreadMessageId(messages, options);
  const timeline = buildChatTimeline(messages, options.events ?? []);
  const items: QuickChatListItem<T>[] = [];
  let currentDay: string | null = null;

  for (let index = 0; index < timeline.length; index += 1) {
    const entry = timeline[index];
    const day = dayKey(entry.at);
    let boundaryBefore = false;
    if (day !== currentDay) {
      currentDay = day;
      boundaryBefore = true;
      items.push({ type: 'date', key: `date-${day}`, label: day });
    }

    if (entry.kind === 'event') {
      items.push({ type: 'system', key: systemItemKey(entry.event), event: entry.event });
      continue;
    }

    const { message } = entry;
    const previousEntry = index > 0 ? timeline[index - 1] : null;
    const nextEntry = index + 1 < timeline.length ? timeline[index + 1] : null;
    const previous = previousEntry?.kind === 'message' ? previousEntry.message : null;
    const next = nextEntry?.kind === 'message' ? nextEntry.message : null;
    let boundaryAfter = false;

    if (firstUnreadId !== null && message.id === firstUnreadId) {
      boundaryBefore = true;
      items.push({ type: 'unread', key: 'unread' });
    }

    if (nextEntry) {
      if (dayKey(nextEntry.at) !== day) boundaryAfter = true;
      if (next && firstUnreadId !== null && next.id === firstUnreadId) boundaryAfter = true;
    }

    // 이전·다음이 이벤트면 `previous`/`next`가 null → 묶음이 끊긴다
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
