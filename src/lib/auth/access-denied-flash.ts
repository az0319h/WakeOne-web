export const ACCESS_DENIED_FLASH_COOKIE = 'wakeone_access_denied_flash';

export function readAccessDeniedFlash(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACCESS_DENIED_FLASH_COOKIE}=([^;]*)`)
  );

  return match ? decodeURIComponent(match[1]) : null;
}

export function clearAccessDeniedFlash() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${ACCESS_DENIED_FLASH_COOKIE}=; Max-Age=0; path=/`;
}
