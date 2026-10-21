import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import {
  apiAs,
  approve,
  composeForm,
  contextAs,
  createDoc,
  docNotifications,
  expectDocNotification,
  expectError,
  expectToast,
  gotoWorkflow,

  nameOf,
  openCompose,
  openDoc,
  uid,
  addApprover,
  VIEWPORT_MOBILE,
  WORKFLOW_PATH
} from './helpers';

/** plan 88 AC-16 ~ 20 · 23 · 25 · 26 · 29 · 31 · 32 · 35 · 39 · 43 · 45 — 상세·결재 처리 */

const ABSOLUTE_DATETIME = /\d{4}-\d{2}-\d{2} \([월화수목금토일]\) \d{2}:\d{2}:\d{2}/;

let admin: APIRequestContext;
let user: APIRequestContext;
let user2: APIRequestContext;
let hr: APIRequestContext;
const names: Record<'user' | 'user2' | 'hr' | 'admin', string> = { user: '', user2: '', hr: '', admin: '' };

test.beforeAll(async ({ playwright }) => {
  admin = await apiAs(playwright, 'admin');
  user = await apiAs(playwright, 'user');
  user2 = await apiAs(playwright, 'user2');
  hr = await apiAs(playwright, 'hr');
  for (const role of ['user', 'user2', 'hr', 'admin'] as const) {
    names[role] = await nameOf(admin, uid(role));
  }
});

test.afterAll(async () => {
  await Promise.all([admin, user, user2, hr].map((ctx) => ctx?.dispose()));
});

async function withPage<T>(
  browser: import('@playwright/test').Browser,
  role: 'user' | 'user2' | 'hr' | 'admin',
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  viewport?: { width: number; height: number }
): Promise<T> {
  const context = await contextAs(browser, role, viewport);
  const page = await context.newPage();
  try {
    return await fn(page, context);
  } finally {
    await context.close();
  }
}

function detailOf(page: Page) {
  return page.getByTestId('workflow-detail');
}

test.describe('plan 88 결재 흐름 (AC-16 ~ AC-20)', () => {
  test.describe.configure({ mode: 'serial' });
  let doc: Awaited<ReturnType<typeof createDoc>>;

  test.beforeAll(async () => {
    doc = await createDoc(user, {
      steps: [[uid('user2')], [uid('hr')]],
      referrers: [{ user_id: uid('admin'), notification_setting: 'START_AND_END' }]
    });
  });

  test('AC-16: user2 「승인 필요 문서」 행 → 오른쪽 패널 상세, doc 쿼리 유지, 반려·승인 버튼', async ({ browser }) => {
    await withPage(browser, 'user2', async (page) => {
      await gotoWorkflow(page);
      const group = page.getByTestId('workflow-group-approval-required');
      const row = group.getByTestId(`workflow-row-${doc.code}`);
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText('승인 필요');
      await row.click();
      const detail = detailOf(page);
      await expect(detail.getByTestId('workflow-detail-code')).toHaveText(doc.code);
      await expect(page).toHaveURL(new RegExp(`doc=${doc.id}`));
      const box = await detail.boundingBox();
      expect(box!.x).toBeGreaterThan(0);
      expect(Math.round(box!.x + box!.width)).toBe(1280);

      await page.reload();
      await expect(detailOf(page).getByTestId('workflow-detail-code')).toHaveText(doc.code, { timeout: 30_000 });
      await expect(detailOf(page).getByTestId('workflow-decline')).toBeVisible();
      await expect(detailOf(page).getByTestId('workflow-approve')).toBeVisible();
    });
  });

  test('AC-17: 상세 구성 (뱃지·제목·번호·절대시각·타임라인·필드·첨부 lightbox·승인 · 참조)', async ({ browser }) => {
    await withPage(browser, 'user2', async (page) => {
      const detail = await openDoc(page, doc.id);
      await expect(detail.getByTestId('workflow-detail-status')).toHaveText('진행중 1/2');
      await expect(detail.getByRole('heading', { name: '지출결의서' }).first()).toBeVisible();
      await expect(detail.getByTestId('workflow-detail-code')).toHaveText(doc.code);
      await expect(detail).toContainText(ABSOLUTE_DATETIME);
      const items = detail.getByTestId('workflow-timeline-item');
      await expect(items.first()).toContainText(`${names.user}님이 글을 작성했어요.`);
      await expect(detail).toContainText('구매 요청');
      await expect(detail).toContainText('194,840 원');
      await expect(detail).toContainText('첨부파일 (1)');
      await detail.getByRole('button', { name: /e2e-wf\.png/ }).first().click();
      const lightbox = page.getByRole('dialog', { name: 'e2e-wf.png' });
      await expect(lightbox).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('Escape');
      await expect(lightbox).toHaveCount(0);

      const aside = detail.getByRole('complementary');
      const line = (await aside.count()) > 0 ? aside.first() : detail;
      await expect(line.getByRole('region', { name: '참조' })).toContainText(names.admin);
      const step1 = line.getByRole('region', { name: '1 단계' });
      await expect(step1).toContainText('1 단계 진행 중');
      await expect(step1).toContainText(names.user2);
      await expect(step1).toContainText('대기중');
      const step2 = line.getByRole('region', { name: '2 단계' });
      await expect(step2).toContainText('2 단계 대기중');
      await expect(step2).toContainText(names.hr);
    });
  });

  test('AC-18: hr(2단계 대기)는 진행중 문서에서 열람만, 승인·반려 0건, approve 403', async ({ browser }) => {
    await withPage(browser, 'hr', async (page) => {
      await gotoWorkflow(page);
      await expect(
        page.getByTestId('workflow-group-in-progress').getByTestId(`workflow-row-${doc.code}`)
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByTestId('workflow-group-approval-required').getByTestId(`workflow-row-${doc.code}`)
      ).toHaveCount(0);
      const detail = await openDoc(page, doc.id);
      await expect(detail.getByTestId('workflow-detail-code')).toHaveText(doc.code);
      await expect(detail.getByTestId('workflow-approve')).toHaveCount(0);
      await expect(detail.getByTestId('workflow-decline')).toHaveCount(0);
    });
    await expectError(await approve(hr, doc.id), 403, '지금 승인할 차례가 아닙니다.');
  });

  test('AC-19: user2 승인(의견) → 진행중 2/2·타임라인·승인 필요에서 제거·hr 알림 클릭 이동', async ({ browser }) => {
    await withPage(browser, 'user2', async (page) => {
      const detail = await openDoc(page, doc.id);
      await detail.getByTestId('workflow-approve').click();
      const dialog = page.getByRole('dialog', { name: '승인' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox').fill('확인했습니다');
      await dialog.getByRole('button', { name: '승인' }).click();
      await expectToast(page, '승인했습니다.');
      await expect(detail.getByTestId('workflow-detail-status')).toHaveText('진행중 2/2');
      await expect(detail.getByTestId('workflow-timeline')).toContainText(`${names.user2}님이 승인했어요.`);
      await expect(detail.getByTestId('workflow-timeline')).toContainText('확인했습니다');
      await detail.getByTestId('workflow-detail-close').click();
      await expect(
        page.getByTestId('workflow-group-approval-required').getByTestId(`workflow-row-${doc.code}`)
      ).toHaveCount(0);
    });

    await expectDocNotification(admin, uid('hr'), doc.id, 'workflow.approval_requested');
    const [notification] = await docNotifications(admin, uid('hr'), doc.id, 'workflow.approval_requested');
    expect(notification.title).toBe('지출결의서 승인 요청');

    await withPage(browser, 'hr', async (page) => {
      await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
      const card = page.getByTestId(`notification-card-${notification.id}`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      // 하이드레이션 전 클릭 대비 — 이동할 때까지 재시도
      await expect(async () => {
        await card.getByRole('button', { name: '문서 보기' }).click({ timeout: 3_000 });
        await expect(page).toHaveURL(new RegExp(`/dashboard/workflow\\?doc=${doc.id}`), { timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
      await expect(detailOf(page).getByTestId('workflow-detail-code')).toHaveText(doc.code, { timeout: 30_000 });
    });
  });

  test('AC-20: hr 최종 승인 → 완료, 완료 탭 이동, 작성자·참조자 완료 알림, 재승인 409', async ({ browser }) => {
    await withPage(browser, 'hr', async (page) => {
      const detail = await openDoc(page, doc.id);
      await detail.getByTestId('workflow-approve').click();
      const dialog = page.getByRole('dialog', { name: '승인' });
      await dialog.getByRole('button', { name: '승인' }).click();
      await expectToast(page, '승인했습니다.');
      await expect(detail.getByTestId('workflow-detail-status')).toHaveText('완료');
    });

    await withPage(browser, 'user', async (page) => {
      await gotoWorkflow(page, '?tab=done');
      await expect(page.getByTestId(`workflow-row-${doc.code}`)).toBeVisible({ timeout: 20_000 });
      await page.getByRole('tab', { name: '진행중' }).click();
      await expect(page).toHaveURL(/tab=in_progress|\/dashboard\/workflow$/);
      await expect(page.getByTestId('workflow-page').getByTestId('workflow-search-input')).toBeVisible();
      await expect(page.getByTestId(`workflow-row-${doc.code}`)).toHaveCount(0);
    });

    await expectDocNotification(admin, uid('user'), doc.id, 'workflow.completed');
    const [completed] = await docNotifications(admin, uid('user'), doc.id, 'workflow.completed');
    expect(completed.title).toBe('지출결의서가 승인 완료되었어요');
    await expectDocNotification(admin, uid('admin'), doc.id, 'workflow.completed');
    await expectError(await approve(hr, doc.id), 409, '이미 처리된 문서입니다.');
  });
});

test.describe('plan 88 권한·열람', () => {
  test('AC-23: 외부인 hr — GET 404·검색 0건·deep link 안내 문구', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')]] });
    await expectError(await hr.get(`/api/workflow/documents/${doc.id}`), 404);
    await withPage(browser, 'hr', async (page) => {
      await gotoWorkflow(page, `?tab=all&q=${encodeURIComponent(doc.code)}`);
      await expect(page.getByText('문서가 없습니다.', { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId(`workflow-row-${doc.code}`)).toHaveCount(0);

      await page.goto(`${WORKFLOW_PATH}?doc=${doc.id}`, { waitUntil: 'domcontentloaded' });
      const detail = detailOf(page);
      await expect(detail).toContainText('문서를 찾을 수 없거나 열람 권한이 없습니다.', { timeout: 30_000 });
      await expect(detail.getByTestId('workflow-detail-code')).toHaveCount(0);
      await expect(detail.getByTestId('workflow-timeline')).toHaveCount(0);
    });
  });

  test('AC-25: admin 「회사 전체」로 결재선 밖 문서 열람, user는 토글 0건·API 403', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')]] });
    await withPage(browser, 'admin', async (page) => {
      await gotoWorkflow(page, '?tab=all');
      await expect(async () => {
        await page.getByTestId('workflow-scope-company').click();
        await expect(page).toHaveURL(/scope=company/, { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await page.getByTestId('workflow-search-input').fill(doc.code);
      const row = page.getByTestId(`workflow-row-${doc.code}`);
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.click();
      await expect(detailOf(page).getByTestId('workflow-detail-code')).toHaveText(doc.code, { timeout: 30_000 });
    });
    await withPage(browser, 'user', async (page) => {
      await gotoWorkflow(page);
      await expect(page.getByTestId('workflow-scope-related')).toBeVisible();
      await expect(page.getByTestId('workflow-scope-company')).toHaveCount(0);
    });
    await expectError(await user.get('/api/workflow/documents?scope=company'), 403);
  });
});

test.describe('plan 88 처리 동작', () => {
  test('AC-26: 승인자 user2 문서 수정 → toast·비고 반영·타임라인 「비고」, 기존 승인 유지', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    expect((await approve(user2, doc.id)).status()).toBe(200);
    await withPage(browser, 'user2', async (page) => {
      const detail = await openDoc(page, doc.id);
      await detail.getByTestId('workflow-more-menu').click();
      await page.getByRole('menuitem', { name: '문서 수정' }).click();
      const form = composeForm(page);
      await expect(form).toBeVisible();
      const note = form.getByTestId('workflow-field-note').getByRole('textbox');
      await expect(note).toHaveValue(doc.mark);
      await note.fill('E2E-WF 수정');
      await page.getByTestId('workflow-submit').click();
      await expectToast(page, '문서를 수정했습니다.');
      await expect(form).toHaveCount(0);
      await expect(detail).toContainText('E2E-WF 수정');
      const timeline = detail.getByTestId('workflow-timeline');
      await expect(timeline).toContainText(`${names.user2}님이 문서를 수정했어요.`);
      await expect(timeline).toContainText('비고');
      await expect(timeline).toContainText(`${names.user2}님이 승인했어요.`);
      await expect(detail.getByTestId('workflow-detail-status')).toHaveText('진행중 2/2');
    });
  });

  test('AC-29: 작성자 승인·참조 변경 → diff 타임라인·분모 3', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    await withPage(browser, 'user', async (page) => {
      const detail = await openDoc(page, doc.id);
      await detail.getByTestId('workflow-more-menu').click();
      await page.getByRole('menuitem', { name: '승인·참조 변경' }).click();
      const dialog = page.getByRole('dialog', { name: '승인·참조 변경' });
      await expect(dialog).toBeVisible();
      await dialog
        .getByTestId('workflow-step-2')
        .getByRole('button', { name: `${names.hr} 승인자 제거` })
        .click();
      await addApprover(page, dialog, 2, uid('admin'));
      await dialog.getByTestId('workflow-step-add').click();
      await addApprover(page, dialog, 3, uid('hr'));
      await dialog.getByRole('button', { name: '저장' }).click();
      await expectToast(page, '승인·참조자를 변경했습니다.');
      const timeline = detail.getByTestId('workflow-timeline');
      await expect(timeline).toContainText(`${names.user}님이 승인·참조자를 변경했어요.`);
      await expect(timeline).toContainText(`2단계: ${names.hr}(승인) → ${names.admin}(승인)`);
      await expect(timeline).toContainText(`3단계: 없음 → ${names.hr}(승인)`);
      await expect(detail.getByTestId('workflow-detail-status')).toHaveText('진행중 1/3');
    });
  });

  test('AC-31: 작성자 문서 취소 AlertModal → 취소 상태·완료 탭·대기 승인자 알림', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    await withPage(browser, 'user', async (page) => {
      const detail = await openDoc(page, doc.id);
      await detail.getByTestId('workflow-more-menu').click();
      await page.getByRole('menuitem', { name: '문서 취소' }).click();
      const modal = page.getByRole('dialog', { name: '문서 취소' });
      await expect(modal).toBeVisible();
      await expect(modal).toContainText(doc.code);
      await modal.getByRole('button', { name: '문서 취소' }).click();
      await expectToast(page, '문서를 취소했습니다.');
      await expect(detail.getByTestId('workflow-detail-status')).toHaveText('취소');
      await expect(page).toHaveURL(/tab=done/);
    });
    await expectDocNotification(admin, uid('user2'), doc.id, 'workflow.canceled');
    expect(await docNotifications(admin, uid('hr'), doc.id, 'workflow.canceled')).toHaveLength(0);
  });

  test('AC-32: 참조자 admin 댓글 → 타임라인·입력 비움·관련자 알림(알림 없음 참조자 포함)·빈/2001자 400', async ({ browser }) => {
    const doc = await createDoc(user, {
      steps: [[uid('user2')]],
      referrers: [
        { user_id: uid('admin'), notification_setting: 'START_AND_END' },
        { user_id: uid('hr'), notification_setting: 'NONE' }
      ]
    });
    await withPage(browser, 'admin', async (page) => {
      const detail = await openDoc(page, doc.id);
      const input = detail.getByTestId('workflow-comment-input');
      await expect(detail.getByTestId('workflow-comment-submit')).toBeDisabled();
      await input.fill('E2E-WF 댓글');
      await detail.getByTestId('workflow-comment-submit').click();
      const last = detail.getByTestId('workflow-timeline-item').last();
      await expect(last).toContainText('E2E-WF 댓글');
      await expect(last).toContainText(ABSOLUTE_DATETIME);
      await expect(input).toHaveValue('');
    });
    for (const role of ['user', 'user2', 'hr'] as const) {
      await expectDocNotification(admin, uid(role), doc.id, 'workflow.comment_created');
    }
    await expectError(
      await admin.post(`/api/workflow/documents/${doc.id}/comments`, { data: { content: '   ' } }),
      400,
      '댓글을 입력해 주세요.'
    );
    await expectError(
      await admin.post(`/api/workflow/documents/${doc.id}/comments`, { data: { content: 'a'.repeat(2001) } }),
      400,
      '댓글은 2000자 이내로 입력해 주세요.'
    );
  });

  test('AC-35: ★ 중요 표시 → 중요 탭, 본인에게만 적용, 해제', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')]] });
    await withPage(browser, 'user', async (page) => {
      const detail = await openDoc(page, doc.id);
      const star = detail.getByTestId('workflow-star');
      await expect(star).toHaveAttribute('aria-pressed', 'false');
      await star.click();
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await detail.getByTestId('workflow-detail-close').click();
      await page.getByRole('tab', { name: '중요' }).click();
      await expect(page.getByTestId(`workflow-row-${doc.code}`)).toBeVisible({ timeout: 20_000 });

      await withPage(browser, 'user2', async (page2) => {
        await gotoWorkflow(page2, '?tab=star');
        await expect(page2.getByTestId(`workflow-row-${doc.code}`)).toHaveCount(0);
      });

      await page.getByTestId(`workflow-row-${doc.code}`).click();
      await detailOf(page).getByTestId('workflow-star').click();
      await expect(detailOf(page).getByTestId('workflow-star')).toHaveAttribute('aria-pressed', 'false');
      await detailOf(page).getByTestId('workflow-detail-close').click();
      await expect(page.getByTestId(`workflow-row-${doc.code}`)).toHaveCount(0);
    });
  });

  test('AC-39: PDF 인쇄 새 탭 — 사이드바 0·내용·print 1회 / 권한 없음 안내 / 비로그인 redirect', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')]], contentHtml: '<p>E2E 인쇄 본문</p>' });
    await withPage(browser, 'user', async (page, context) => {
      await context.addInitScript(() => {
        (window as unknown as { __printCount: number }).__printCount = 0;
        window.print = () => {
          (window as unknown as { __printCount: number }).__printCount += 1;
        };
      });
      const detail = await openDoc(page, doc.id);
      await detail.getByTestId('workflow-more-menu').click();
      const popupPromise = context.waitForEvent('page');
      await page.getByRole('menuitem', { name: 'PDF 인쇄' }).click();
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      await expect(popup).toHaveURL(new RegExp(`/workflow-print/${doc.id}$`));
      const printPage = popup.getByTestId('workflow-print-page');
      await expect(printPage).toBeVisible({ timeout: 30_000 });
      await expect(popup.getByRole('link', { name: '문서함', exact: true })).toHaveCount(0);
      await expect(printPage).toContainText(doc.code);
      await expect(printPage).toContainText('구매 요청');
      await expect(printPage).toContainText('194,840 원');
      await expect(printPage).toContainText('E2E 인쇄 본문');
      await expect(printPage).toContainText(names.user2);
      await expect(printPage).toContainText('대기중');
      await expect
        .poll(() => popup.evaluate(() => (window as unknown as { __printCount: number }).__printCount))
        .toBe(1);
      await popup.waitForTimeout(1_000);
      expect(await popup.evaluate(() => (window as unknown as { __printCount: number }).__printCount)).toBe(1);
    });

    await withPage(browser, 'hr', async (page) => {
      await page.goto(`/workflow-print/${doc.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('문서를 찾을 수 없거나 열람 권한이 없습니다.')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('workflow-print-page')).toHaveCount(0);
    });

    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await anon.newPage();
      await page.goto(`/workflow-print/${doc.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/auth\/sign-in/);
    } finally {
      await anon.close();
    }
  });
});

test.describe('plan 88 모바일·오류', () => {
  test('AC-43: 375 user2 — 상세 전체 화면, 하단 반려·승인 고정, 승인 · 참조 접근, 가로 넘침 0', async ({ browser }) => {
    const doc = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    await withPage(
      browser,
      'user2',
      async (page) => {
        const noOverflow = () =>
          page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        await gotoWorkflow(page);
        const row = page.getByTestId('workflow-group-approval-required').getByTestId(`workflow-row-${doc.code}`);
        await expect(row).toBeVisible({ timeout: 20_000 });
        expect(await noOverflow()).toBe(true);
        await row.click();
        const detail = detailOf(page);
        await expect(detail.getByTestId('workflow-detail-code')).toHaveText(doc.code, { timeout: 30_000 });
        const box = await detail.boundingBox();
        expect(Math.round(box!.width)).toBe(VIEWPORT_MOBILE.width);
        expect(Math.round(box!.x)).toBe(0);
        for (const id of ['workflow-decline', 'workflow-approve']) {
          const button = detail.getByTestId(id);
          await expect(button).toBeInViewport();
          const b = await button.boundingBox();
          expect(b!.height).toBeGreaterThanOrEqual(44);
          expect(b!.y + b!.height).toBeLessThanOrEqual(VIEWPORT_MOBILE.height);
        }
        const lineTitle = detail.getByText('승인 · 참조', { exact: true });
        await lineTitle.scrollIntoViewIfNeeded();
        await expect(lineTitle).toBeInViewport();
        await expect(detail.getByTestId('workflow-approve')).toBeInViewport();
        expect(await noOverflow()).toBe(true);
        expect(await detail.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

        await detail.getByTestId('workflow-detail-close').click();
        await openCompose(page);
        expect(await noOverflow()).toBe(true);
        expect(await composeForm(page).getByTestId('workflow-guide').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      },
      VIEWPORT_MOBILE
    );
  });

  test('AC-45: 목록 API 500 → 오류 안내·다시 시도, 사이드바 동작', async ({ browser }) => {
    await withPage(browser, 'user', async (page) => {
      let fail = true;
      await page.route(
        (url) => url.pathname === '/api/workflow/documents',
        async (route) => {
          if (fail && route.request().method() === 'GET') {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ success: false, message: 'mock 500' })
            });
            return;
          }
          await route.continue();
        }
      );
      await page.goto(WORKFLOW_PATH, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('문서함을 불러오지 못했습니다.').first()).toBeVisible({ timeout: 30_000 });
      const retry = page.getByRole('button', { name: '다시 시도' });
      await expect(retry).toBeVisible();
      await expect(page.getByTestId('workflow-search-input')).toBeVisible();

      const toggle = page.getByRole('main').getByRole('button', { name: 'Toggle Sidebar' });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await toggle.click();
      await expect(page.getByRole('link', { name: '문서함', exact: true })).toBeVisible();

      fail = false;
      await retry.click();
      await expect(page.getByText('문서함을 불러오지 못했습니다.')).toHaveCount(0, { timeout: 20_000 });
    });
  });
});

