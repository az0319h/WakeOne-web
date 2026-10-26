import { expect, test } from '@playwright/test';
import { listOpenchatMockRequests } from '../helpers/openchat-mock';
import {
  buildCreateBody,
  createQuickRequestApi,
  dbDispatch,
  gotoDashboard,
  gotoDetail,
  pageAs,
  serverOpenchatConfigured,
  withApi
} from './helpers';

/**
 * plan 89 AC-13 · AC-35(미설정) — webhook env(QUICK_OPENCHAT_WEBHOOK_URL/SECRET) 없이 띄운 서버 전용 pass.
 * 운영 빌드(next start)는 Origin을 NEXT_PUBLIC_APP_URL 하나로 고정하므로 같은 포트에서 env만 바꿔 재기동한 뒤
 * `npx playwright test e2e/quick-workflow/unconfigured.spec.ts`로 판정한다. 설정된 서버에서는 skip.
 */
test.describe('plan 89 webhook 미설정 서버', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    test.skip(await serverOpenchatConfigured(), 'webhook 설정 서버 — 미설정 pass에서 판정');
  });

  test('AC-13: webhook env 미설정 → 201 · HTTP 호출 없음 · not_configured · 상세 패널 「미설정」', async ({
    browser
  }) => {
    const before = (await listOpenchatMockRequests()).length;
    const created = await withApi('user', (api) => createQuickRequestApi(api, buildCreateBody()));
    expect(created.openchat.status).toBe('not_configured');
    expect((await listOpenchatMockRequests()).length).toBe(before);
    const record = await dbDispatch(created.requestNo, 'created');
    expect(record?.status).toBe('not_configured');
    expect(record?.attempt_count).toBe(0);

    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDetail(page, created.requestNo);
      const panel = page.getByTestId('quick-openchat-panel');
      await expect(panel.getByTestId('quick-openchat-created-status')).toHaveText('미설정');
      await expect(panel.getByTestId('quick-openchat-created-resend')).toBeDisabled();
      await expect(panel).toContainText('발송 주소가 설정되지 않아 자동 발송을 하지 않습니다.');
    } finally {
      await context.close();
    }
  });

  test('AC-35: (미설정) admin·동방 「오픈채팅 자동 발송: 미설정」 · 일반 직원 미노출', async ({ browser }) => {
    for (const account of ['admin', 'dongbang'] as const) {
      const { context, page } = await pageAs(browser, account);
      try {
        await gotoDashboard(page);
        await expect(page.getByTestId('quick-openchat-status')).toHaveText(/오픈채팅 자동 발송: 미설정/);
      } finally {
        await context.close();
      }
    }
    const { context, page } = await pageAs(browser, 'user');
    try {
      await gotoDashboard(page);
      await expect(page.getByTestId('quick-openchat-status')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
