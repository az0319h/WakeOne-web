import { expect, test } from '@playwright/test';
import {
  attachFileInFormDialog,
  countUnreadNotifications,
  createAnnouncementOrThrow,
  createAnnouncementViaApi,
  createAnnouncementViaUi,
  openAnnouncementRowMenu,
  resetUserNotifications,
  uniqueAnnouncementTitle
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('공지사항 admin CRUD', () => {
  test('AC-02: admin이 공지 작성 시 목록·overview·user B 벨 unread가 증가한다', async ({
    page,
    playwright
  }) => {
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    await resetUserNotifications(userRequest);
    const unreadBefore = await countUnreadNotifications(userRequest);

    const title = uniqueAnnouncementTitle('create');
    await page.goto('/dashboard/announcements');
    await createAnnouncementViaUi(page, {
      title,
      body: '첨부 없는 공지 본문'
    });

    await expect(page.getByTestId('announcements-infinite-list')).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible({
      timeout: 15_000
    });

    await page.goto('/dashboard/overview');
    await expect(page.getByTestId('announcements-overview-card')).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByTestId('announcements-overview-card').getByText(title)).toBeVisible({
      timeout: 15_000
    });

    await expect
      .poll(async () => countUnreadNotifications(userRequest), { timeout: 20_000 })
      .toBeGreaterThan(unreadBefore);

    await userRequest.dispose();
  });

  test('AC-06: admin이 공지 수정 저장 시 수정됨 타임스탬프가 표시되고 재알림이 없다', async ({
    page,
    playwright
  }) => {
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    await resetUserNotifications(userRequest);
    const unreadBefore = await countUnreadNotifications(userRequest);

    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const title = uniqueAnnouncementTitle('edit');
    const announcement = await createAnnouncementOrThrow(adminRequest, {
      title,
      body: '수정 전 본문'
    });
    await adminRequest.dispose();

    await expect
      .poll(async () => countUnreadNotifications(userRequest), { timeout: 20_000 })
      .toBe(unreadBefore + 1);
    const unreadAfterCreate = unreadBefore + 1;

    await page.goto('/dashboard/announcements');
    await openAnnouncementRowMenu(page, announcement.id);
    await page.getByRole('menuitem', { name: '수정' }).click();

    const formDialog = page.getByTestId('announcement-form-dialog');
    await expect(formDialog).toBeVisible();
    const bodyField = formDialog.getByRole('textbox', { name: '본문' });
    await bodyField.fill('수정 후 본문');
    await formDialog.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('공지가 수정되었습니다.')).toBeVisible({
      timeout: 15_000
    });

    await page.getByTestId(`announcement-row-${announcement.id}`).click();
    const detailDialog = page.getByTestId('announcement-detail-dialog');
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText(/수정됨 \d{4}-\d{2}-\d{2} \(.+\) \d{2}:\d{2}:\d{2}/)).toBeVisible({
      timeout: 15_000
    });

    await expect
      .poll(async () => countUnreadNotifications(userRequest), { timeout: 5_000 })
      .toBe(unreadAfterCreate);

    await userRequest.dispose();
  });

  test('AC-07: pinned 3건 초과 pin 시도 시 400과 한국어 오류가 반환된다', async ({
    request
  }) => {
    const listResponse = await request.get('/api/announcements?limit=50');
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as {
      data?: { announcements?: Array<{ id: number; is_pinned: boolean; title: string }> };
    };
    const pinnedE2e =
      listBody.data?.announcements?.filter(
        (item) => item.is_pinned && item.title.startsWith('E2E-ANN-')
      ) ?? [];

    for (const item of pinnedE2e) {
      await request.put(`/api/announcements/${item.id}`, { data: { is_pinned: false } });
    }

    for (let index = 0; index < 3; index += 1) {
      const response = await createAnnouncementViaApi(request, {
        title: uniqueAnnouncementTitle(`pin-${index}`),
        body: `pin seed ${index}`,
        is_pinned: true
      });
      expect(response.status()).toBe(201);
    }

    const response = await createAnnouncementViaApi(request, {
      title: uniqueAnnouncementTitle('pin-overflow'),
      body: '4번째 pin',
      is_pinned: true
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('고정 공지는 최대 3개까지 가능합니다.');
  });

  test('AC-08: admin이 AlertModal 확인 후 공지를 삭제하면 목록·overview에서 제거된다', async ({
    page,
    request
  }) => {
    const title = uniqueAnnouncementTitle('delete');
    const announcement = await createAnnouncementOrThrow(request, {
      title,
      body: '삭제 대상 공지'
    });

    await page.goto('/dashboard/announcements');
    await openAnnouncementRowMenu(page, announcement.id);
    await page.getByRole('menuitem', { name: '삭제' }).click();

    const alertDialog = page.getByRole('dialog', { name: '공지를 삭제할까요?' });
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText(/영구 삭제/)).toBeVisible();
    await alertDialog.getByRole('button', { name: '삭제' }).click();

    await expect(page.getByText('공지가 삭제되었습니다.')).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByTestId(`announcement-row-${announcement.id}`)).toHaveCount(0);

    await page.goto('/dashboard/overview');
    await expect(page.getByTestId(`announcements-overview-item-${announcement.id}`)).toHaveCount(
      0
    );
  });
  test('AC-03: 첨부 create는 모든 업로드 완료 후에만 user B 벨 unread가 증가한다', async ({
    page,
    playwright
  }) => {
    test.setTimeout(120_000);

    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    await resetUserNotifications(userRequest);
    const unreadBefore = await countUnreadNotifications(userRequest);

    await page.goto('/dashboard/announcements');
    await page.getByTestId('announcement-create-button').click();
    const formDialog = page.getByTestId('announcement-form-dialog');
    const title = uniqueAnnouncementTitle('attach-notify');
    await formDialog.getByRole('textbox', { name: '제목' }).fill(title);
    await formDialog.getByRole('textbox', { name: '본문' }).fill('첨부 fan-out 테스트');
    await attachFileInFormDialog(page, 'notify-test.bin', 1024);
    await formDialog.getByRole('button', { name: '저장' }).click();

    await expect
      .poll(async () => countUnreadNotifications(userRequest), {
        timeout: 3_000,
        intervals: [200, 500, 800]
      })
      .toBe(unreadBefore);

    await expect(page.getByText('공지가 등록되었습니다.')).toBeVisible({
      timeout: 30_000
    });

    await expect
      .poll(async () => countUnreadNotifications(userRequest), { timeout: 20_000 })
      .toBeGreaterThan(unreadBefore);

    await userRequest.dispose();
  });
});
