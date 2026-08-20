import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

export const MUST_CHANGE_INITIAL_PASSWORD_COOKIE = 'must_change_initial_password';
export const MUST_CHANGE_INITIAL_PASSWORD_VALUE = '1';

export const MUST_CHANGE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production'
};

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

type CookieWriter = {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      path?: string;
      secure?: boolean;
      maxAge?: number;
    }
  ) => void;
};

export function hasMustChangeInitialPasswordCookie(store: CookieReader): boolean {
  return (
    store.get(MUST_CHANGE_INITIAL_PASSWORD_COOKIE)?.value ===
    MUST_CHANGE_INITIAL_PASSWORD_VALUE
  );
}

export function hasMustChangeInitialPasswordCookieFromRequest(
  request: Pick<NextRequest, 'cookies' | 'headers'>
): boolean {
  if (hasMustChangeInitialPasswordCookie(request.cookies)) {
    return true;
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }

  const pattern = new RegExp(
    `(?:^|;\\s*)${MUST_CHANGE_INITIAL_PASSWORD_COOKIE}=([^;]+)`
  );
  const match = cookieHeader.match(pattern);
  return match?.[1] === MUST_CHANGE_INITIAL_PASSWORD_VALUE;
}

export function setMustChangeInitialPasswordCookie(store: CookieWriter): void {
  store.set(
    MUST_CHANGE_INITIAL_PASSWORD_COOKIE,
    MUST_CHANGE_INITIAL_PASSWORD_VALUE,
    MUST_CHANGE_COOKIE_OPTIONS
  );
}

export function clearMustChangeInitialPasswordCookie(store: CookieWriter): void {
  store.set(MUST_CHANGE_INITIAL_PASSWORD_COOKIE, '', {
    ...MUST_CHANGE_COOKIE_OPTIONS,
    maxAge: 0
  });
}

export function setMustChangeInitialPasswordCookieOnResponse(response: NextResponse): void {
  response.cookies.set(
    MUST_CHANGE_INITIAL_PASSWORD_COOKIE,
    MUST_CHANGE_INITIAL_PASSWORD_VALUE,
    MUST_CHANGE_COOKIE_OPTIONS
  );
}

export function clearMustChangeInitialPasswordCookieOnResponse(response: NextResponse): void {
  response.cookies.set(MUST_CHANGE_INITIAL_PASSWORD_COOKIE, '', {
    ...MUST_CHANGE_COOKIE_OPTIONS,
    maxAge: 0
  });
}
