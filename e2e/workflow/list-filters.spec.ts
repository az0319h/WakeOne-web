import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiAs, createDoc, gotoWorkflow, marker, purchaseValues, uid } from './helpers';

/** plan 88 AC-38 — 문서함 검색·필터·정렬·범위·초기화 (nuqs URL 유지) */

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1280, height: 900 } });

let user: APIRequestContext;
let user2: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  user = await apiAs(playwright, 'user');
  user2 = await apiAs(playwright, 'user2');
});

test.afterAll(async () => {
  await Promise.all([user, user2].map((ctx) => ctx?.dispose()));
});

const rows = (page: Page) => page.getByTestId(/^workflow-row-/);

async function expectUrlParam(page: Page, key: string, value?: RegExp) {
  await expect
    .poll(() => new URL(page.url()).searchParams.get(key), { message: `URL ${key}` })
    .toMatch(value ?? /.+/);
}

test('AC-38: 검색·작성자·양식·업데이트일·정렬·범위 → URL 반영·새로고침 유지·초기화', async ({ page }) => {
  const shared = marker();
  // A: user 작성(먼저), B: user2 작성(user가 승인자) — 둘 다 같은 표식
  const docA = await createDoc(user, { mark: shared, steps: [[uid('user2')]], values: purchaseValues(shared) });
  const docB = await createDoc(user2, {
    mark: shared,
    steps: [[uid('user')]],
    values: purchaseValues(shared, { item_quantity: `E2E 품목 B ${shared}` })
  });

  await gotoWorkflow(page, '?tab=all');
  // 하이드레이션 대기 — 검색 입력이 URL에 반영될 때까지 재시도
  const search = page.getByTestId('workflow-search-input');
  await expect(async () => {
    await search.fill(shared);
    await expectUrlParam(page, 'q', new RegExp(shared));
  }).toPass({ timeout: 30_000 });

  // ① 표식 문서만
  await expect(page.getByTestId(`workflow-row-${docA.code}`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId(`workflow-row-${docB.code}`)).toBeVisible();
  await expect(rows(page)).toHaveCount(2);

  // ⑤ 정렬 오래된 작성순 → A, B
  await page.getByTestId('workflow-sort').click();
  await page.getByRole('menuitemradio', { name: '오래된 작성순' }).click();
  await expectUrlParam(page, 'sort', /^written_asc$/);
  await expect(rows(page).first()).toHaveAttribute('data-testid', `workflow-row-${docA.code}`);
  await expect(rows(page).last()).toHaveAttribute('data-testid', `workflow-row-${docB.code}`);

  // ② 작성자 user2 → B만
  await page.getByTestId('workflow-filter-writer').click();
  await page.getByPlaceholder('이름 검색…').fill(process.env.E2E_USER2_EMAIL ?? '4321@naver.com');
  await page.getByRole('option').first().click();
  await page.keyboard.press('Escape');
  await expectUrlParam(page, 'writer', new RegExp(uid('user2')));
  await expect(page.getByTestId(`workflow-row-${docB.code}`)).toBeVisible({ timeout: 20_000 });
  await expect(rows(page)).toHaveCount(1);

  // ③ 양식 지출결의서
  await page.getByTestId('workflow-filter-template').click();
  await page.getByRole('option', { name: /지출결의서/ }).click();
  await page.keyboard.press('Escape');
  await expectUrlParam(page, 'template', /expense/);
  await expect(rows(page)).toHaveCount(1);

  // ④ 업데이트일 오늘
  await page.getByTestId('workflow-filter-updated').click();
  await page.getByRole('option', { name: '오늘' }).click();
  await expectUrlParam(page, 'updated', /^today$/);
  await expect(page.getByTestId('workflow-filter-updated')).toContainText('오늘');
  await expect(rows(page)).toHaveCount(1);

  // ⑥ 범위 「내가 작성한」 → B는 user2 작성이므로 0건 → 「문서가 없습니다.」
  await page.getByTestId('workflow-scope-mine').click();
  await expectUrlParam(page, 'scope', /^mine$/);
  await expect(page.getByText('문서가 없습니다.', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(rows(page)).toHaveCount(0);

  // 새로고침해도 유지 + 필터 셸은 로딩 중에도 보인다(plan 40)
  const urlBefore = page.url();
  await page.route(
    (url) => url.pathname === '/api/workflow/documents',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(page.url()).toBe(urlBefore);
  await expect(search).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('workflow-filter-writer')).toBeVisible();
  await expect(search).toHaveValue(shared);
  await expect(page.getByText('문서가 없습니다.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.unroute((url) => url.pathname === '/api/workflow/documents');

  // 초기화 → 모든 조건 해제 (tab은 유지)
  await page.getByTestId('workflow-reset').click();
  await expect
    .poll(() => {
      const params = new URL(page.url()).searchParams;
      return ['q', 'writer', 'template', 'updated', 'sort', 'scope'].filter((key) => params.has(key));
    })
    .toEqual([]);
  await expect(search).toHaveValue('');
  await expect(page.getByTestId(`workflow-row-${docA.code}`)).toBeVisible({ timeout: 20_000 });
});
