import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

import type { Affiliation } from "@/features/users/constants/organization";

export type SessionProfileFlags = {
  password_set_at: string | null;
  system_role: 'admin' | 'user';
  status: 'active' | 'inactive' | 'pending_approval' | 'rejected';
  affiliation: Affiliation | null;
  rank: string | null;
};

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown };
  return (
    value.code === "refresh_token_not_found" ||
    (typeof value.message === "string" &&
      value.message.toLowerCase().includes("refresh token not found"))
  );
}

function clearInvalidAuthCookies(request: NextRequest): NextResponse {
  const authCookies = request.cookies
    .getAll()
    .filter(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));

  for (const { name } of authCookies) {
    request.cookies.delete(name);
  }

  const response = NextResponse.next({ request });
  for (const { name } of authCookies) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  let url: string;
  let key: string;

  try {
    url = getSupabaseUrl();
    key = getSupabasePublishableKey();
  } catch {
    return {
      response: NextResponse.next({ request }),
      user: null,
      profile: null as SessionProfileFlags | null,
      supabase: null,
    };
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  let authUser;
  try {
    const result = await supabase.auth.getUser();
    authUser = result.data.user;
  } catch (error) {
    if (!isInvalidRefreshTokenError(error)) throw error;
    return {
      response: clearInvalidAuthCookies(request),
      user: null,
      profile: null as SessionProfileFlags | null,
      supabase: null,
    };
  }

  let sessionUser = authUser;
  let profile: SessionProfileFlags | null = null;

  if (authUser) {
    const { data } = await supabase
      .from("profiles")
      .select('password_set_at, system_role, status, affiliation, rank')
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (data) {
      profile = {
        password_set_at: data.password_set_at,
        system_role: data.system_role,
        status: data.status,
        affiliation: data.affiliation,
        rank: data.rank
      };

      if (data.status !== "active") {
        // 비활성·비승인 계정은 모든 기기 세션을 끊는다 (plan 104)
        await supabase.auth.signOut({ scope: 'global' });
        sessionUser = null;
      }
    }
  }

  return { response: supabaseResponse, user: sessionUser, profile, supabase };
}
