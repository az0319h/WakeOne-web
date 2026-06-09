export const OFFICE_SNACKS_ACCESS_DENIED_KEY = 'office-snacks';

export function isOfficeSnacksDashboardPath(pathname: string): boolean {
  return (
    pathname === '/dashboard/office-snacks' ||
    pathname.startsWith('/dashboard/office-snacks/')
  );
}
