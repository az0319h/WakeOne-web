import { expect, test } from '@playwright/test';

test.describe('Google auth password cleanup API', () => {
  test('AC-13: forgot-password request route는 410 Gone', async ({ request }) => {
    const response = await request.post('/api/auth/forgot-password/request', {
      data: { email: 'any@example.com' }
    });

    expect(response.status()).toBe(410);
    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Google 로그인/);
  });

  test('AC-13: forgot-password verify route는 410 Gone', async ({ request }) => {
    const response = await request.post('/api/auth/forgot-password/verify', {
      data: { email: 'any@example.com', token: '000000', password: 'NewPass123!' }
    });

    expect(response.status()).toBe(410);
  });

  test('AC-21: force-password-change route는 410 Gone', async ({ request }) => {
    const response = await request.patch('/api/auth/force-password-change', {
      data: { password: 'NewPass123!' }
    });

    expect(response.status()).toBe(410);
    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Google 로그인/);
  });
});
