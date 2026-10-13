import { expect, test } from '@playwright/test';

function searchParam(page: import('@playwright/test').Page, key: string) {
  return new URL(page.url()).searchParams.get(key);
}

test.describe('복지비 관리 URL 필터', () => {
  test('AC-01: deep link affiliation·month', async ({ page }) => {
    await page.goto('/dashboard/benefits?affiliation=sans_foundry&month=2026-09');

    await expect(page.getByRole('heading', { name: '복지비 사용 현황' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '산스파운드리' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByLabel('조회 월')).toHaveValue('2026-09');
    await expect
      .poll(() => searchParam(page, 'affiliation'), { timeout: 10_000 })
      .toBe('sans_foundry');
    await expect.poll(() => searchParam(page, 'month')).toBe('2026-09');
  });

  test('AC-02·03: 탭 변경이 URL을 갱신하고 소속 변경 시 team·name 제거', async ({ page }) => {
    await page.goto(
      '/dashboard/benefits?affiliation=wake&month=2026-09&team=Engineering&name=foo'
    );

    await page.getByRole('tab', { name: '산스', exact: true }).click();
    await expect.poll(() => searchParam(page, 'affiliation')).toBe('sans');
    await expect.poll(() => searchParam(page, 'team')).toBeNull();
    await expect.poll(() => searchParam(page, 'name')).toBeNull();

    await page.getByRole('tab', { name: '웨이크', exact: true }).click();
    await expect(page.getByRole('tab', { name: '웨이크', exact: true })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(searchParam(page, 'affiliation') === 'wake' || searchParam(page, 'affiliation') === null).toBe(
      true
    );
  });

  test('AC-04·05: refresh·back', async ({ page }) => {
    await page.goto('/dashboard/benefits');
    await page.getByRole('tab', { name: '산스파운드리' }).click();
    await expect.poll(() => searchParam(page, 'affiliation')).toBe('sans_foundry');

    const urlAfterTab = page.url();
    await page.reload();
    await expect(page).toHaveURL(urlAfterTab);
    await expect(page.getByRole('tab', { name: '산스파운드리' })).toHaveAttribute(
      'data-state',
      'active'
    );

    await page.getByLabel('조회 월').fill('2026-08');
    await expect.poll(() => searchParam(page, 'month')).toBe('2026-08');

    await page.goBack();
    await expect.poll(() => searchParam(page, 'affiliation')).toBe('sans_foundry');
  });

  test('AC-06·07: invalid affiliation·month 폴백', async ({ page }) => {
    await page.goto('/dashboard/benefits?affiliation=not_a_value');
    await expect(page.getByRole('tab', { name: '웨이크', exact: true })).toHaveAttribute(
      'data-state',
      'active'
    );

    await page.goto('/dashboard/benefits?month=2026-13');
    await expect(page.getByLabel('조회 월')).not.toHaveValue('2026-13');
    await expect.poll(() => searchParam(page, 'month')).toMatch(/^\d{4}-\d{2}$/);
  });

  test('AC-08·09: 이름 검색 debounce URL', async ({ page }) => {
    await page.goto('/dashboard/benefits');
    const input = page.getByPlaceholder('이름 검색');

    await input.fill('테스트검색');
    await page.waitForTimeout(600);
    await expect.poll(() => searchParam(page, 'name'), { timeout: 5_000 }).toBe('테스트검색');

    await input.fill('');
    await page.waitForTimeout(600);
    await expect.poll(() => searchParam(page, 'name'), { timeout: 5_000 }).toBeNull();
  });
});
