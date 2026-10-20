import { expect, test } from '@playwright/test';
import { createPendingGoogleUser, signInWithSupabasePassword } from '../helpers/supabase-direct-auth';
import { gotoKanban, openKanbanFromSidebar } from './helpers';

test.describe('칸반 nav · guard', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-01: 사이드바 칸반 링크로 /dashboard/kanban 이동', async ({ page }) => {
    await openKanbanFromSidebar(page);
    await expect(page.getByRole('heading', { name: '칸반' })).toBeVisible();
  });

  test('AC-02: active user가 /dashboard/kanban 직접 접근', async ({ page }) => {
    await gotoKanban(page);
    await expect(page).toHaveURL('/dashboard/kanban');
    await expect(page).not.toHaveURL('/dashboard/overview');
  });
});

test.describe('칸반 미인증 · pending guard', () => {
  test('AC-03: 미로그인 /dashboard/kanban → sign-in', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] }
    });
    const page = await context.newPage();
    try {
      await page.goto('/dashboard/kanban', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/auth\/sign-in/);
      await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Search/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-04: pending user /dashboard/kanban 접근 차단', async ({ browser }) => {
    const pending = await createPendingGoogleUser('kanban-ac04');
    const { storageState } = await signInWithSupabasePassword(pending.email, pending.password);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    try {
      await page.goto('/dashboard/kanban', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/auth\/sign-in\?authStatus=pending_approval/);
      await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('칸반 OAuth scope 거부', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('AC-07: access_denied callback → sign-in 한국어 안내', async ({ page, request }) => {
    const response = await request.get('/api/auth/google/callback?error=access_denied', {
      maxRedirects: 0
    });
    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()['location'] ?? '';
    expect(location).toMatch(/\/auth\/sign-in/);
    expect(location).toMatch(/google_tasks_scope_required/);
    expect(response.headers()['x-request-id']).toBeTruthy();

    await page.goto('/auth/sign-in?authError=google_tasks_scope_required');
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expect(
      page.getByText(
        'Google Tasks 권한이 필수입니다. 권한을 허용하지 않으면 WakeOne을 이용할 수 없습니다.'
      )
    ).toBeVisible({ timeout: 10_000 });
  });
});
