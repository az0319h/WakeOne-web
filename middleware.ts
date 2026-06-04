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

  const { response, user } = await updateSession(request);

  if (isAuthPath(pathname)) {
    if (user) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard/overview';
      dashboardUrl.search = '';
      const redirectResponse = NextResponse.redirect(dashboardUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    return response;
  }

  if (isDashboardPath(pathname) && !user) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    signInUrl.searchParams.set('redirectTo', pathname);
    const redirectResponse = NextResponse.redirect(signInUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
