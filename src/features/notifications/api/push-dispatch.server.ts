import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { groupOfType } from '../lib/push-groups';
import { resolveNotificationRoute } from '../lib/notification-route';
import type { NotificationMetadata, NotificationType } from './types';
import { isPushConfigured, sendPush, type PushPayload } from './push-sender.server';
import {
  deletePushSubscriptionsByIds,
  listPushSubscriptionsByUsers,
  getDisabledPushGroupsByUsers,
  touchPushSubscriptions,
  type PushSubscriptionRow
} from './push-subscriptions.server';

/**
 * plan 91 — 알림 INSERT 뒤 OS 푸시 발송. `insertNotifications()`가 `after()`에서 호출한다.
 * 실패해도 호출한 mutation 응답은 바뀌지 않는다 (console.error만). 재시도 Out.
 */

export type InsertedNotification = {
  id: number;
  recipient_user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: NotificationMetadata | null;
};

export type PushDispatchSummary = {
  attempted: number;
  sent: number;
  removed: number;
  failed: number;
};

const EMPTY: PushDispatchSummary = { attempted: 0, sent: 0, removed: 0, failed: 0 };

async function listActiveRecipientIds(userIds: string[]): Promise<Set<string>> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .in('user_id', userIds)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.user_id as string));
}

async function countUnread(userId: string): Promise<number | null> {
  const supabase = getServiceRoleClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .eq('status', 'unread');
  if (error) {
    console.error('[push] unread count failed:', error.message);
    return null;
  }
  return count ?? null;
}

/**
 * 구독 묶음에 payload를 병렬 발송하고 404/410 구독은 삭제, 성공 구독은 last_used_at 갱신.
 * `dispatchPush`와 테스트 발송 Route가 공용으로 쓴다.
 */
export async function sendToSubscriptions(
  jobs: Array<{ subscription: PushSubscriptionRow; payload: PushPayload }>
): Promise<PushDispatchSummary> {
  if (jobs.length === 0) return { ...EMPTY };

  const results = await Promise.allSettled(
    jobs.map((job) => sendPush(job.subscription, job.payload))
  );

  const succeeded = new Set<number>();
  const gone = new Set<number>();
  let failed = 0;

  results.forEach((result, index) => {
    const id = jobs[index].subscription.id;
    if (result.status === 'rejected') {
      failed += 1;
      console.error('[push] send rejected:', result.reason);
      return;
    }
    if (result.value.ok) {
      succeeded.add(id);
      return;
    }
    if (result.value.gone) {
      gone.add(id);
      return;
    }
    failed += 1;
    console.error(
      `[push] send failed (status ${result.value.statusCode ?? 'n/a'}):`,
      result.value.message
    );
  });

  try {
    await deletePushSubscriptionsByIds([...gone]);
  } catch (error) {
    console.error('[push] gone subscription delete failed:', error instanceof Error ? error.message : error);
  }
  try {
    await touchPushSubscriptions([...succeeded]);
  } catch (error) {
    console.error('[push] last_used_at update failed:', error instanceof Error ? error.message : error);
  }

  return { attempted: jobs.length, sent: succeeded.size, removed: gone.size, failed };
}

export async function dispatchPush(inserted: InsertedNotification[]): Promise<PushDispatchSummary> {
  try {
    if (inserted.length === 0 || !isPushConfigured()) {
      return { ...EMPTY };
    }

    const recipientIds = [...new Set(inserted.map((row) => row.recipient_user_id))];
    const activeIds = await listActiveRecipientIds(recipientIds);
    if (activeIds.size === 0) return { ...EMPTY };

    const activeList = [...activeIds];
    const [disabledByUser, subscriptions] = await Promise.all([
      getDisabledPushGroupsByUsers(activeList),
      listPushSubscriptionsByUsers(activeList)
    ]);
    if (subscriptions.length === 0) return { ...EMPTY };

    const subsByUser = new Map<string, PushSubscriptionRow[]>();
    for (const sub of subscriptions) {
      const list = subsByUser.get(sub.user_id) ?? [];
      list.push(sub);
      subsByUser.set(sub.user_id, list);
    }

    const deliverable = inserted.filter((row) => {
      if (!activeIds.has(row.recipient_user_id)) return false;
      if (!subsByUser.has(row.recipient_user_id)) return false;
      const group = groupOfType(row.type);
      const disabled = disabledByUser.get(row.recipient_user_id);
      return !(group && disabled?.has(group));
    });
    if (deliverable.length === 0) return { ...EMPTY };

    const unreadByUser = new Map<string, number | null>();
    await Promise.all(
      [...new Set(deliverable.map((row) => row.recipient_user_id))].map(async (userId) => {
        unreadByUser.set(userId, await countUnread(userId));
      })
    );

    const jobs = deliverable.flatMap((row) => {
      const payload: PushPayload = {
        notificationId: row.id,
        title: row.title,
        body: row.body,
        url: resolveNotificationRoute({ type: row.type, metadata: row.metadata }),
        tag: `wakeone-${row.id}`,
        unreadCount: unreadByUser.get(row.recipient_user_id) ?? null
      };
      return (subsByUser.get(row.recipient_user_id) ?? []).map((subscription) => ({
        subscription,
        payload
      }));
    });

    return await sendToSubscriptions(jobs);
  } catch (error) {
    console.error('[push] dispatch failed:', error instanceof Error ? error.message : error);
    return { ...EMPTY };
  }
}
