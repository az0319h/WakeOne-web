export const DISABLED_DASHBOARD_PATHS = [
  '/dashboard/workspaces',
  '/dashboard/kanban',
  '/dashboard/chat',
  '/dashboard/forms',
  '/dashboard/billing',
  '/dashboard/exclusive',
  '/dashboard/react-query',
  '/dashboard/elements',
  '/dashboard/office-snacks'
] as const;

export function isDisabledDashboardPath(pathname: string): boolean {
  return DISABLED_DASHBOARD_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}
