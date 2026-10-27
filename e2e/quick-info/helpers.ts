import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * plan 90 — 퀵 권한 안내 ⓘ 패널 · 사용자 관리 안내 e2e 공용
 * (docs/plans/90_quick-dashboard-permission-info-plan.md)
 *
 * 기대 문구는 plan §문구 초안을 **그대로 옮겨 적은 것**이다(앱 상수를 import하지 않는다 —
 * 상수가 틀려도 spec이 같이 틀리지 않게 하기 위함).
 */

export type ExpectedSection = {
  title: string;
  description?: string;
  items?: string[];
  callout?: string;
};

export type ExpectedInfo = { title: string; sections: ExpectedSection[] };

// §문구 초안 Q
export const QUICK_INFO: ExpectedInfo = {
  title: '퀵 권한 안내',
  sections: [
    {
      title: '누가 어떤 퀵을 볼 수 있나요',
      description: '대시보드 목록에는 최근 7일(오늘 포함) 요청만 나옵니다.',
      items: [
        '일반 직원: 내가 등록한 요청만 볼 수 있습니다.',
        '구매물류팀: 모든 직원의 요청을 볼 수 있습니다. 보기만 가능합니다.',
        '동방특송: 모든 요청을 볼 수 있습니다.',
        '관리자: 모든 요청을 볼 수 있습니다.'
      ]
    },
    {
      title: '진행 단계',
      description:
        '「신규요청」 → 「접수 및 배차중」 → 「배차완료 및 결과」 → 「승인」 순서로 진행됩니다. 도중에 취소되면 「취소」가 됩니다.',
      callout: '「승인」 또는 「취소」가 된 요청은 관리자를 포함해 누구도 바꿀 수 없습니다.'
    },
    {
      title: '요청한 사람이 할 수 있는 일',
      description: '일반 직원과 구매물류팀이 내 요청에 대해 할 수 있는 일입니다.',
      items: [
        '퀵을 등록할 수 있습니다.',
        '등록한 뒤에는 내용을 직접 고칠 수 없습니다. 바꿀 내용이 있으면 동방특송 담당자에게 연락해 주세요.',
        '「신규요청」 상태일 때만 직접 취소할 수 있습니다. 접수된 뒤에는 동방특송 담당자에게 연락해 주세요.',
        '최종금액이 입력되면 금액을 확인하고 승인할 수 있습니다.'
      ]
    },
    {
      title: '동방특송이 할 수 있는 일',
      items: [
        '요청을 접수하고, 기사가 정해지면 배차완료로 처리합니다. 배차완료 때는 예상금액·차량 정보·기사 이름·기사 연락처를 꼭 입력합니다.',
        '승인 전까지 요청 내용과 배차 정보를 고칠 수 있습니다.',
        '「배차완료 및 결과」 상태에서 최종금액을 입력합니다.',
        '승인 전까지 요청을 취소할 수 있습니다.',
        '퀵 등록과 승인은 할 수 없습니다.'
      ]
    },
    {
      title: '관리자가 할 수 있는 일',
      items: [
        '동방특송이 하는 일(접수·배차완료·수정·최종금액 입력·취소)을 모두 대신할 수 있습니다.',
        '퀵을 등록할 수 있고, 모든 요청을 승인할 수 있습니다.'
      ]
    },
    {
      title: '구매물류팀이 할 수 있는 일',
      items: [
        '다른 사람의 요청은 보기만 할 수 있습니다. 접수·수정·승인·취소는 할 수 없습니다.',
        '내 요청은 일반 직원과 똑같이 등록·취소·승인할 수 있습니다.'
      ]
    },
    {
      title: '버튼이 안 보일 때',
      description:
        '내 역할이나 요청의 진행 단계에서 할 수 없는 일은 버튼이 나타나지 않습니다. 필요한 처리가 있으면 동방특송 담당자나 관리자에게 연락해 주세요.'
    }
  ]
};

// §문구 초안 U
export const USERS_INFO: ExpectedInfo = {
  title: '사용자 관리 안내',
  sections: [
    {
      title: '이 화면에서 하는 일',
      description:
        'Google 계정으로 가입을 신청한 사람을 승인하고, 직원 정보와 계정 상태를 관리합니다. 관리자만 이 화면을 볼 수 있습니다.'
    },
    {
      title: '가입 승인·거절',
      items: [
        '처음 Google로 로그인한 사람은 「승인 대기」 상태로 표에 나타납니다.',
        '「승인」을 누르면 소속·부서/사업장·직급·리더 역할·시스템 역할을 정한 뒤 승인합니다. 생일은 비워 둘 수 있습니다.',
        '「거절」하면 「거절됨」 상태가 됩니다. 이메일 알림은 보내지 않습니다.'
      ]
    },
    {
      title: '사용자 정보 수정',
      items: [
        '「활성」 상태인 다른 사용자만 수정할 수 있습니다. 내 계정은 여기서 고칠 수 없습니다.',
        '관리자 계정은 아바타 URL과 시스템 역할만 바꿀 수 있습니다.'
      ]
    },
    {
      title: '소속을 「동방특송」으로 고를 때',
      description: '동방특송은 퀵 배송을 맡는 외부 업체 직원입니다.',
      items: [
        '시스템 역할은 일반 사용자만 고를 수 있습니다.',
        '조직도, 생일 안내, 접속자 목록, 공지 알림, 복지비 명단에는 나타나지 않습니다.'
      ],
      callout:
        '「동방특송」을 고르면 부서·직급·리더 역할·생일 칸이 사라지고 값이 비워집니다. 동방특송 직원은 퀵 화면과 프로필·알림·활동 로그만 이용할 수 있습니다.'
    },
    {
      title: '비활성화와 다시 활성화',
      items: [
        '비활성화하면 그 사람은 바로 로그아웃되고 다시 로그인할 수 없습니다.',
        '「활성화」를 누르면 다시 Google 로그인으로 들어올 수 있습니다.',
        '내 계정은 비활성화할 수 없습니다.'
      ]
    }
  ]
};

export const VIEWPORT_DESKTOP_1280 = { width: 1280, height: 900 } as const;
export const VIEWPORT_MOBILE_390 = { width: 390, height: 844 } as const;

// ---------------------------------------------------------------------------
// 선택자 (designer 명세 Step 6 · frontend-dev 인계)
// ---------------------------------------------------------------------------

export function infoButton(page: Page) {
  return page.getByRole('button', { name: 'Show information' });
}

/** 데스크톱 사이드 패널 (`data-state=expanded|collapsed`) */
export function desktopPanel(page: Page) {
  return page.locator("[data-slot='infobar']:not([data-mobile='true'])");
}

/** 모바일 Sheet 패널 */
export function mobilePanel(page: Page) {
  return page.locator("[data-slot='infobar'][data-mobile='true']");
}

/** 패널 헤더 제목 (모바일 Sheet의 sr-only SheetTitle 「Infobar」 h2는 제외) */
export function panelTitle(panel: Locator) {
  return panel.locator("[data-slot='infobar-header']").getByRole('heading', { level: 2 });
}

export function pageHeading(page: Page, name: string) {
  return page.getByRole('heading', { level: 2, name, exact: true }).first();
}

/** 데스크톱 패널이 펼쳐질 때까지 ⓘ 클릭 (hydration 전 클릭 무시 대비 재시도) */
export async function openDesktopPanel(page: Page): Promise<Locator> {
  const panel = desktopPanel(page);
  const button = infoButton(page);
  await expect(button).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    if ((await panel.getAttribute('data-state')) !== 'expanded') {
      await button.click();
    }
    await expect(panel).toHaveAttribute('data-state', 'expanded', { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return panel;
}

export async function openMobilePanel(page: Page): Promise<Locator> {
  const panel = mobilePanel(page);
  const button = infoButton(page);
  await expect(button).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    if ((await panel.count()) === 0) {
      await button.click();
    }
    await expect(panel).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return panel;
}

export type RenderedSection = {
  title: string | null;
  description: string | null;
  items: string[];
  callout: string | null;
  linkCount: number;
};

/** 패널 안 섹션 구조를 DOM 순서대로 읽는다 (제목 → 설명 → 목록 → 강조 상자 → 링크) */
export async function readSections(panel: Locator): Promise<RenderedSection[]> {
  return panel.locator("[data-slot='info-section']").evaluateAll((elements) =>
    elements.map((element) => {
      const h3 = element.querySelector(':scope > h3');
      const description = element.querySelector(':scope > p');
      const items = Array.from(
        element.querySelectorAll(":scope > [data-slot='info-section-list'] > li")
      ).map((li) => li.textContent ?? '');
      const callout = element.querySelector(":scope > [data-slot='info-section-callout']");
      return {
        title: h3?.textContent ?? null,
        description: description?.textContent ?? null,
        items,
        callout: callout ? (callout as HTMLElement).innerText : null,
        linkCount: element.querySelectorAll('a[href]').length
      };
    })
  );
}

/** 섹션 자식 순서 (data-slot / 태그) — 렌더 순서 고정 검증용 */
export async function readSectionChildOrder(panel: Locator): Promise<string[][]> {
  return panel.locator("[data-slot='info-section']").evaluateAll((elements) =>
    elements.map((element) =>
      Array.from(element.children).map(
        (child) => child.getAttribute('data-slot') ?? child.tagName.toLowerCase()
      )
    )
  );
}

export function toRendered(expected: ExpectedInfo): RenderedSection[] {
  return expected.sections.map((section) => ({
    title: section.title,
    description: section.description ?? null,
    items: section.items ?? [],
    callout: section.callout ?? null,
    linkCount: 0
  }));
}

export async function expectPanelMatches(panel: Locator, expected: ExpectedInfo) {
  await expect(panelTitle(panel)).toHaveText(expected.title);
  expect(await readSections(panel)).toEqual(toRendered(expected));
}

export async function panelBodyText(panel: Locator): Promise<string> {
  return panel.locator("[data-slot='infobar-content']").innerText();
}

/** 스크린샷을 test-results 출력 폴더에 저장하고 보고서에 첨부한다 */
export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** 두 상자가 겹치지 않음 */
export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
