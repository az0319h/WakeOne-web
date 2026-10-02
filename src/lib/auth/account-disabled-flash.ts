export const ACCOUNT_DISABLED_FLASH_COOKIE = 'wakeone_account_disabled_flash';

const FLASH_COOKIE_ATTR = `${ACCOUNT_DISABLED_FLASH_COOKIE}=1; Max-Age=60; path=/; SameSite=Lax`;

export function readAccountDisabledFlash(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACCOUNT_DISABLED_FLASH_COOKIE}=([^;]*)`)
  );

  return match?.[1] === '1';
}

export function writeAccountDisabledFlash() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = FLASH_COOKIE_ATTR;
}

export function clearAccountDisabledFlash() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${ACCOUNT_DISABLED_FLASH_COOKIE}=; Max-Age=0; path=/`;
}
