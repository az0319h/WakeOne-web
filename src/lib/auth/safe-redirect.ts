const DASHBOARD_PATH_PREFIX = '/dashboard';

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/')) {
    return false;
  }

  if (path.startsWith('//') || path.includes('://') || path.startsWith('\\')) {
    return false;
  }

  if (path.includes('\\')) {
    return false;
  }

  return path.startsWith(DASHBOARD_PATH_PREFIX);
}

export function sanitizeRedirectTo(
  input: string | null | undefined,
  fallback = '/dashboard/overview'
): string {
  if (!input) {
    return fallback;
  }

  const trimmed = input.trim();

  if (!isSafeInternalPath(trimmed)) {
    return fallback;
  }

  return trimmed;
}
