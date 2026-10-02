export function isUserBannedOAuthSignal(
  errorCode: string | null | undefined,
  errorMessage?: string | null
): boolean {
  if (errorCode === 'user_banned') {
    return true;
  }

  const normalized = errorMessage?.toLowerCase() ?? '';
  return normalized.includes('user is banned') || normalized.includes('banned');
}

function readSupabaseOAuthHashParams(): URLSearchParams | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) {
    return null;
  }

  return new URLSearchParams(hash);
}

export function readSupabaseOAuthHashErrorCode(): string | null {
  return readSupabaseOAuthHashParams()?.get('error_code') ?? null;
}

export function readSupabaseOAuthHashErrorDescription(): string | null {
  return readSupabaseOAuthHashParams()?.get('error_description') ?? null;
}

export function clearSupabaseOAuthHash() {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.hash) {
    return;
  }

  url.hash = '';
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}
