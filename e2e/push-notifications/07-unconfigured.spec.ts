import { expect, test } from '@playwright/test';
import { mockEndpoint, mockSubscriptionBody, PUSH_PREFERENCES_PATH, PUSH_SUBSCRIPTIONS_PATH } from '../helpers/push-mock';

/**
 * plan 91 — AC-20 (VAPID 미설정). 서버가 `E2E_WEB_PUSH_UNCONFIGURED=1`로 떠 있어야 한다.
 * 기본 dev 서버는 설정된 상태이므로, 이 spec은 `E2E_PUSH_UNCONFIGURED=1`일 때만 판정한다:
 *   E2E_WEB_PUSH_UNCONFIGURED=1 npx next start -p 3100   (build 후)
 *   E2E_PUSH_UNCONFIGURED=1 E2E_BASE_URL=http://localhost:3100 PLAYWRIGHT_SKIP_WEBSERVER=1 \
 *     npx playwright test e2e/push-notifications/07-unconfigured.spec.ts --project=chromium-push
 */
const enabled = process.env.E2E_PUSH_UNCONFIGURED === '1';

test.describe('VAPID 미설정 (E2E_WEB_PUSH_UNCONFIGURED=1 서버)', () => {
  test.skip(!enabled, 'E2E_PUSH_UNCONFIGURED=1 + 미설정 서버 필요 (AC-20 별도 실행)');

  test('AC-20: GET preferences configured:false · POST subscriptions 503 · 프로필 섹션 미설정 문구', async ({
    page
  }) => {
    const prefs = await page.request.get(PUSH_PREFERENCES_PATH);
    expect(prefs.status()).toBe(200);
    const prefsBody = (await prefs.json()) as { data: { configured: boolean } };
    expect(prefsBody.data.configured).toBe(false);

    const create = await page.request.post(PUSH_SUBSCRIPTIONS_PATH, {
      data: mockSubscriptionBody(mockEndpoint('ok'))
    });
    expect(create.status()).toBe(503);
    expect(((await create.json()) as { message: string }).message).toBe(
      '휴대폰 알림 서버 설정이 아직 준비되지 않았습니다.'
    );
    expect(create.headers()['x-request-id']).toBeTruthy();

    await page.goto('/dashboard/profile');
    const status = page.getByTestId('push-status');
    await expect(status).toHaveAttribute('data-status', 'not_configured', { timeout: 15_000 });
    await expect(status).toContainText(
      '휴대폰 알림 서버 설정이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.'
    );
    await expect(page.getByTestId('push-toggle')).toBeDisabled();
  });
});
