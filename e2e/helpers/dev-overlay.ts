import type { BrowserContext, Page } from '@playwright/test';

/**
 * dev 서버 전용 오버레이 — Next 표시기(`nextjs-portal`) · TanStack Query Devtools 로고(`.tsqd-parent-container`).
 * 이미 떠 있는 dev 서버(reuseExistingServer)에는 playwright webServer env `NEXT_PUBLIC_DISABLE_RQ_DEVTOOLS=1`이 적용되지 않아
 * 오른쪽·왼쪽 아래 고정 버튼(상세 액션바·요청 폼 「등록하기」·떠 있는 「대화」)을 가로챈다. 운영에는 없으므로 테스트에서만 숨긴다.
 * (plan 106 verifier · 08-mobile·96의 `nextjs-portal` 숨김과 같은 방식)
 */
export const DEV_OVERLAY_CSS =
  'nextjs-portal, .tsqd-parent-container, .tsqd-open-btn-container { display: none !important; }';

export async function hideDevOverlays(target: BrowserContext | Page) {
  await target.addInitScript((css: string) => {
    const inject = () => {
      if (document.getElementById('__e2e_hide_dev_overlay')) return;
      const style = document.createElement('style');
      style.id = '__e2e_hide_dev_overlay';
      style.textContent = css;
      (document.head ?? document.documentElement).appendChild(style);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }, DEV_OVERLAY_CSS);
}
