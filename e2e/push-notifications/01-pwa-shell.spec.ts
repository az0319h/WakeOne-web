import { expect, test } from '@playwright/test';

/** plan 91 — docs/plans/91_pwa-web-push-notifications-plan.md AC-01~03 (PWA 셸) */
test.describe('PWA 셸 · manifest · SW', () => {
  test('AC-01: GET /manifest.webmanifest 200 · name/short_name WakeOne · standalone · start_url /dashboard · 아이콘 192/512/512 maskable PNG', async ({
    playwright
  }) => {
    const anon = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const response = await anon.get('/manifest.webmanifest');
      expect(response.status()).toBe(200);
      const manifest = (await response.json()) as {
        name: string;
        short_name: string;
        display: string;
        start_url: string;
        icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
      };
      expect(manifest.name).toBe('WakeOne');
      expect(manifest.short_name).toBe('WakeOne');
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/dashboard');

      const any192 = manifest.icons.find((i) => i.sizes === '192x192' && (i.purpose ?? 'any') === 'any');
      const any512 = manifest.icons.find((i) => i.sizes === '512x512' && (i.purpose ?? 'any') === 'any');
      const maskable512 = manifest.icons.find(
        (i) => i.sizes === '512x512' && (i.purpose ?? '').includes('maskable')
      );
      expect(any192).toBeTruthy();
      expect(any512).toBeTruthy();
      expect(maskable512).toBeTruthy();

      for (const icon of manifest.icons) {
        const iconResponse = await anon.get(icon.src);
        expect(iconResponse.status(), icon.src).toBe(200);
        expect(iconResponse.headers()['content-type'], icon.src).toContain('image/png');
      }
    } finally {
      await anon.dispose();
    }
  });

  test('AC-02: GET /sw.js 200 · javascript · push·notificationclick 리스너 포함', async ({
    playwright
  }) => {
    const anon = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const response = await anon.get('/sw.js');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('javascript');
      const body = await response.text();
      expect(body).toContain("addEventListener('push'");
      expect(body).toContain("addEventListener('notificationclick'");
    } finally {
      await anon.dispose();
    }
  });

  test('AC-03: /dashboard/overview에 manifest·apple 메타·apple-touch-icon · SW 등록 scope origin/', async ({
    page
  }) => {
    await page.goto('/dashboard/overview');

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes'
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      /apple-touch-icon-180\.png/
    );

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
  });
});
