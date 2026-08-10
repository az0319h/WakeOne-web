/**
 * Extra kbar keywords for nav quick-find (merged with nav item title).
 * Keys match `NavItem.title` from nav-config.
 */
export const KBAR_NAV_SYNONYMS: Record<string, string> = {
  대시보드: 'dashboard home overview 홈 메인',
  공지사항: 'announcements announcement notice 공지 an',
  '사용자 관리': 'users user 멤버 팀 members',
  '계약서 관리': 'contracts contract 계약 계약서 ct',
  '독촉 이메일 로그': '독촉 이메일 email log reminder system-email-logs el',
  프로필: 'profile account 내 정보 settings',
  지갑: 'wallet money 잔액 wl',
  알림: 'notifications notification 알림함 nt',
  '활동 로그': 'logs activity audit 감사 log lg'
};

export function getKbarNavKeywords(title: string, groupLabel: string): string {
  const base = `${title.toLowerCase()} ${groupLabel.toLowerCase()}`;
  const synonyms = KBAR_NAV_SYNONYMS[title];
  return synonyms ? `${base} ${synonyms.toLowerCase()}` : base;
}
