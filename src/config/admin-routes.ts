export const ADMIN_DASHBOARD_PATHS = [
  '/dashboard/users',
  '/dashboard/contracts',
  '/dashboard/system-email-logs'
] as const;

export function isAdminDashboardPath(pathname: string): boolean {
  return ADMIN_DASHBOARD_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function getAdminAccessDeniedParam(pathname: string): string | null {
  for (const path of ADMIN_DASHBOARD_PATHS) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return path.replace('/dashboard/', '');
    }
  }

  return null;
}
