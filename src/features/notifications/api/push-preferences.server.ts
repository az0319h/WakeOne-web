import 'server-only';

import { listPushGroupsForRole, type PushGroupAudienceOptions } from '../lib/push-groups';
import { isPushConfigured } from './push-sender.server';
import {
  getDisabledPushGroups,
  listPushSubscriptions,
  toDeviceView
} from './push-subscriptions.server';
import type { PushPreferencesResponse } from './push-types';

/**
 * plan 91 — RSC prefetch용. `GET /api/notifications/push/preferences`와 **동일한 payload**를 만든다
 * (`pushPreferencesQueryOptions()` + `HydrationBoundary`). Route 핸들러 변경 시 함께 맞춘다.
 * plan 95 D-5 — 동방특송이면 `{ dongbang: true }`로 그룹 2개만 (Route GET과 동일).
 */
export async function getPushPreferencesForUser(
  userId: string,
  systemRole: string | null | undefined,
  options: PushGroupAudienceOptions = {}
): Promise<PushPreferencesResponse> {
  const [disabledGroups, subscriptions] = await Promise.all([
    getDisabledPushGroups(userId),
    listPushSubscriptions(userId)
  ]);

  return {
    configured: isPushConfigured(),
    disabled_groups: disabledGroups,
    device_count: subscriptions.length,
    devices: subscriptions.map(toDeviceView),
    groups: listPushGroupsForRole(systemRole === 'admin' ? 'admin' : 'user', options)
  };
}
