/** plan 106 — 퀵 휴대폰 공통 틀 문구 (designer §2 · §11) */
export const QUICK_MOBILE_TEXT = {
  back: '뒤로',
  tabbarLabel: '퀵 메뉴',
  tabList: '내역',
  tabChat: '대화',
  tabRequest: '요청하기',
  infoButton: '퀵 권한 안내 보기'
} as const;

/** 「대화」 탭 접근 이름 뒤에 붙는 숨은 문구 (배지 숫자는 aria-hidden) */
export function quickMobileUnreadSrText(count: number): string {
  return `, 안 읽은 대화 ${count}건`;
}
