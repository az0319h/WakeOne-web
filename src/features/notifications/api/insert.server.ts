import 'server-only';

import { after } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { DONGBANG_AFFILIATION } from '@/features/users/constants/organization';
import {
  partitionNotificationRowsForDongbang,
  summarizeDroppedTypes
} from '../lib/dongbang-notification-guard';
import { isNotificationTypeAllowedForDongbang } from '../lib/push-groups';
import { dispatchPush, type InsertedNotification } from './push-dispatch.server';
import type { NotificationType } from './types';

/**
 * plan 91 — `notifications` INSERT 단일 진입점 (AC-17: 이 파일 외 `.from('notifications').insert` 금지).
 * INSERT 성공 후 `after()`로 응답 뒤에 `dispatchPush()`를 돌린다. after()를 쓸 수 없는 컨텍스트(요청 스코프 밖)면
 * fire-and-forget으로 떨어진다. 어느 경우든 푸시 실패는 INSERT 결과·호출부 응답을 바꾸지 않는다.
 *
 * plan 95 D-4 — 동방특송 수신 가드: 수신자가 동방특송이면 `quick_request`·`profile` 그룹 type만 INSERT한다.
 * 나머지는 조용히 버리고 `console.warn` 1줄만 남긴다. 반환값(및 푸시)은 남은 행 기준이다.
 *
 * 에러: Supabase error → `throw new Error(error.message)` (기존 fan-out 호출부 의미 그대로. console.error만 하던 곳은 호출부가 catch한다).
 */

export type NotificationInsertRow = {
  recipient_user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};

const INSERTED_COLUMNS = 'id, recipient_user_id, type, title, body, metadata';

function scheduleDispatch(inserted: InsertedNotification[]): void {
  if (inserted.length === 0) return;
  const run = () => dispatchPush(inserted);
  try {
    after(run);
  } catch (error) {
    // after()는 요청 스코프 밖(예: 테스트·스크립트)에서 throw — fallback fire-and-forget
    console.warn('[push] after() unavailable, falling back to fire-and-forget:', error instanceof Error ? error.message : error);
    void run();
  }
}

/** 수신자 중 동방특송 소속 user_id 집합 (service role · 1회 조회) */
async function listDongbangRecipientIds(
  supabase: ReturnType<typeof getServiceRoleClient>,
  recipientIds: readonly string[]
): Promise<Set<string>> {
  const unique = [...new Set(recipientIds)];
  if (unique.length === 0) return new Set();

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .in('user_id', unique)
    .eq('affiliation', DONGBANG_AFFILIATION);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => row.user_id as string));
}

export async function insertNotifications(
  rows: NotificationInsertRow | NotificationInsertRow[]
): Promise<InsertedNotification[]> {
  const requested = Array.isArray(rows) ? rows : [rows];
  if (requested.length === 0) return [];

  const supabase = getServiceRoleClient();

  const dongbangIds = await listDongbangRecipientIds(
    supabase,
    requested.map((row) => row.recipient_user_id)
  );
  const { kept: list, dropped } = partitionNotificationRowsForDongbang(
    requested,
    dongbangIds,
    isNotificationTypeAllowedForDongbang
  );
  if (dropped.length > 0) {
    console.warn(
      `[notifications] plan 95 dongbang guard dropped ${dropped.length} row(s): ${summarizeDroppedTypes(dropped)}`
    );
  }
  if (list.length === 0) return [];

  const { data, error } = await supabase
    .from('notifications')
    .insert(list)
    .select(INSERTED_COLUMNS);

  if (error) {
    throw new Error(error.message);
  }

  const inserted = (data ?? []) as InsertedNotification[];
  scheduleDispatch(inserted);
  return inserted;
}
