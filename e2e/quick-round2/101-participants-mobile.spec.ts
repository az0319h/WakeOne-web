import { expect, test } from '@playwright/test';
import {
  VIEWPORT_MOBILE,
  createAs,
  dbQuickRequest,
  fixtureUser,
  pageAs,
  uniqueTag
} from '../quick-workflow/helpers';
import { expectNoHorizontalScroll, expectTouchTarget, gotoChat, sendMessageAs } from '../quick-chat/helpers';
import { dbParticipants, participantRow, PART_TEXT } from './101-helpers';

/**
 * plan 101 AC-18 — 375 · user.json 「참여자 N」 → Drawer 목록 · 추가 Combobox(입력창·후보가 화면 안) · 터치 ≥ 44px · 가로 스크롤 없음
 * docs/plans/101_quick-chat-participants-plan.md
 */
test.describe('plan 101. 참여자 모바일(375)', () => {
  test.describe.configure({ timeout: 150_000 });

  test('AC-18 (plan 106 판정 · ⋯ 경유): 375 user — 「⋯」 → 「참여자 N」 → Drawer 목록 · 추가 Combobox 키보드 가림 없음(입력·후보 viewport 안) · 터치 ≥ 44px · 가로 스크롤 없음', async ({
    browser
  }) => {
    const user2 = await fixtureUser('user2');
    const { requestNo } = await createAs('user', uniqueTag('E2E101M'));
    const requestId = (await dbQuickRequest(requestNo)).id;
    await sendMessageAs('user', requestNo, '모바일 참여자 확인');

    const { context, page } = await pageAs(browser, 'user', { viewport: VIEWPORT_MOBILE });
    try {
      await gotoChat(page, requestNo);
      // plan 106 D-12 · U-7 — 휴대폰 대화방 「참여자 N」은 한 줄 상단바 「⋯」(quick-chat-more) 메뉴 안
      const more = page.getByTestId('quick-chat-more');
      await expect(more).toBeVisible({ timeout: 30_000 });
      await expectTouchTarget(more);
      await expect(page.getByTestId('quick-chat-participants-button')).toHaveCount(0);
      await expectNoHorizontalScroll(page);

      await more.click();
      const menuItem = page.getByTestId('quick-chat-more-participants');
      await expect(menuItem).toBeVisible();
      await expect(menuItem).toHaveText(/^참여자 \d+$/);
      await menuItem.click();
      const drawer = page.getByTestId('quick-chat-participants-drawer');
      await expect(drawer).toBeVisible({ timeout: 10_000 });
      await expect(drawer.getByTestId('quick-chat-participants-panel')).toHaveAttribute('data-mode', 'list');
      await expect(page.getByTestId('quick-chat-participants-popover')).toHaveCount(0);
      // vaul 열림 애니메이션(~500ms) 뒤 측정
      await page.waitForTimeout(700);
      await expect(drawer.getByRole('heading', { name: /^참여자 \d+$/ })).toBeVisible();
      await expect(participantRow(drawer, (await fixtureUser('user')).userId)).toBeVisible();
      const addButton = drawer.getByTestId('quick-chat-add-participant');
      await expectTouchTarget(addButton);
      await expectTouchTarget(drawer.getByRole('button', { name: '닫기' }));
      await expectNoHorizontalScroll(page);

      await addButton.click();
      await expect(drawer.getByTestId('quick-chat-participants-panel')).toHaveAttribute('data-mode', 'add');
      const input = drawer.getByTestId('quick-chat-add-participant-input');
      await expect(input).toBeVisible();
      await expect(input).toBeFocused();
      await expectTouchTarget(drawer.getByTestId('quick-chat-add-participant-back'));
      await input.fill(user2.fullName.slice(0, 2));
      const candidate = drawer.getByTestId(`quick-chat-candidate-${user2.userId}`);
      await expect(candidate).toBeVisible({ timeout: 15_000 });
      await expect(input).toBeInViewport();
      await expect(candidate).toBeInViewport();
      await expectTouchTarget(candidate);

      // 가상 키보드(높이 ~300px) — 화면 높이를 512로 줄여도(키보드가 올라온 상태와 같은 가용 높이) 입력창·후보가 보인다
      await page.setViewportSize({ width: VIEWPORT_MOBILE.width, height: VIEWPORT_MOBILE.height - 300 });
      await page.waitForTimeout(700);
      await expect(input, '키보드 가림 없음 — 입력창').toBeInViewport();
      await expect(candidate, '키보드 가림 없음 — 후보').toBeInViewport();
      await expectNoHorizontalScroll(page);
      await page.setViewportSize(VIEWPORT_MOBILE);
      await page.waitForTimeout(500);

      const postPromise = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/quick-request/${requestNo}/participants`) && response.request().method() === 'POST'
      );
      await candidate.click();
      expect((await postPromise).status()).toBe(201);
      await expect(page.getByText(PART_TEXT.invitedToast(user2.fullName), { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(drawer.getByTestId('quick-chat-participants-panel')).toHaveAttribute('data-mode', 'list');
      const removeButton = drawer.getByTestId(`quick-chat-participant-remove-${user2.userId}`);
      await expect(removeButton).toBeVisible({ timeout: 10_000 });
      await expectTouchTarget(removeButton);
      await expectNoHorizontalScroll(page);
      expect((await dbParticipants(requestId)).map((row) => row.user_id)).toEqual([user2.userId]);
    } finally {
      await context.close();
    }
  });
});
