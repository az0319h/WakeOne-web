import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

async function gotoSignIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/sign-in');
}

test.describe('sign-in SEO metadata', () => {
  test('AC-1~5: title, description, keywords, canonical, robots', async ({ page }) => {
    await gotoSignIn(page);

    await expect(page).toHaveTitle(/로그인/);
    await expect(page).toHaveTitle(/WakeOne|웨이크원/);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /웨이크/);
    await expect(description).toHaveAttribute('content', /로그인/);
    const descriptionContent = (await description.getAttribute('content')) ?? '';
    expect(descriptionContent.length).toBeGreaterThanOrEqual(80);

    const keywords = page.locator('meta[name="keywords"]');
    const keywordsContent = ((await keywords.getAttribute('content')) ?? '').toLowerCase();
    expect(keywordsContent).toContain('wakeone');
    expect(keywordsContent).toContain('wakecorp');

    const canonical = page.locator('link[rel="canonical"]');
    const canonicalHref = (await canonical.getAttribute('href')) ?? '';
    expect(canonicalHref).toMatch(/\/auth\/sign-in\/?$/);

    const robots = page.locator('meta[name="robots"]');
    const robotsContent = ((await robots.getAttribute('content')) ?? '').toLowerCase();
    expect(robotsContent).toContain('index');
  });
});

test.describe('sign-in JSON-LD', () => {
  test('AC-6~7: WebSite + Organization graph', async ({ page }) => {
    await gotoSignIn(page);

    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    await expect(jsonLdScripts.first()).toBeAttached();
    expect(await jsonLdScripts.count()).toBeGreaterThanOrEqual(1);

    const rawJson = (await jsonLdScripts.first().textContent()) ?? '';
    const parsed = JSON.parse(rawJson) as {
      '@graph'?: Array<{ '@type'?: string; name?: string; alternateName?: string[] }>;
      '@type'?: string;
    };

    const graph = parsed['@graph'] ?? [parsed];
    const hasWebSite = graph.some((node) => node['@type'] === 'WebSite');
    expect(hasWebSite).toBe(true);

    const organization = graph.find((node) => node['@type'] === 'Organization');
    expect(organization).toBeDefined();

    const orgText = JSON.stringify(organization).toLowerCase();
    expect(orgText).toMatch(/웨이크|wake/);
  });
});

test.describe('sign-in visible copy', () => {
  test('AC-8: desktop heading', async ({ page }) => {
    await gotoSignIn(page);

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });

  test('AC-9~11: mobile·tablet login shell without intro copy', async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 768, height: 1024 }
    ]) {
      await page.setViewportSize(viewport);
      await gotoSignIn(page);

      await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByRole('region', { name: 'WakeOne 소개' })).toBeHidden();
      await expect(page.getByText(/관리자 지정 계정으로 로그인해/)).toBeHidden();
    }
  });
});

test.describe('sign-in SEO regression', () => {
  test('AC-12: email split form visible', async ({ page }) => {
    await gotoSignIn(page);

    await expect(page.getByRole('textbox', { name: '아이디' })).toBeVisible();
    await expect(page.getByTestId('login-domain-combobox')).toBeVisible();
  });
});

test.describe('sign-in sitemap robots', () => {
  test('AC-13~14: sitemap.xml + robots.txt', async ({ request }) => {
    const sitemapResponse = await request.get('/sitemap.xml');
    expect(sitemapResponse.ok()).toBe(true);
    const sitemapBody = await sitemapResponse.text();
    expect(sitemapBody).toContain('/auth/sign-in');

    const robotsResponse = await request.get('/robots.txt');
    expect(robotsResponse.ok()).toBe(true);
    const robotsBody = await robotsResponse.text();
    expect(robotsBody).toContain('Disallow: /dashboard');
    expect(robotsBody).not.toContain('Disallow: /auth/sign-in');
  });
});
