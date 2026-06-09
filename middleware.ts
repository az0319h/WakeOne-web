import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getAdminAccessDeniedParam,
  isAdminDashboardPath
} from '@/config/admin-routes';
import {
  isOfficeSnacksDashboardPath,
  OFFICE_SNACKS_ACCESS_DENIED_KEY
} from '@/config/office-snacks-routes';
import { canAccessOfficeSnacks } from '@/features/office-snacks/api/access';
import { ACCESS_DENIED_FLASH_COOKIE } from '@/lib/auth/access-denied-flash';
import { updateSession } from '@/lib/supabase/middleware';

const LOCAL_ALLOWED_ORIGIN = 'http://localhost:3000';

const UNAUTHORIZED_JSON = {
  success: false,
  message: '인증이 필요합니다.'
} as const;

const INACTIVE_JSON = {
  success: false,
  message: '비활성화된 계정입니다.'
} as const;

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, '');
}

function getAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return [LOCAL_ALLOWED_ORIGIN];
  }

  const productionOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!productionOrigin) {
    return [];
  }

  return [normalizeOrigin(productionOrigin)];
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isAuthPath(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

function isSignInPath(pathname: string): boolean {
  return pathname === '/auth/sign-in' || pathname.startsWith('/auth/sign-in/');
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });
}

function jsonWithCookies(
  sessionResponse: NextResponse,
  body: Record<string, unknown>,
  status: number
) {
  const jsonResponse = NextResponse.json(body, { status });
  copyCookies(sessionResponse, jsonResponse);
  return jsonResponse;
}

function redirectWithAccessDeniedFlash(
  request: NextRequest,
  sessionResponse: NextResponse,
  key: string
) {
  const overviewUrl = request.nextUrl.clone();
  overviewUrl.pathname = '/dashboard/overview';
  overviewUrl.search = '';
  const redirectResponse = NextResponse.redirect(overviewUrl);
  copyCookies(sessionResponse, redirectResponse);
  redirectResponse.cookies.set(ACCESS_DENIED_FLASH_COOKIE, key, {
    maxAge: 30,
    path: '/',
    sameSite: 'lax',
    httpOnly: false
  });
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = normalizeOrigin(request.nextUrl.origin);
  const pathname = request.nextUrl.pathname;

  if (allowedOrigins.length === 0) {
    return NextResponse.json(
      { message: 'NEXT_PUBLIC_APP_URL is required in production.' },
      { status: 500 }
    );
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    return NextResponse.json({ message: 'Forbidden origin' }, { status: 403 });
  }

  if (isApiPath(pathname)) {
    const { response, user, profile } = await updateSession(request);

    if (profile?.status === 'inactive') {
      return jsonWithCookies(response, INACTIVE_JSON, 403);
    }

    if (!user) {
      return jsonWithCookies(response, UNAUTHORIZED_JSON, 401);
    }

    return response;
  }

  const needsSession = isDashboardPath(pathname) || isAuthPath(pathname);

  if (!needsSession) {
    return NextResponse.next();
  }

  const { response, user, profile } = await updateSession(request);

  if (profile?.status === 'inactive') {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    signInUrl.searchParams.set('accountDisabled', '1');
    signInUrl.search = signInUrl.searchParams.toString();
    const redirectResponse = NextResponse.redirect(signInUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isAuthPath(pathname)) {
    if (!user) {
      return response;
    }

    if (isSignInPath(pathname)) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard/overview';
      dashboardUrl.search = '';
      const redirectResponse = NextResponse.redirect(dashboardUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard/overview';
    dashboardUrl.search = '';
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isDashboardPath(pathname)) {
    if (!user) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = '/auth/sign-in';
      signInUrl.searchParams.set('redirectTo', pathname);
      const redirectResponse = NextResponse.redirect(signInUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    if (isAdminDashboardPath(pathname) && profile?.system_role !== 'admin') {
      const accessDenied = getAdminAccessDeniedParam(pathname) ?? 'users';
      return redirectWithAccessDeniedFlash(request, response, accessDenied);
    }

    if (
      isOfficeSnacksDashboardPath(pathname) &&
      profile &&
      !canAccessOfficeSnacks(profile)
    ) {
      return redirectWithAccessDeniedFlash(request, response, OFFICE_SNACKS_ACCESS_DENIED_KEY);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
