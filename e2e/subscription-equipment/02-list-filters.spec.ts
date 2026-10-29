import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createEquipmentFixture,
  createSubscriptionFixture,
  gotoLedger,
  pageAs,
  rowsOf,
  uniqueTag,
  UI_TIMEOUT,
  waitListBody
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-08 구독 탭 · AC-09 비품 탭 · AC-10 구독 범위 · AC-11 비품 범위 · AC-12 해지됨/폐기 숨김 · AC-13 결제 카드 필터 · AC-14 검색
 *
 * Dev에는 이관 실데이터(구독 70 · 비품 159)가 같이 있으므로, 범위·숨김·카드 판정은 fixture 고유 태그 검색(q)으로
 * 내 fixture만 모은 뒤 판정한다(이관 데이터의 「웨이크 전 직원」 구독은 직원 A의 「내 구독」에 정당하게 포함되기 때문).
 */

async function rowIds(page: Page, kind: 'subscriptions' | 'equipment'): Promise<number[]> {
  const testIds = await rowsOf(page, kind).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid') ?? '')
  );
  return testIds.map((id) => Number(id.split('-').pop())).sort((a, b) => a - b);
}

async function expectRows(page: Page, kind: 'subscriptions' | 'equipment', expected: number[]) {
  const sorted = [...expected].sort((a, b) => a - b);
  await expect.poll(() => rowIds(page, kind), { timeout: UI_TIMEOUT }).toEqual(sorted);
}

async function tabNames(tabs: Locator): Promise<string[]> {
  return tabs.getByRole('tab').evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? '').trim()));
}

/** 표의 n번째 칸 글자 (0부터) */
async function columnTexts(page: Page, kind: 'subscriptions' | 'equipment', index: number): Promise<string[]> {
  const rows = rowsOf(page, kind);
  const count = await rows.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    texts.push(((await rows.nth(i).getByRole('cell').nth(index).textContent()) ?? '').trim());
  }
  return texts;
}

test.describe('plan 103 · 목록 탭·필터·검색', () => {
  test('AC-08: 구독 탭 5개 순서(건수 붙음) → 「협업툴」 클릭 시 URL category=collaboration · 협업툴 행만', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const ids = {
      creative: await createSubscriptionFixture({ name: `E2E ${tag} 크리에이티브`, category: 'creative' }),
      software: await createSubscriptionFixture({ name: `E2E ${tag} 소프트웨어`, category: 'software' }),
      collaboration: await createSubscriptionFixture({ name: `E2E ${tag} 협업`, category: 'collaboration' }),
      etc: await createSubscriptionFixture({ name: `E2E ${tag} 기타`, category: 'etc' })
    };

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'subscriptions', `q=${tag}`);
      await waitListBody(page, 'subscriptions');
      const tabs = page.getByTestId('subscription-category-tabs');
      await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: UI_TIMEOUT });
      const labels = ['전체', '크리에이티브 툴', '소프트웨어', '협업툴', '기타'];
      await expect
        .poll(async () => (await tabNames(tabs)).map((name, index) => name.startsWith(labels[index])))
        .toEqual(labels.map(() => true));
      // 건수가 붙는다(라벨 + 공백 + 숫자) — fixture 4건 검색 상태: 전체 4 · 각 1
      await expect.poll(() => tabNames(tabs)).toEqual(['전체 4', '크리에이티브 툴 1', '소프트웨어 1', '협업툴 1', '기타 1']);
      await expectRows(page, 'subscriptions', Object.values(ids));

      await page.getByTestId('subscription-category-tab-collaboration').click();
      await expect(page).toHaveURL(/[?&]category=collaboration(&|$)/, { timeout: UI_TIMEOUT });
      await expectRows(page, 'subscriptions', [ids.collaboration]);

      // 검색 없이 같은 탭 — 모든 행의 「구분」 칸이 협업툴
      await gotoLedger(page, 'subscriptions', 'category=collaboration');
      await waitListBody(page, 'subscriptions');
      await expect(rowsOf(page, 'subscriptions').first()).toBeVisible({ timeout: UI_TIMEOUT });
      const categories = await columnTexts(page, 'subscriptions', 1);
      expect(categories.length).toBeGreaterThan(0);
      expect(new Set(categories)).toEqual(new Set(['협업툴']));
    } finally {
      await context.close();
    }
  });

  test('AC-09: 비품 탭 9개 순서 → 「모니터」 클릭 시 URL kind=monitor · 모니터 행만', async ({ browser }) => {
    const tag = uniqueTag();
    const monitor = await createEquipmentFixture({ kind: 'monitor', model_serial: `E2E ${tag} 모니터` });
    const keyboard = await createEquipmentFixture({ kind: 'keyboard', model_serial: `E2E ${tag} 키보드` });

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'equipment');
      await waitListBody(page, 'equipment');
      const tabs = page.getByTestId('equipment-kind-tabs');
      await expect(tabs.getByRole('tab')).toHaveCount(9, { timeout: UI_TIMEOUT });
      const labels = ['전체', '노트북·컴퓨터', '모니터', '본체', '마우스', '키보드', '태블릿', '매장 기기', '기타 장비'];
      await expect
        .poll(async () => (await tabNames(tabs)).map((name, index) => new RegExp(`^${labels[index]} \\d+$`).test(name)))
        .toEqual(labels.map(() => true));

      await page.getByTestId('equipment-kind-tab-monitor').click();
      await expect(page).toHaveURL(/[?&]kind=monitor(&|$)/, { timeout: UI_TIMEOUT });
      await expect(rowsOf(page, 'equipment').first()).toBeVisible({ timeout: UI_TIMEOUT });
      await expect.poll(async () => new Set(await columnTexts(page, 'equipment', 1))).toEqual(new Set(['모니터']));

      // fixture로 재확인: 검색 + 모니터 탭 → 모니터 fixture만 (키보드 제외)
      await gotoLedger(page, 'equipment', `kind=monitor&q=${tag}`);
      await waitListBody(page, 'equipment');
      await expectRows(page, 'equipment', [monitor.id]);
      expect(keyboard.id).not.toBe(monitor.id);
    } finally {
      await context.close();
    }
  });

  test('AC-10: 「내 구독」 = S1·S2·S3 (scope=mine) · 「내 팀 구독」 = S2·S4 (scope=team) · 「전체」 = S1~S5', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const s1 = await createSubscriptionFixture({ name: `E2E ${tag} S1 A개인`, assignees: [{ type: 'user', role: 'staff' }] });
    const s2 = await createSubscriptionFixture({
      name: `E2E ${tag} S2 디자인팀`,
      assignees: [{ type: 'team', affiliation: 'wake', rank: '디자인팀' }]
    });
    const s3 = await createSubscriptionFixture({
      name: `E2E ${tag} S3 웨이크전체`,
      assignees: [{ type: 'affiliation', affiliation: 'wake' }]
    });
    const s4 = await createSubscriptionFixture({ name: `E2E ${tag} S4 B개인`, assignees: [{ type: 'user', role: 'teammate' }] });
    const s5 = await createSubscriptionFixture({
      name: `E2E ${tag} S5 마케팅팀`,
      assignees: [{ type: 'team', affiliation: 'wake', rank: '마케팅팀' }]
    });

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'subscriptions', `q=${tag}`);
      await waitListBody(page, 'subscriptions');
      await expectRows(page, 'subscriptions', [s1, s2, s3, s4, s5]);

      await page.getByTestId('asset-scope-mine').click();
      await expect(page).toHaveURL(/[?&]scope=mine(&|$)/, { timeout: UI_TIMEOUT });
      await expectRows(page, 'subscriptions', [s1, s2, s3]);

      await page.getByTestId('asset-scope-team').click();
      await expect(page).toHaveURL(/[?&]scope=team(&|$)/, { timeout: UI_TIMEOUT });
      await expectRows(page, 'subscriptions', [s2, s4]);

      await page.getByTestId('asset-scope-all').click();
      await expect(page).not.toHaveURL(/[?&]scope=(mine|team)/, { timeout: UI_TIMEOUT });
      await expectRows(page, 'subscriptions', [s1, s2, s3, s4, s5]);
    } finally {
      await context.close();
    }
  });

  test('AC-11: 「내 장비」 = E1만 · 「내 팀 장비」 = E2·E3만', async ({ browser }) => {
    const tag = uniqueTag();
    const e1 = await createEquipmentFixture({ model_serial: `E2E ${tag} E1 A개인`, assignee: { type: 'user', role: 'staff' } });
    const e2 = await createEquipmentFixture({
      model_serial: `E2E ${tag} E2 디자인팀`,
      assignee: { type: 'team', affiliation: 'wake', rank: '디자인팀' }
    });
    const e3 = await createEquipmentFixture({ model_serial: `E2E ${tag} E3 B개인`, assignee: { type: 'user', role: 'teammate' } });
    const e4 = await createEquipmentFixture({
      model_serial: `E2E ${tag} E4 마케팅팀`,
      assignee: { type: 'team', affiliation: 'wake', rank: '마케팅팀' }
    });

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      await expectRows(page, 'equipment', [e1.id, e2.id, e3.id, e4.id]);

      await page.getByTestId('asset-scope-mine').click();
      await expect(page).toHaveURL(/[?&]scope=mine(&|$)/, { timeout: UI_TIMEOUT });
      await expectRows(page, 'equipment', [e1.id]);

      await page.getByTestId('asset-scope-team').click();
      await expect(page).toHaveURL(/[?&]scope=team(&|$)/, { timeout: UI_TIMEOUT });
      await expectRows(page, 'equipment', [e2.id, e3.id]);
    } finally {
      await context.close();
    }
  });

  test('AC-12: 해지됨 구독·폐기 비품 — 기본 목록에 없음 + 「… N개/N대 숨김」 → 상태 필터로 선택하면 보임', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const activeSub = await createSubscriptionFixture({ name: `E2E ${tag} 사용중 구독`, status: 'active' });
    const canceledSub = await createSubscriptionFixture({ name: `E2E ${tag} 해지된 구독`, status: 'canceled' });
    const inUse = await createEquipmentFixture({ model_serial: `E2E ${tag} 사용중 장비`, status: 'in_use' });
    const disposed = await createEquipmentFixture({ model_serial: `E2E ${tag} 폐기 장비`, status: 'disposed' });

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'subscriptions', `q=${tag}`);
      await waitListBody(page, 'subscriptions');
      await expectRows(page, 'subscriptions', [activeSub]);
      await expect(page.getByTestId(`subscription-row-${canceledSub}`)).toHaveCount(0);
      await expect(page.getByTestId('asset-list-summary')).toContainText('해지됨 1개 숨김');
      await page.getByTestId('asset-status-filter').click();
      await page.getByTestId('asset-status-option-canceled').click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(`subscription-row-${canceledSub}`)).toBeVisible({ timeout: UI_TIMEOUT });
      await expectRows(page, 'subscriptions', [activeSub, canceledSub]);

      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      await expectRows(page, 'equipment', [inUse.id]);
      await expect(page.getByTestId(`equipment-row-${disposed.id}`)).toHaveCount(0);
      await expect(page.getByTestId('asset-list-summary')).toContainText('폐기 1대 숨김');
      await page.getByTestId('asset-status-filter').click();
      await page.getByTestId('asset-status-option-disposed').click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(`equipment-row-${disposed.id}`)).toBeVisible({ timeout: UI_TIMEOUT });
    } finally {
      await context.close();
    }
  });

  test('AC-13: 권한자 「결제 카드」 「끝 1234」 → card=1234 · 1234 행만 / 직원은 카드 필터 없음', async ({ browser }) => {
    const tag = uniqueTag();
    const card1234 = await createSubscriptionFixture({ name: `E2E ${tag} 카드1234`, card_last4: '1234', payer_entity: 'wake' });
    const card5678 = await createSubscriptionFixture({ name: `E2E ${tag} 카드5678`, card_last4: '5678', payer_entity: 'wake' });

    const hr = await pageAs(browser, 'hr');
    try {
      await gotoLedger(hr.page, 'subscriptions', `q=${tag}`);
      await waitListBody(hr.page, 'subscriptions');
      await expectRows(hr.page, 'subscriptions', [card1234, card5678]);
      await hr.page.getByTestId('subscription-card-filter').click();
      await hr.page.getByTestId('subscription-card-option-1234').click();
      await expect(hr.page).toHaveURL(/[?&]card=1234(&|$)/, { timeout: UI_TIMEOUT });
      await expect(hr.page.getByTestId('subscription-card-filter')).toContainText('끝 1234');
      await expectRows(hr.page, 'subscriptions', [card1234]);
    } finally {
      await hr.context.close();
    }

    const staff = await pageAs(browser, 'staff');
    try {
      await gotoLedger(staff.page, 'subscriptions', `q=${tag}`);
      await waitListBody(staff.page, 'subscriptions');
      await expectRows(staff.page, 'subscriptions', [card1234, card5678]);
      await expect(staff.page.getByTestId('subscription-card-filter')).toHaveCount(0);
    } finally {
      await staff.context.close();
    }
  });

  test('AC-14: 검색 「figma」/「7788」 → 500ms 뒤 해당 행만 · URL q= · 비품은 자산번호·모델·시리얼 대상', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const figma = await createSubscriptionFixture({ name: `E2E Figma ${tag}`, category: 'creative' });
    const notion = await createSubscriptionFixture({ name: `E2E Notion ${tag}`, category: 'collaboration' });
    const sn7788 = await createEquipmentFixture({ model_serial: `E2E-SN-7788 ${tag}` });
    const other = await createEquipmentFixture({ model_serial: `E2E-SN-1100 ${tag}` });

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'subscriptions');
      await waitListBody(page, 'subscriptions');
      const search = page.getByTestId('asset-search-input');
      await search.fill('figma');
      await page.waitForTimeout(150);
      expect(new URL(page.url()).searchParams.get('q'), '500ms 전에는 URL 반영 전').toBeNull();
      await expect(page).toHaveURL(/[?&]q=figma(&|$)/, { timeout: 5_000 });
      await expect(page.getByTestId(`subscription-row-${figma}`)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId(`subscription-row-${notion}`)).toHaveCount(0);
      const names = await columnTexts(page, 'subscriptions', 0);
      expect(names.every((name) => /figma/i.test(name)), `figma 행만: ${names.join(' | ')}`).toBe(true);

      await gotoLedger(page, 'equipment');
      await waitListBody(page, 'equipment');
      await page.getByTestId('asset-search-input').fill('7788');
      await expect(page).toHaveURL(/[?&]q=7788(&|$)/, { timeout: 5_000 });
      await expect(page.getByTestId(`equipment-row-${sn7788.id}`)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId(`equipment-row-${other.id}`)).toHaveCount(0);
      const rows = rowsOf(page, 'equipment');
      const count = await rows.count();
      for (let i = 0; i < count; i += 1) {
        const assetNo = ((await rows.nth(i).getByRole('cell').nth(0).textContent()) ?? '').trim();
        const model = ((await rows.nth(i).getByRole('cell').nth(2).textContent()) ?? '').trim();
        expect(`${assetNo} ${model}`, '자산번호·모델·시리얼에 7788').toContain('7788');
      }

      // 자산번호로도 찾는다
      await page.getByTestId('asset-search-input').fill(other.asset_no);
      await expect(page).toHaveURL(new RegExp(`[?&]q=${other.asset_no}(&|$)`), { timeout: 5_000 });
      await expect(page.getByTestId(`equipment-row-${other.id}`)).toBeVisible({ timeout: UI_TIMEOUT });
    } finally {
      await context.close();
    }
  });
});
