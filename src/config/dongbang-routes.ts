/**
 * plan 89 — 동방특송(affiliation='dongbang') allowlist (기본 거부).
 * `proxy.ts`(페이지 redirect · API 403), dashboard layout 2차 방어, FE nav 필터가 같은 함수를 쓴다.
 * 새 페이지·API를 추가해도 여기에 넣지 않으면 동방특송에게는 막힌다.
 */

/** 동방특송 착지 경로 (`/dashboard`·`/dashboard/overview`·sign-in 이후) */
export const DONGBANG_HOME_PATH = '/dashboard/quick';

/** access-denied flash 키 (`AccessDeniedToast`) */
export const DONGBANG_ACCESS_DENIED_KEY = 'dongbang';
export const DONGBANG_QUICK_REQUEST_ACCESS_DENIED_KEY = 'dongbang-quick-request';

/** API 403 본문 (AC-05) */
export const DONGBANG_FORBIDDEN_JSON = {
  success: false,
  message: '접근 권한이 없습니다.'
} as const;

/** prefix 일치 페이지 (하위 경로 포함) */
export const DONGBANG_ALLOWED_PAGE_PREFIXES = [
  '/dashboard/profile',
  '/dashboard/notifications',
  '/dashboard/logs'
] as const;

const QUICK_DASHBOARD_PATH = '/dashboard/quick';
const QUICK_REQUEST_FORM_PATH = '/dashboard/quick/request';
/** plan 93 — 「퀵 대화」 (AC-09 명시 등록 · 상세 패턴에 우연히 걸리던 것을 명시) */
const QUICK_CHAT_PATH = '/dashboard/quick/chat';
/** `/dashboard/quick/{YYYY-NN}` — 형식이 틀린 번호도 상세 페이지가 404 화면을 그리므로 세그먼트 1개면 허용 */
const QUICK_DETAIL_PATH_PATTERN = /^\/dashboard\/quick\/[^/]+\/?$/;

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isQuickRequestFormPath(pathname: string): boolean {
  return matchesPrefix(stripTrailingSlash(pathname), QUICK_REQUEST_FORM_PATH);
}

/** 동방특송이 열 수 있는 dashboard 페이지인지 (nav 필터 · proxy · layout 공용) */
export function isDongbangAllowedPage(pathname: string): boolean {
  const path = stripTrailingSlash(pathname);

  if (path === QUICK_DASHBOARD_PATH) return true;
  if (path === QUICK_CHAT_PATH) return true;
  if (isQuickRequestFormPath(path)) return false;
  if (QUICK_DETAIL_PATH_PATTERN.test(path)) return true;

  return DONGBANG_ALLOWED_PAGE_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * 동방특송이 호출할 수 있는 API인지.
 * - `/api/quick-request/**` 허용. 단 등록 `POST /api/quick-request`, `notes/**`, `recent-addresses`, `places`(plan 99)는 거부
 *   (plan 93 `conversations` · `[no]/messages` GET/POST · `[no]/messages/read` PUT · `unread-total`은 이 규칙으로 통과)
 *   (plan 98 `[no]/messages/attachments/prepare` POST · `attachments/[id]` DELETE · `attachments/[id]/url`·`/download` GET도 이 규칙으로 통과 —
 *    동방특송은 첨부 올리기·보기·다운로드 모두 가능. 구매물류팀 읽기 전용은 Route 안에서 403)
 * - `/api/profile/**`, `/api/notifications/**`, `/api/activity-logs/**`, `/api/auth/**` 허용
 */
export function isDongbangAllowedApi(pathname: string, method: string): boolean {
  const path = stripTrailingSlash(pathname);
  const upperMethod = method.toUpperCase();

  if (path === '/api/quick-request') {
    return upperMethod === 'GET' || upperMethod === 'HEAD';
  }

  if (matchesPrefix(path, '/api/quick-request')) {
    if (
      matchesPrefix(path, '/api/quick-request/notes') ||
      matchesPrefix(path, '/api/quick-request/recent-addresses') ||
      // plan 99 — 「장소 검색」은 요청 작성 화면 전용 (동방특송은 요청 작성 불가)
      matchesPrefix(path, '/api/quick-request/places')
    ) {
      return false;
    }
    return true;
  }

  return (
    matchesPrefix(path, '/api/profile') ||
    matchesPrefix(path, '/api/notifications') ||
    matchesPrefix(path, '/api/activity-logs') ||
    matchesPrefix(path, '/api/auth')
  );
}

/**
 * 동방특송이 허용되지 않은 dashboard 페이지에 들어왔을 때 flash 키.
 * `/dashboard`·`/dashboard/overview`는 정상 착지라 토스트 없음(null).
 */
export function getDongbangDeniedFlashKey(pathname: string): string | null {
  const path = stripTrailingSlash(pathname);
  if (path === '/dashboard' || path === '/dashboard/overview') return null;
  if (isQuickRequestFormPath(path)) return DONGBANG_QUICK_REQUEST_ACCESS_DENIED_KEY;
  return DONGBANG_ACCESS_DENIED_KEY;
}
