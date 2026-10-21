import { expect, type APIRequestContext } from '@playwright/test';

/** plan 87 — activity log API 검증 (admin `GET /api/activity-logs`) */
export type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  target_type?: string;
  target_label?: string;
  metadata?: Record<string, unknown>;
};

async function listActivityLogs(admin: APIRequestContext, action: string) {
  const response = await admin.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50&log_user=all`
  );
  expect(response.status(), `GET /api/activity-logs?action=${action}`).toBe(200);
  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogItem[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

/** request_id + action + http_status 행이 생길 때까지 poll 후 반환 */
export async function expectActivityLogRow(
  admin: APIRequestContext,
  action: string,
  requestId: string,
  status: number
): Promise<ActivityLogItem> {
  let matched: ActivityLogItem | undefined;
  await expect
    .poll(
      async () => {
        const logs = await listActivityLogs(admin, action);
        matched = logs.find(
          (item) =>
            item.request_id === requestId &&
            item.action === action &&
            item.http_status === status
        );
        return Boolean(matched);
      },
      { timeout: 15_000, message: `activity log ${action} ${status} ${requestId}` }
    )
    .toBe(true);
  return matched!;
}

export function requestIdOf(response: { headers(): Record<string, string> }) {
  const requestId = response.headers()['x-request-id'];
  expect(requestId, 'x-request-id header').toBeTruthy();
  return requestId;
}
