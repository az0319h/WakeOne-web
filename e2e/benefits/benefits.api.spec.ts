import { expect, test } from '@playwright/test';

test.describe('복지비 API', () => {
  test('관리자 월별 조회와 import 인증 실패 로그가 동작한다', async ({ request }) => {
    const listResponse = await request.get(
      '/api/benefits?month=2026-10&affiliation=wake'
    );
    expect(listResponse.status()).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.success).toBe(true);
    expect(listBody.data.month).toBe('2026-10');
    expect(listBody.data.limit).toBe(100_000);
    expect(Array.isArray(listBody.data.members)).toBe(true);

    const failedImport = await request.post('/api/benefits/import', {
      headers: { Authorization: 'Bearer invalid-e2e-token' },
      data: {}
    });
    expect(failedImport.status()).toBe(401);
    const requestId = failedImport.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logsResponse = await request.get(
          '/api/activity-logs?action=benefit.import_failed&limit=50&log_user=all'
        );
        const logsBody = await logsResponse.json();
        return (logsBody.data?.logs ?? []).some(
          (log: { request_id?: string; http_status?: number }) =>
            log.request_id === requestId && log.http_status === 401
        );
      })
      .toBe(true);
  });
});
