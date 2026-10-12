import { expect, test } from '@playwright/test';

test.describe('내 복지비 API proxy (user)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-11: user는 타인 user query를 무시한다', async ({ request }) => {
    const mine = await request.get('/api/my-benefits?month=2026-10');
    expect(mine.status()).toBe(200);
    const mineBody = await mine.json();
    expect(mineBody.success).toBe(true);

    const otherUuid = '00000000-0000-4000-8000-000000000099';
    const proxied = await request.get(
      `/api/my-benefits?month=2026-10&user=${otherUuid}`
    );
    expect(proxied.status()).toBe(200);
    const proxiedBody = await proxied.json();
    expect(proxiedBody.success).toBe(true);
    expect(proxiedBody.data).toEqual(mineBody.data);
  });
});

test.describe('내 복지비 API proxy (admin)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('AC-12·13: admin은 user로 타인·self 조회한다', async ({ request }) => {
    const selfResponse = await request.get('/api/my-benefits?month=2026-10&user=self');
    expect(selfResponse.status()).toBe(200);
    const selfBody = await selfResponse.json();
    expect(selfBody.success).toBe(true);

    const defaultResponse = await request.get('/api/my-benefits?month=2026-10');
    expect(defaultResponse.status()).toBe(200);
    const defaultBody = await defaultResponse.json();
    expect(defaultBody.data).toEqual(selfBody.data);

    const usersResponse = await request.get('/api/users?limit=5&statuses=active&systemRoles=user');
    expect(usersResponse.status()).toBe(200);
    const usersBody = await usersResponse.json();
    const target = usersBody.users?.[0];
    expect(target?.id).toBeTruthy();

    const targetResponse = await request.get(
      `/api/my-benefits?month=2026-10&user=${target.id}`
    );
    expect(targetResponse.status()).toBe(200);
    const targetBody = await targetResponse.json();
    expect(targetBody.success).toBe(true);
    expect(targetBody.data.month).toBe('2026-10');
  });
});
