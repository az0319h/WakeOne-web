import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.describe('시스템 이메일 로그 UI', () => {
  test('AC-09: admin sees system email logs page and table', async ({ page }) => {
    await page.goto('/dashboard/system-email-logs');

    await expect(page.getByRole('heading', { name: '시스템 이메일 로그' })).toBeVisible();
    await expect(page.getByTestId('system-email-logs-table')).toBeVisible();
  });

  test('AC-12: admin nav includes system email logs entry', async ({ page }) => {
    await page.goto('/dashboard/overview');

    await expect(page.getByRole('link', { name: '시스템 이메일 로그' })).toBeVisible();
  });

  test('AC-11: admin opens run detail dialog when a run exists', async ({ page, request }) => {
    const runKey = `E2E-UI-${Date.now()}`;
    const trigger = await request.post('/api/contracts/reminders', {
      data: { run_key: runKey }
    });

    expect([200, 400]).toContain(trigger.status());

    await page.goto('/dashboard/system-email-logs');
    await expect(page.getByTestId('system-email-logs-table')).toBeVisible();

    const firstRow = page.getByTestId('system-email-log-row').first();
    const rowCount = await firstRow.count();

    test.skip(rowCount === 0, 'No reminder runs available for dialog test');

    await firstRow.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('system-email-log-detail-dialog')).toBeVisible();
    await expect(page.getByTestId('system-email-log-recipients-table')).toBeVisible();
  });
});

test.describe('Vercel cron config', () => {
  test('AC-14: vercel.json defines Monday 09:00 UTC reminders cron', () => {
    const configPath = path.join(process.cwd(), 'vercel.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as {
      crons?: Array<{ path?: string; schedule?: string }>;
    };

    const cron = config.crons?.find((item) => item.path === '/api/contracts/reminders');
    expect(cron).toBeTruthy();
    expect(cron?.schedule).toBe('0 9 * * 1');
  });
});
