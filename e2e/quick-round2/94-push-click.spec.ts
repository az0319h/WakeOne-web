import { expect, test } from '@playwright/test';

/**
 * plan 94 §B 푸시 클릭 (D-6) — docs/plans/94_quick-realtime-and-small-fixes-plan.md
 * AC-11: SW가 보내는 `{ type: 'wakeone:navigate', url }` message → 앱 `router.push`(전체 재로드 없음) + 포트 `ack`
 * AC-12는 e2e/push-notifications/01-pwa-shell.spec.ts AC-02에 추가 · AC-13은 수동 QA.
 */
test.describe('plan 94 B. 푸시 클릭 즉시 이동', () => {
  test('AC-11: /dashboard/overview · window.__e2eMarker 유지 · serviceWorker message(wakeone:navigate /dashboard/quick) → 2초 안 URL 이동 · 재로드 없음 · ports[0]로 ack', async ({
    page
  }) => {
    await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
    // registrar effect(리스너 등록)가 돌았다는 증거 = SW 등록 완료
    const origin = new URL(page.url()).origin;
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration('/');
            return registration?.scope ?? null;
          }),
        { timeout: 20_000 }
      )
      .toBe(`${origin}/`);

    await page.evaluate(() => {
      (window as unknown as { __e2eMarker: string }).__e2eMarker = 'alive';
    });

    const acked = await page.evaluate(
      () =>
        new Promise<string | null>((resolve) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve(null), 3_000);
          channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            resolve(String(event.data));
          };
          navigator.serviceWorker.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'wakeone:navigate', url: '/dashboard/quick' },
              ports: [channel.port2]
            })
          );
        })
    );
    expect(acked, "앱이 ports[0]로 'ack'").toBe('ack');

    await expect(page).toHaveURL(/\/dashboard\/quick$/, { timeout: 2_000 });
    await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
    const marker = await page.evaluate(() => (window as unknown as { __e2eMarker?: string }).__e2eMarker ?? null);
    expect(marker, '전체 재로드 없음(window 마커 유지)').toBe('alive');

    // 외부 origin url은 무시(같은 origin만 이동)
    const ignored = await page.evaluate(
      () =>
        new Promise<string | null>((resolve) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve(null), 1_000);
          channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            resolve(String(event.data));
          };
          navigator.serviceWorker.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'wakeone:navigate', url: 'https://example.com/evil' },
              ports: [channel.port2]
            })
          );
        })
    );
    expect(ignored, '외부 url은 ack 없음').toBeNull();
    await expect(page).toHaveURL(/\/dashboard\/quick$/);
  });
});
