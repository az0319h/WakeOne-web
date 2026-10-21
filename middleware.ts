import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAdminAccessDeniedParam,
  isAdminDashboardPath,
  isBenefitsAdminDashboardPath,
  isWorkflowAdminDashboardPath,
  isWorkflowPrintPath,
  WORKFLOW_ADMIN_ACCESS_DENIED_KEY,
  WORKFLOW_ADMIN_DENIED_REDIRECT
} from '@/config/admin-routes';
import { canAccessBenefitsAdmin } from '@/features/auth/api/benefits-access.server';
import { isDisabledDashboardPath } from "@/config/disabled-routes";
import { ACCESS_DENIED_FLASH_COOKIE } from "@/lib/auth/access-denied-flash";
import { ACCOUNT_DISABLED_FLASH_COOKIE } from "@/lib/auth/account-disabled-flash";
import { updateSession } from "@/lib/supabase/middleware";

const LOCAL_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

const UNAUTHORIZED_JSON = {
  success: false,
  message: "인증이 필요합니다.",
} as const;

const INACTIVE_JSON = {
  success: false,
  message: "비활성화된 계정입니다.",
} as const;

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

function getAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return [...LOCAL_ALLOWED_ORIGINS];
  }

  const productionOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!productionOrigin) {
    return [];
  }

  return [normalizeOrigin(productionOrigin)];
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isServiceTokenApiPath(pathname: string): boolean {
  return (
    pathname === "/api/contracts/import" ||
    pathname === "/api/contracts/reminders" ||
    pathname === "/api/benefits/import" ||
    pathname === "/api/wallet/sync" ||
    pathname === "/api/wallet/balance-email/dispatch"
  );
}

function isPublicAuthApiPath(pathname: string, method: string): boolean {
  return (
    (pathname === "/api/auth/sign-in" && method === "POST") ||
    (pathname === "/api/auth/google/start" && method === "GET") ||
    (pathname === "/api/auth/google/callback" && method === "GET")
  );
}

function isDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isAuthPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

function isSignInPath(pathname: string): boolean {
  return pathname === "/auth/sign-in" || pathname.startsWith("/auth/sign-in/");
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });
}

function jsonWithCookies(
  sessionResponse: NextResponse,
  body: Record<string, unknown>,
  status: number,
) {
  const jsonResponse = NextResponse.json(body, { status });
  copyCookies(sessionResponse, jsonResponse);
  return jsonResponse;
}

/** plan 88 — /dashboard/workflow/settings: 시스템 관리자가 아니면 workflow_admins 본인 행(RLS: 본인 행 select 허용) 확인 */
async function hasWorkflowAdminRow(
  supabase: Awaited<ReturnType<typeof updateSession>>["supabase"],
  userId: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("workflow_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

function redirectWithAccessDeniedFlash(
  request: NextRequest,
  sessionResponse: NextResponse,
  key: string,
  redirectPath = "/dashboard/overview",
) {
  const overviewUrl = request.nextUrl.clone();
  overviewUrl.pathname = redirectPath;
  overviewUrl.search = "";
  const redirectResponse = NextResponse.redirect(overviewUrl);
  copyCookies(sessionResponse, redirectResponse);
  redirectResponse.cookies.set(ACCESS_DENIED_FLASH_COOKIE, key, {
    maxAge: 30,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = normalizeOrigin(request.nextUrl.origin);
  const pathname = request.nextUrl.pathname;

  if (allowedOrigins.length === 0) {
    return NextResponse.json(
      { message: "NEXT_PUBLIC_APP_URL is required in production." },
      { status: 500 },
    );
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    return NextResponse.json({ message: "Forbidden origin" }, { status: 403 });
  }

  if (isApiPath(pathname) && !isServiceTokenApiPath(pathname)) {
    if (isPublicAuthApiPath(pathname, request.method)) {
      return NextResponse.next();
    }

    const { response, user, profile } = await updateSession(request);

    if (profile && profile.status !== "active") {
      return jsonWithCookies(response, INACTIVE_JSON, 403);
    }

    if (!user) {
      return jsonWithCookies(response, UNAUTHORIZED_JSON, 401);
    }

    return response;
  }

  const isPrintPath = isWorkflowPrintPath(pathname);
  const needsSession = isDashboardPath(pathname) || isAuthPath(pathname) || isPrintPath;

  if (!needsSession) {
    return NextResponse.next();
  }

  const { response, user, profile, supabase } = await updateSession(request);

  if (profile && profile.status !== "active") {
    if (isSignInPath(pathname)) {
      const authStatus = request.nextUrl.searchParams.get("authStatus");
      const accountDisabled = request.nextUrl.searchParams.get("accountDisabled");
      const alreadyOnSignInNotice =
        (profile.status === "pending_approval" && authStatus === "pending_approval") ||
        (profile.status === "rejected" && authStatus === "rejected") ||
        (profile.status === "inactive" && accountDisabled === "1");

      if (alreadyOnSignInNotice) {
        return response;
      }
    }

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    signInUrl.search = "";
    if (profile.status === "pending_approval" || profile.status === "rejected") {
      signInUrl.searchParams.set("authStatus", profile.status);
    } else {
      signInUrl.searchParams.set("accountDisabled", "1");
    }
    const redirectResponse = NextResponse.redirect(signInUrl);
    copyCookies(response, redirectResponse);
    if (profile.status === "inactive") {
      redirectResponse.cookies.set(ACCOUNT_DISABLED_FLASH_COOKIE, "1", {
        maxAge: 60,
        path: "/",
        sameSite: "lax",
        httpOnly: false,
      });
    }
    return redirectResponse;
  }

  if (isAuthPath(pathname)) {
    if (!user) {
      return response;
    }

    if (isSignInPath(pathname)) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard/overview";
      dashboardUrl.search = "";
      const redirectResponse = NextResponse.redirect(dashboardUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard/overview";
    dashboardUrl.search = "";
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (isDashboardPath(pathname) || isPrintPath) {
    if (!user) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = "/auth/sign-in";
      signInUrl.searchParams.set("redirectTo", pathname);
      const redirectResponse = NextResponse.redirect(signInUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    if (isDisabledDashboardPath(pathname)) {
      const overviewUrl = request.nextUrl.clone();
      overviewUrl.pathname = "/dashboard/overview";
      overviewUrl.search = "";
      const redirectResponse = NextResponse.redirect(overviewUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    if (isBenefitsAdminDashboardPath(pathname) && profile && !canAccessBenefitsAdmin(profile)) {
      const accessDenied = getAdminAccessDeniedParam(pathname) ?? 'benefits';
      return redirectWithAccessDeniedFlash(request, response, accessDenied);
    }

    if (isAdminDashboardPath(pathname) && profile?.system_role !== 'admin') {
      const accessDenied = getAdminAccessDeniedParam(pathname) ?? 'users';
      return redirectWithAccessDeniedFlash(request, response, accessDenied);
    }

    if (
      isWorkflowAdminDashboardPath(pathname) &&
      user &&
      profile?.system_role !== 'admin' &&
      !(await hasWorkflowAdminRow(supabase, user.id))
    ) {
      return redirectWithAccessDeniedFlash(
        request,
        response,
        WORKFLOW_ADMIN_ACCESS_DENIED_KEY,
        WORKFLOW_ADMIN_DENIED_REDIRECT,
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
