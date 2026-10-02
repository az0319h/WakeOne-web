import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('법률 문서 현행화 (plan 60)', () => {
  test('AC-01: 이용약관 — Google 승인제·비밀번호 구식 표현 없음', async ({ page }) => {
    await page.goto('/terms-of-service');

    await expect(page.getByRole('heading', { name: '이용약관', level: 1 })).toBeVisible();
    await expect(page.getByText('시행일: 2026-10-02')).toBeVisible();
    await expect(page.getByText('Google 계정 로그인 및 관리자 가입 승인·거절')).toBeVisible();
    await expect(page.getByText('비밀번호를 변경')).toHaveCount(0);
    await expect(page.getByText('직접 생성')).toHaveCount(0);
  });

  test('AC-02: 이용약관 — 주요 서비스 기능 포함', async ({ page }) => {
    await page.goto('/terms-of-service');

    for (const keyword of [
      '공지사항',
      'CS 문의',
      '내 계약서',
      'Google Tasks',
      'Live 접속자'
    ]) {
      await expect(page.getByText(keyword, { exact: false }).first()).toBeVisible();
    }
  });

  test('AC-03: 개인정보처리방침 — 수집·위탁 현행화', async ({ page }) => {
    await page.goto('/privacy-policy');

    await expect(page.getByRole('heading', { name: '개인정보처리방침', level: 1 })).toBeVisible();
    await expect(page.getByText('시행일: 2026-10-02')).toBeVisible();
    await expect(page.getByText('인증 정보: Google OAuth')).toBeVisible();
    await expect(page.getByText('Google LLC')).toBeVisible();
    await expect(page.getByText('Functional Software, Inc. (Sentry)')).toBeVisible();
    await expect(page.getByText('비밀번호(암호화 저장)')).toHaveCount(0);
  });

  test('AC-04: 개인정보처리방침 — 프로필 read-only', async ({ page }) => {
    await page.goto('/privacy-policy');

    await expect(page.getByText('직접 수정은 제공하지 않습니다')).toBeVisible();
  });

  test('AC-06: 로그인 화면에서 법률 문서 링크', async ({ page }) => {
    await page.goto('/auth/sign-in');

    const termsLink = page.getByRole('link', { name: '이용약관' });
    const privacyLink = page.getByRole('link', { name: '개인정보처리방침' });

    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toHaveAttribute('href', '/terms-of-service');
    await expect(privacyLink).toHaveAttribute('href', '/privacy-policy');

    await Promise.all([page.waitForURL(/\/terms-of-service/), termsLink.click()]);
    await expect(page.getByText('Google 계정 로그인 및 관리자 가입 승인·거절')).toBeVisible();

    await page.goto('/auth/sign-in');
    await Promise.all([page.waitForURL(/\/privacy-policy/), privacyLink.click()]);
    await expect(page.getByText('Google LLC')).toBeVisible();
  });
});
