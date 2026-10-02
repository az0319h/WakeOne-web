import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  countApprovalRequestAdminNotificationsForAdmins,
  createFreshPendingGoogleUser,
  filterApprovalRequestAdminNotifications,
  listActiveAdminUserIds,
  listNotificationsForUser,
  promoteUserToActiveAdmin,
  deleteAuthUser,
  triggerFirstPendingApprovalAdminNotifications
} from '../helpers/google-pending-notifications';
import { createActiveTestUser } from '../helpers/supabase-direct-auth';

function assertNoSensitiveMetadata(metadata: unknown) {
  const json = JSON.stringify(metadata ?? {});
  expect(json).not.toMatch(/password/i);
  expect(json).not.toMatch(/token/i);
}

test.describe.configure({ mode: 'serial' });

test.describe('Google pending admin 알림 API', () => {
  test('AC-09: 최초 pending 시 active admin 각 1건 · metadata 정책', async ({ request }) => {
    const pending = await createFreshPendingGoogleUser('ac09-admin-notif');
    await triggerFirstPendingApprovalAdminNotifications(pending);

    const { total, adminCount } = await countApprovalRequestAdminNotificationsForAdmins(
      request,
      pending.userId
    );
    expect(adminCount).toBeGreaterThan(0);
    expect(total).toBe(adminCount);

    const adminIds = await listActiveAdminUserIds(request);
    for (const adminId of adminIds) {
      const notifications = await listNotificationsForUser(request, adminId);
      const matched = filterApprovalRequestAdminNotifications(notifications, pending.userId);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.title).toBe('Google 가입 승인 요청');
      expect(matched[0]?.body).toContain(pending.email);
      expect(matched[0]?.body).toContain('E2E Pending');
      assertNoSensitiveMetadata(matched[0]?.metadata);
    }
  });

  test('AC-10: admin GET /api/notifications에 google_email metadata', async ({ request }) => {
    const pending = await createFreshPendingGoogleUser('ac10-admin-notif');
    await triggerFirstPendingApprovalAdminNotifications(pending);

    const notifications = await listNotificationsForUser(request);
    const matched = filterApprovalRequestAdminNotifications(notifications, pending.userId);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched[0]?.metadata?.google_email).toBe(pending.email);
  });

  test('AC-11: user.approval_request 302 log · 알림 INSERT 별도 log 없음', async ({ request }) => {
    const pending = await createFreshPendingGoogleUser('ac11-admin-notif');
    const { requestId } = await triggerFirstPendingApprovalAdminNotifications(pending);
    expect(requestId).toBeTruthy();

    let approvalLog: { request_id?: string; http_status?: number; action?: string } | undefined;

    await expect
      .poll(async () => {
        const response = await request.get(
          `/api/activity-logs?action=user.approval_request&limit=50&log_user=all`
        );
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
          data?: {
            logs?: Array<{
              request_id?: string;
              http_status?: number;
              target_user_id?: string;
              action?: string;
            }>;
          };
        };
        approvalLog = body.data?.logs?.find(
          (log) =>
            log.request_id === requestId &&
            log.http_status === 302 &&
            log.target_user_id === pending.userId
        );
        return approvalLog ?? null;
      })
      .not.toBeNull();

    expect(approvalLog).toBeTruthy();

    const allLogsResponse = await request.get('/api/activity-logs?limit=50&log_user=all');
    expect(allLogsResponse.status()).toBe(200);
    const allLogsBody = (await allLogsResponse.json()) as {
      data?: { logs?: Array<{ action?: string; request_id?: string }> };
    };
    const notifInsertAction = (allLogsBody.data?.logs ?? []).filter(
      (log) =>
        log.request_id === requestId &&
        (log.action === 'notification.create' || log.action === 'notification.insert')
    );
    expect(notifInsertAction).toHaveLength(0);
  });

  test('AC-12 grep: active login branch는 approval admin fan-out 없음', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/auth/google/callback/route.ts'),
      'utf8'
    );

    expect(source).toMatch(/insertUserApprovalRequestAdminNotifications/);
    expect(source).toMatch(
      /if \(profileResult\.approval_request_log_needed\) \{[\s\S]*insertUserApprovalRequestAdminNotifications/
    );

    const activeBlock = source.match(
      /if \(profileResult\.status === 'active'\) \{[\s\S]*?\n  \}/
    );
    expect(activeBlock?.[0]).toBeTruthy();
    expect(activeBlock?.[0]).not.toMatch(/insertUserApprovalRequestAdminNotifications/);
  });

  test('AC-08 API: active admin 2명 fan-out 2건', async ({ request }) => {
    const extraAdmin = await createActiveTestUser('ac08-second-admin', {
      fullName: 'E2E Second Admin'
    });

    try {
      await promoteUserToActiveAdmin(extraAdmin.userId);

      const pending = await createFreshPendingGoogleUser('ac08-fanout-two');
      await triggerFirstPendingApprovalAdminNotifications(pending);

      const { total, adminCount } = await countApprovalRequestAdminNotificationsForAdmins(
        request,
        pending.userId
      );
      expect(adminCount).toBeGreaterThanOrEqual(2);
      expect(total).toBe(adminCount);
    } finally {
      await deleteAuthUser(extraAdmin.userId);
    }
  });
});
