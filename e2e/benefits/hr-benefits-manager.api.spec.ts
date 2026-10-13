import { expect, test } from '@playwright/test';

test.describe('웨이크 인사팀 복지비 API', () => {
  test.use({ storageState: 'e2e/.auth/hr-benefits.json' });

  test('AC-09: HR GET /api/benefits 200', async ({ request }) => {
    const response = await request.get('/api/benefits?month=2026-10&affiliation=wake');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.month).toBe('2026-10');
  });
});

test.describe('웨이크 인사팀 복지비 API — user', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-10: 비인사팀 GET /api/benefits 403', async ({ request }) => {
    const response = await request.get('/api/benefits?month=2026-10');
    expect(response.status()).toBe(403);
  });
});
