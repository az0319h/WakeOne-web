import { expect, test } from '@playwright/test';
import {
  createDisposableUser,
  deleteProfileRow,
  fetchActivityLogs,
  updateUserFullName
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('프로필 live display API', () => {
  let userId: string;
  let userEmail: string;
  let updatedName: string;
  let putRequestId: string;

  test.beforeAll(async ({ request }) => {
    updatedName = `E2E-P29-API8-${Date.now()}`;
    const created = await createDisposableUser(
      request,
      'p29-api8',
      `E2E-P29-API8-SEED-${Date.now()}`
    );
    userId = created.userId;
    userEmail = created.email;

    const response = await updateUserFullName(request, userId, updatedName);
    putRequestId = response.headers()['x-request-id'];
    expect(putRequestId).toBeTruthy();
  });

  test('AC-08: user.update 성공 로그 target_label이 업데이트 후 스냅샷이다', async ({
    request
  }) => {
    const logs = await fetchActivityLogs(
      request,
      '&log_user=all&action=user.update&limit=50'
    );
    const matched = logs.find((log) => log.request_id === putRequestId);
    expect(matched).toBeTruthy();
    expect(matched!.target_label).toContain(updatedName);
    expect(matched!.target_label).toContain(userEmail);
    expect(matched!.target_label_resolved ?? matched!.target_label).toContain(updatedName);
  });

  test('AC-09: search에 변경 후 이름 일부를 넣으면 B 관련 로그가 포함된다', async ({
    request
  }) => {
    const searchTerm = updatedName.slice(0, 14);
    const logs = await fetchActivityLogs(
      request,
      `&log_user=all&search=${encodeURIComponent(searchTerm)}&limit=50`
    );

    const hasTargetLog = logs.some(
      (log) =>
        log.target_user_id === userId &&
        (log.target_label_resolved ?? log.target_label).includes(updatedName)
    );
    expect(hasTargetLog).toBe(true);
  });

  test('AC-10: user.update 성공 시 changed_fields에 full_name이 포함된다', async ({
    request
  }) => {
    const logs = await fetchActivityLogs(
      request,
      '&log_user=all&action=user.update&limit=50'
    );
    const matched = logs.find((log) => log.request_id === putRequestId);
    expect(matched?.http_status).toBe(200);
    expect(matched?.metadata?.changed_fields).toContain('full_name');
  });

  test('AC-13: profile 조회 불가 시 target_label 스냅샷 fallback 표시', async ({
    request
  }) => {
    const snapshotName = `E2E-P29-AC13-${Date.now()}`;
    const liveName = `E2E-P29-AC13-LIVE-${Date.now()}`;
    const seedName = `E2E-P29-AC13-SEED-${Date.now()}`;
    const { email, userId: disposableUserId } = await createDisposableUser(
      request,
      'p29-ac13',
      seedName
    );

    await expect
      .poll(async () => {
        const response = await request.get(
          `/api/users?search=${encodeURIComponent(email)}&limit=5`
        );
        if (response.status() !== 200) {
          return false;
        }
        const body = (await response.json()) as {
          users?: Array<{ id: string; email: string }>;
        };
        return body.users?.some((user) => user.id === disposableUserId) ?? false;
      })
      .toBe(true);

    const firstUpdate = await updateUserFullName(request, disposableUserId, snapshotName);
    expect(firstUpdate.status()).toBe(200);
    const firstRequestId = firstUpdate.headers()['x-request-id'];
    expect(firstRequestId).toBeTruthy();

    const logsAfterFirst = await fetchActivityLogs(
      request,
      `&log_user=all&action=user.update&limit=50`
    );
    const snapshotLog = logsAfterFirst.find((log) => log.request_id === firstRequestId);
    expect(snapshotLog?.target_label).toContain(snapshotName);

    await updateUserFullName(request, disposableUserId, liveName);
    await deleteProfileRow(disposableUserId);

    const logsAfterDelete = await fetchActivityLogs(
      request,
      `&log_user=all&action=user.update&limit=50`
    );
    const deletedProfileLog = logsAfterDelete.find((log) => log.id === snapshotLog!.id);
    expect(deletedProfileLog).toBeTruthy();
    expect(deletedProfileLog!.target_label_resolved).toBe(snapshotLog!.target_label);
    expect(deletedProfileLog!.target_label_resolved).toContain(snapshotName);
    expect(deletedProfileLog!.target_label_resolved).not.toContain(liveName);
    expect(deletedProfileLog!.target_label_resolved).toContain(email);
  });
});
