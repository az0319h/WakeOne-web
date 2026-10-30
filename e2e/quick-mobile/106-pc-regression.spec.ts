import { expect, test } from '@playwright/test';
import { createAs, seedQuickRequest, uniqueTag, type AccountKey } from '../quick-workflow/helpers';
import { sendMessageAs } from '../quick-chat/helpers';
import {
  gotoChatRoom,
  gotoDetail,
  gotoList,
  gotoRequestForm,
  withPage,
  type ViewportName
} from './helpers';

/**
 * plan 106 AC-12 PC 회귀 (D1280 · D1024 · 각 역할 · 4화면) — docs/plans/106_quick-mobile-restructure-plan.md
 * lg(1024) 이상은 지금 화면 그대로: 큰 제목·툴바·표·aside·액션바, 휴대폰 요소(탭 바·필터 판·「⋯」) 0.
 */
test.describe('plan 106 AC-12 PC 회귀 (lg 이상)', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  const fx = { tag: '', userNo: '', dispatchedNo: '' };

  test.beforeAll(async () => {
    fx.tag = uniqueTag('E2E106P');
    fx.userNo = (await createAs('user', fx.tag)).requestNo;
    await sendMessageAs('user', fx.userNo, 'PC 회귀 확인 메시지');
    fx.dispatchedNo = (await seedQuickRequest('dispatched', 'user', fx.tag)).requestNo;
  });

  for (const vp of ['D1280', 'D1024'] as ViewportName[]) {
    test(`AC-12 (${vp}) 내역: 제목 · 「퀵 요청하기」 · 상태 카드 설명·높이 ≥ 80 · 기간·상태 툴바 · 표 / 카드·탭 바·필터 버튼 0`, async ({
      browser
    }) => {
      const roles: { account: AccountKey; title: string; canCreate: boolean }[] = [
        { account: 'user', title: '나의 퀵 내역', canCreate: true },
        { account: 'admin', title: '퀵 내역', canCreate: true },
        { account: 'dongbang', title: '퀵 내역', canCreate: false },
        { account: 'logistics', title: '퀵 내역', canCreate: true }
      ];
      for (const role of roles) {
        await withPage(browser, role.account, vp, async (page) => {
          await gotoList(page, `?search=${fx.tag}`);
          await expect(page.getByTestId('quick-dashboard-table')).toBeVisible({ timeout: 30_000 });
          await expect(page.getByRole('heading', { name: role.title, exact: true })).toBeVisible();
          if (role.canCreate) {
            await expect(page.getByTestId('quick-request-new-button')).toBeVisible();
          }
          await expect(page.getByText('접수를 기다리는 요청', { exact: true })).toBeVisible();
          const card = await page.getByTestId('quick-dashboard-card-requested').boundingBox();
          expect(card!.height, `${role.account} 상태 카드 높이`).toBeGreaterThanOrEqual(80);
          await expect(page.getByTestId('quick-dashboard-range-7d')).toBeVisible();
          await expect(page.getByTestId('quick-dashboard-status-filter')).toBeVisible();
          await expect(page.getByTestId('quick-dashboard-cards')).toHaveCount(0);
          await expect(page.getByTestId('quick-mobile-tabbar')).toBeHidden();
          await expect(page.getByTestId('quick-dashboard-filter-button')).toBeHidden();
          await expect(page.getByTestId('quick-dashboard-pagination')).toBeVisible();
        });
      }
    });

    test(`AC-12 (${vp}) 요청 폼: 요약 aside 보임 · 휴대폰 요약바 숨김 · 주소 칸 readonly 아님(.fill 가능)`, async ({ browser }) => {
      await withPage(browser, 'user', vp, async (page) => {
        await gotoRequestForm(page);
        await expect(page.getByTestId('quick-request-summary')).toBeVisible();
        await expect(page.getByTestId('quick-request-mobile-bar')).toBeHidden();
        const road = page.getByTestId('quick-request-origin-road-address');
        await expect(road).not.toHaveAttribute('readonly');
        await road.fill('서울 중구 세종대로 110');
        await expect(road).toHaveValue('서울 중구 세종대로 110');
        await expect(page.getByTestId('quick-request-origin-address-search')).toContainText('주소 검색');
      });
    });

    test(`AC-12 (${vp}) 상세: ${vp === 'D1280' ? 'aside 「요청 대화」 카드' : '액션바 수정·취소 바로 보임'} · 「⋯」 0`, async ({ browser }) => {
      await withPage(browser, 'user', vp, async (page) => {
        await gotoDetail(page, fx.userNo);
        await expect(page.getByTestId('quick-detail-more')).toHaveCount(0);
        if (vp === 'D1280') {
          await expect(page.getByTestId('quick-detail-chat')).toBeVisible({ timeout: 30_000 });
          await expect(page.getByTestId('quick-detail-chat').getByRole('heading', { name: '요청 대화' })).toBeVisible();
        } else {
          await expect(page.getByTestId('quick-detail-cancel')).toBeVisible();
        }
      });
      await withPage(browser, 'admin', vp, async (page) => {
        await gotoDetail(page, fx.dispatchedNo);
        await expect(page.getByTestId('quick-detail-more')).toHaveCount(0);
        await expect(page.getByTestId('quick-detail-edit')).toBeVisible();
        await expect(page.getByTestId('quick-detail-cancel')).toBeVisible();
        await expect(page.getByTestId('quick-detail-mobile')).toHaveCount(0);
      });
    });
  }

  test('AC-12 (D1280) 대화: 2단 · 헤더 「상세 보기」·「참여자 N」 바로 보임(⋯ 0) · 공통 상단바 보임', async ({ browser }) => {
    await withPage(browser, 'dongbang', 'D1280', async (page) => {
      await gotoChatRoom(page, fx.userNo);
      await expect(page.getByTestId('quick-chat-list')).toBeVisible();
      await expect(page.getByTestId('quick-chat-conversation')).toBeVisible();
      await expect(page.getByTestId('quick-chat-detail-link')).toBeVisible();
      await expect(page.getByTestId('quick-chat-participants-button')).toBeVisible();
      await expect(page.getByTestId('quick-chat-participants-button')).toHaveText(/참여자 \d+/);
      await expect(page.getByTestId('quick-chat-more')).toHaveCount(0);
      await expect(page.getByRole('banner')).toBeVisible();
    });
  });
});
