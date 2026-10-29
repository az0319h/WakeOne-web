import { mutationOptions, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { notificationKeys } from '@/features/notifications/api/keys';
import {
  applyMarkNotificationReadOptimistic,
  restoreNotificationQueries,
  snapshotNotificationQueries,
  type NotificationInfiniteData,
  type NotificationQueriesSnapshot
} from '@/features/notifications/api/optimistic';
import {
  getMessagesCache,
  mergeServerMessage,
  sortChatMessages,
  updateMessagesCache,
  type QuickChatAttachmentItem,
  type QuickChatMessagesCache
} from '../lib/quick-chat-cache';
import { quickRequestKeys } from './keys';
import {
  acceptQuickRequest,
  approveQuickRequest,
  cancelQuickRequest,
  createQuickRequest,
  createQuickRequestNote,
  deleteQuickChatAttachment,
  deleteQuickRequestNote,
  dispatchQuickRequest,
  inviteQuickRequestParticipant,
  markQuickRequestMessagesRead,
  prepareQuickChatAttachments,
  removeQuickRequestParticipant,
  sendQuickRequestMessage,
  setQuickRequestFinalAmount,
  updateQuickRequest,
  updateQuickRequestNote
} from './service';
import type {
  QuickRequestAttachmentPreparePayload,
  QuickRequestCancelPayload,
  QuickRequestChatViewer,
  QuickRequestConversationsData,
  QuickRequestCreatePayload,
  QuickRequestDispatchPayload,
  QuickRequestListResponse,
  QuickRequestNoteMutationPayload,
  QuickRequestPatchPayload
} from './types';

export { quickRequestKeys };

// plan 87 — 특이사항 칩 CUD · 캐시 갱신은 onSettled에서만

export const createQuickRequestNoteMutation = mutationOptions({
  mutationFn: (payload: QuickRequestNoteMutationPayload) => createQuickRequestNote(payload),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.all });
  }
});

export const updateQuickRequestNoteMutation = mutationOptions({
  mutationFn: (params: { id: number; payload: QuickRequestNoteMutationPayload }) =>
    updateQuickRequestNote(params),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.all });
  }
});

export const deleteQuickRequestNoteMutation = mutationOptions({
  mutationFn: (id: number) => deleteQuickRequestNote(id),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.all });
  }
});

// ---------------------------------------------------------------------------
// plan 89 — 퀵 업무 흐름 · 성공/실패(409 포함) 모두 목록·카드·상세를 다시 읽는다
// ---------------------------------------------------------------------------

function invalidateQuickRequestWorkflow() {
  const queryClient = getQueryClient();
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.summaries() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.details() });
}

/** 등록 — 최근 주소는 서버가 기록하므로 recent-addresses도 갱신한다 (plan 89 D-12) */
export const createQuickRequestMutation = mutationOptions({
  mutationFn: (payload: QuickRequestCreatePayload) => createQuickRequest(payload),
  onSettled: () => {
    invalidateQuickRequestWorkflow();
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.recentAddressesAll() });
  }
});

export const updateQuickRequestMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; payload: QuickRequestPatchPayload }) =>
    updateQuickRequest(params),
  onSettled: invalidateQuickRequestWorkflow
});

export const setQuickRequestFinalAmountMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; finalAmount: number }) =>
    setQuickRequestFinalAmount(params),
  onSettled: invalidateQuickRequestWorkflow
});

export const acceptQuickRequestMutation = mutationOptions({
  mutationFn: (requestNo: string) => acceptQuickRequest(requestNo),
  onSettled: invalidateQuickRequestWorkflow
});

export const dispatchQuickRequestMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; payload: QuickRequestDispatchPayload }) =>
    dispatchQuickRequest(params),
  onSettled: invalidateQuickRequestWorkflow
});

export const approveQuickRequestMutation = mutationOptions({
  mutationFn: (requestNo: string) => approveQuickRequest(requestNo),
  onSettled: invalidateQuickRequestWorkflow
});

export const cancelQuickRequestMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; payload?: QuickRequestCancelPayload }) =>
    cancelQuickRequest(params),
  onSettled: invalidateQuickRequestWorkflow
});

// ---------------------------------------------------------------------------
// plan 93 — 퀵 대화 (전송 optimistic · 읽음 위치 갱신 optimistic). 캐시 무효화는 onSettled에서만
// ---------------------------------------------------------------------------

export type SendQuickRequestMessageVariables = {
  requestNo: string;
  /** optimistic 말풍선 id (`temp-{uuid}`) — 재시도는 같은 tempId로 다시 호출한다 */
  tempId: string;
  body: string;
  /** 임시 말풍선 작성자 (messages 응답 `viewer`) */
  viewer: QuickRequestChatViewer;
  /** plan 98 — 업로드 완료된 pending 첨부 id (재시도는 같은 ids 재사용 · 재업로드 없음 · AC-10) */
  attachmentIds: number[];
  /** plan 98 — 임시 말풍선용 첨부 스냅샷 (`previewUrl` = 이미지 ObjectURL · 201 교체 후 revoke) */
  attachments: QuickChatAttachmentItem[];
};

/** 임시 말풍선 썸네일 ObjectURL 해제 — 서버 행으로 교체된 뒤(서명 URL로 다시 그린다) */
function revokeAttachmentPreviews(attachments: readonly QuickChatAttachmentItem[]) {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  for (const attachment of attachments) {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }
}

function invalidateQuickChatLists() {
  const queryClient = getQueryClient();
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.conversationsAll() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
}

/**
 * 전송 — `onMutate`에서 임시 말풍선(pending) 추가 → 201이면 서버 행으로 교체(Realtime 수신분은 id dedupe) →
 * 실패면 `failed`로 표시(입력 복원·토스트는 UI `useSendMessage`). 내 읽음 위치는 서버가 올리므로 캐시도 맞춘다.
 */
export const sendQuickRequestMessageMutation = mutationOptions({
  mutationFn: (variables: SendQuickRequestMessageVariables) =>
    sendQuickRequestMessage({
      requestNo: variables.requestNo,
      payload: { body: variables.body, attachmentIds: variables.attachmentIds }
    }),
  onMutate: (variables) => {
    const queryClient = getQueryClient();
    const authorRole = variables.viewer.role === 'logistics' ? 'requester' : variables.viewer.role;
    updateMessagesCache(queryClient, variables.requestNo, (current) => {
      const existing = current.messages.find((message) => message.id === variables.tempId);
      const temp = existing
        ? { ...existing, clientState: 'pending' as const, createdAt: new Date().toISOString() }
        : {
            id: variables.tempId,
            authorUserId: variables.viewer.userId,
            authorName: variables.viewer.name,
            authorRole,
            body: variables.body,
            createdAt: new Date().toISOString(),
            attachments: variables.attachments,
            clientState: 'pending' as const
          };
      const rest = current.messages.filter((message) => message.id !== variables.tempId);
      return { ...current, messages: sortChatMessages([...rest, temp]) };
    });
  },
  onSuccess: (data, variables) => {
    const queryClient = getQueryClient();
    updateMessagesCache(queryClient, variables.requestNo, (current) => ({
      ...current,
      messages: mergeServerMessage(current.messages, data.message, {
        myUserId: variables.viewer.userId,
        replaceTempId: variables.tempId
      }),
      myLastReadMessageId: Math.max(current.myLastReadMessageId, data.message.id)
    }));
    revokeAttachmentPreviews(variables.attachments);
  },
  onError: (_error, variables) => {
    const queryClient = getQueryClient();
    updateMessagesCache(queryClient, variables.requestNo, (current) => ({
      ...current,
      messages: current.messages.map((message) =>
        message.id === variables.tempId ? { ...message, clientState: 'failed' as const } : message
      )
    }));
  },
  onSettled: () => {
    invalidateQuickChatLists();
  }
});

// ---------------------------------------------------------------------------
// plan 98 — 첨부 prepare(pending 행 + 서명 업로드 URL) · pending 취소. pending 행은 어떤 Read 캐시에도 보이지 않으므로
// (RLS SELECT는 연결된 행만) 여기서는 invalidate 대상이 없다 — 메시지 전송(`sendQuickRequestMessageMutation`)이 목록을 갱신한다.
// ---------------------------------------------------------------------------

export const prepareQuickChatAttachmentsMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; payload: QuickRequestAttachmentPreparePayload }) =>
    prepareQuickChatAttachments(params)
});

export const deleteQuickChatAttachmentMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; attachmentId: number }) =>
    deleteQuickChatAttachment(params.requestNo, params.attachmentId)
});

// ---------------------------------------------------------------------------
// plan 101 — 퀵 대화 참여자 초대·제외(나가기). 캐시 무효화는 onSettled에서만:
// messages(no)(헤더 N·패널·시스템 줄) · 후보 검색 · 「퀵 대화」 목록·대시보드 목록·카드(참여 건 포함 여부 · 「참여」 배지)
// ---------------------------------------------------------------------------

export type QuickRequestParticipantVariables = {
  requestNo: string;
  userId: string;
};

function invalidateQuickRequestParticipants(requestNo: string) {
  const queryClient = getQueryClient();
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.messages(requestNo) });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.participantCandidatesAll() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.conversationsAll() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.summaries() });
}

/** POST …/participants — 201 `{ participant }` · 400/403/404/409 message는 UI가 notifyError */
export const inviteQuickRequestParticipantMutation = mutationOptions({
  mutationFn: (variables: QuickRequestParticipantVariables) => inviteQuickRequestParticipant(variables),
  onSettled: (_data, _error, variables) => {
    invalidateQuickRequestParticipants(variables.requestNo);
  }
});

/** DELETE …/participants/[userId] — 제외·본인 나가기 공용 (`data.self`). 본인 나가기 뒤 이동은 UI 몫 */
export const removeQuickRequestParticipantMutation = mutationOptions({
  mutationFn: (variables: QuickRequestParticipantVariables) => removeQuickRequestParticipant(variables),
  onSettled: (_data, _error, variables) => {
    invalidateQuickRequestParticipants(variables.requestNo);
  }
});

export type MarkQuickRequestMessagesReadVariables = {
  requestNo: string;
  lastMessageId: number;
};

/** plan 97 D-5 — 「퀵 대화」 목록 캐시 형태 (`useInfiniteQuery` · 커서 string|null) */
export type QuickRequestConversationsInfiniteData = InfiniteData<QuickRequestConversationsData, string | null>;

type MarkReadContext = {
  conversations: Array<[QueryKey, QuickRequestConversationsInfiniteData | undefined]>;
  lists: Array<[QueryKey, QuickRequestListResponse['data'] | undefined]>;
  unreadTotal: number | undefined;
  messages: QuickChatMessagesCache | null | undefined;
  notifications: NotificationQueriesSnapshot;
};

/** 알림 캐시에서 그 건의 `chat_message` · unread 알림 id (C-21 optimistic 대상) */
function collectUnreadChatNotificationIds(
  snapshot: Array<[QueryKey, NotificationInfiniteData | undefined]>,
  requestNo: string
): number[] {
  const ids = new Set<number>();
  for (const [, data] of snapshot) {
    for (const page of data?.pages ?? []) {
      for (const notification of page.notifications) {
        if (
          notification.status === 'unread' &&
          notification.type === 'quick_request.chat_message' &&
          notification.metadata?.quick_request_no === requestNo
        ) {
          ids.add(notification.id);
        }
      }
    }
  }
  return [...ids];
}

/**
 * 읽음 위치 갱신 (C-11 · C-21) — `onMutate`: 그 건 unreadCount 0 · unreadTotal 감산 · 알림 optimistic read(벨 즉시 감소) ·
 * `onError`: 되돌림 · `onSettled`: lists·conversations·unreadTotal·notifications invalidate. 로그 Out(자동 동작).
 */
export const markQuickRequestMessagesReadMutation = mutationOptions({
  mutationFn: (variables: MarkQuickRequestMessagesReadVariables) =>
    markQuickRequestMessagesRead({
      requestNo: variables.requestNo,
      payload: { lastMessageId: variables.lastMessageId }
    }),
  onMutate: (variables): MarkReadContext => {
    const queryClient = getQueryClient();
    const context: MarkReadContext = {
      conversations: queryClient.getQueriesData<QuickRequestConversationsInfiniteData>({
        queryKey: quickRequestKeys.conversationsAll()
      }),
      lists: queryClient.getQueriesData<QuickRequestListResponse['data']>({
        queryKey: quickRequestKeys.lists()
      }),
      unreadTotal: queryClient.getQueryData<number>(quickRequestKeys.unreadTotal()),
      messages: getMessagesCache(queryClient, variables.requestNo),
      notifications: snapshotNotificationQueries(queryClient)
    };

    // 감산할 수 — 대화 캐시(남이 쓴 메시지 중 읽음 위치 < id ≤ lastMessageId) → 없으면 목록 캐시의 unreadCount
    let unreadBefore = 0;
    const messages = context.messages;
    if (messages) {
      unreadBefore = messages.messages.filter(
        (message) =>
          typeof message.id === 'number' &&
          message.authorUserId !== messages.viewer.userId &&
          message.id > messages.myLastReadMessageId &&
          message.id <= variables.lastMessageId
      ).length;
    } else {
      outer: for (const [, data] of context.conversations) {
        for (const page of data?.pages ?? []) {
          const found = page.conversations.find((item) => item.requestNo === variables.requestNo);
          if (found) {
            unreadBefore = found.unreadCount;
            break outer;
          }
        }
      }
    }

    // 무한 목록: 모든 페이지에서 그 건 unreadCount 0 · totals(첫 페이지에만 있음) unreadConversations -1
    queryClient.setQueriesData<QuickRequestConversationsInfiniteData>(
      { queryKey: quickRequestKeys.conversationsAll() },
      (current) => {
        if (!current) return current;
        const hasUnreadTarget = current.pages.some((page) =>
          page.conversations.some((item) => item.requestNo === variables.requestNo && item.unreadCount > 0)
        );
        if (!hasUnreadTarget) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((item) =>
              item.requestNo === variables.requestNo ? { ...item, unreadCount: 0 } : item
            ),
            ...(page.totals
              ? {
                  totals: {
                    conversations: page.totals.conversations,
                    unreadConversations: Math.max(0, page.totals.unreadConversations - 1)
                  }
                }
              : {})
          }))
        };
      }
    );

    queryClient.setQueriesData<QuickRequestListResponse['data']>(
      { queryKey: quickRequestKeys.lists() },
      (current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) =>
                row.requestNo === variables.requestNo ? { ...row, unreadMessageCount: 0 } : row
              )
            }
          : current
    );

    if (unreadBefore > 0) {
      queryClient.setQueryData<number>(quickRequestKeys.unreadTotal(), (current) =>
        typeof current === 'number' ? Math.max(0, current - unreadBefore) : current
      );
    }

    updateMessagesCache(queryClient, variables.requestNo, (current) => {
      const readAt = new Date().toISOString();
      const nextId = Math.max(current.myLastReadMessageId, variables.lastMessageId);
      return {
        ...current,
        myLastReadMessageId: nextId,
        reads: current.reads.map((read) =>
          read.userId === current.viewer.userId
            ? { ...read, lastReadMessageId: Math.max(read.lastReadMessageId, nextId), lastReadAt: readAt }
            : read
        )
      };
    });

    for (const id of collectUnreadChatNotificationIds(context.notifications, variables.requestNo)) {
      applyMarkNotificationReadOptimistic(queryClient, id);
    }

    return context;
  },
  onError: (_error, _variables, context) => {
    if (!context) return;
    const queryClient = getQueryClient();
    for (const [queryKey, data] of context.conversations) {
      queryClient.setQueryData(queryKey, data);
    }
    for (const [queryKey, data] of context.lists) {
      queryClient.setQueryData(queryKey, data);
    }
    queryClient.setQueryData(quickRequestKeys.unreadTotal(), context.unreadTotal);
    if (context.messages !== undefined) {
      queryClient.setQueryData(quickRequestKeys.messages(_variables.requestNo), context.messages);
    }
    restoreNotificationQueries(queryClient, context.notifications);
  },
  onSettled: () => {
    const queryClient = getQueryClient();
    void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: quickRequestKeys.conversationsAll() });
    void queryClient.invalidateQueries({ queryKey: quickRequestKeys.unreadTotal() });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  }
});
