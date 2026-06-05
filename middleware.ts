import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const LOCAL_ALLOWED_ORIGIN = 'http://localhost:3000';

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

function isDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isAuthPath(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

function isSetPasswordPath(pathname: string): boolean {
  return pathname === '/auth/set-password';
}

function isSignInPath(pathname: string): boolean {
  return pathname === '/auth/sign-in' || pathname.startsWith('/auth/sign-in/');
}

function needsPasswordSetup(profile: { password_set_at: string | null } | null): boolean {
  return !!profile && profile.password_set_at === null;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });
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

    const pendingPassword = needsPasswordSetup(profile);

    if (isSetPasswordPath(pathname)) {
      if (!pendingPassword) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = '/dashboard/overview';
        dashboardUrl.search = '';
        const redirectResponse = NextResponse.redirect(dashboardUrl);
        copyCookies(response, redirectResponse);
        return redirectResponse;
      }

      return response;
    }

    if (pendingPassword) {
      const setPasswordUrl = request.nextUrl.clone();
      setPasswordUrl.pathname = '/auth/set-password';
      setPasswordUrl.search = '';
      const redirectResponse = NextResponse.redirect(setPasswordUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
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

    if (needsPasswordSetup(profile)) {
      const setPasswordUrl = request.nextUrl.clone();
      setPasswordUrl.pathname = '/auth/set-password';
      setPasswordUrl.search = '';
      const redirectResponse = NextResponse.redirect(setPasswordUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    if (pathname === '/dashboard/users' || pathname.startsWith('/dashboard/users/')) {
      if (profile?.system_role !== 'admin') {
        const overviewUrl = request.nextUrl.clone();
        overviewUrl.pathname = '/dashboard/overview';
        overviewUrl.search = '?accessDenied=users';
        const redirectResponse = NextResponse.redirect(overviewUrl);
        copyCookies(response, redirectResponse);
        return redirectResponse;
      }
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
