import { expect, type APIRequestContext } from '@playwright/test';

const DEFAULT_RUN_KEY_PREFIX = '2026-07';

/**
 * Read-only: fetch an existing reminder run_key from the DB for E2E.
 * NEVER call POST /api/contracts/reminders in kbar/UI specs — it sends real emails.
 */
export async function requireExistingEmailLogRunKey(
  request: APIRequestContext,
  searchPrefix = DEFAULT_RUN_KEY_PREFIX
): Promise<{ runKey: string; searchTerm: string }> {
  const response = await request.get(
    `/api/system-email-logs?search=${encodeURIComponent(searchPrefix)}&limit=1&page=1`
  );
  expect(response.status()).toBe(200);

  const body = await response.json();
  let runKey = body.data?.items?.[0]?.run_key as string | undefined;

  if (!runKey) {
    const fallback = await request.get('/api/system-email-logs?limit=1&page=1');
    expect(fallback.status()).toBe(200);
    const fallbackBody = await fallback.json();
    runKey = fallbackBody.data?.items?.[0]?.run_key as string | undefined;
  }

  expect(
    runKey,
    `독촉 이메일 로그 E2E: run_key prefix "${searchPrefix}" 또는 목록 1건 이상의 기존 run이 필요합니다. ` +
      'POST /api/contracts/reminders 로 시드하지 마세요 (실제 메일 발송).'
  ).toBeTruthy();

  const searchTerm = runKey!.includes(searchPrefix) ? searchPrefix : runKey!;

  return { runKey: runKey!, searchTerm };
}
