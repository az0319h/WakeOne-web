export const ADMIN_DASHBOARD_PATHS = [
  '/dashboard/users',
  '/dashboard/contracts',
  '/dashboard/system-email-logs'
] as const;

export const BENEFITS_ADMIN_DASHBOARD_PATHS = ['/dashboard/benefits'] as const;

/** plan 88 — 워크플로우 관리자(시스템 관리자 OR workflow_admins) 전용. 미권한 → /dashboard/workflow */
export const WORKFLOW_ADMIN_DASHBOARD_PATHS = ['/dashboard/workflow/settings'] as const;
export const WORKFLOW_ADMIN_DENIED_REDIRECT = '/dashboard/workflow';
export const WORKFLOW_ADMIN_ACCESS_DENIED_KEY = 'workflow-settings';

/** plan 88 — 인쇄 전용 라우트 (dashboard layout 밖, 로그인 필요) */
export const WORKFLOW_PRINT_PATH_PREFIX = '/workflow-print';

export function isAdminDashboardPath(pathname: string): boolean {
  return ADMIN_DASHBOARD_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function isBenefitsAdminDashboardPath(pathname: string): boolean {
  return BENEFITS_ADMIN_DASHBOARD_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function isWorkflowAdminDashboardPath(pathname: string): boolean {
  return WORKFLOW_ADMIN_DASHBOARD_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function isWorkflowPrintPath(pathname: string): boolean {
  return pathname === WORKFLOW_PRINT_PATH_PREFIX || pathname.startsWith(`${WORKFLOW_PRINT_PATH_PREFIX}/`);
}

export function getAdminAccessDeniedParam(pathname: string): string | null {
  for (const path of [...ADMIN_DASHBOARD_PATHS, ...BENEFITS_ADMIN_DASHBOARD_PATHS]) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return path.replace('/dashboard/', '');
    }
  }

  return null;
}
