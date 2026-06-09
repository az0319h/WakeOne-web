import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublishableKey, getSupabaseUrl } from './env';

import type { Affiliation } from '@/features/users/constants/organization';

export type SessionProfileFlags = {
  password_set_at: string | null;
  system_role: 'admin' | 'user';
  status: 'active' | 'inactive';
  affiliation: Affiliation | null;
};

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
      profile: null as SessionProfileFlags | null
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
      }
    }
  });

  const {
    data: { user: authUser }
  } = await supabase.auth.getUser();

  let sessionUser = authUser;
  let profile: SessionProfileFlags | null = null;

  if (authUser) {
    const { data } = await supabase
      .from('profiles')
      .select('password_set_at, system_role, status, affiliation')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (data) {
      profile = {
        password_set_at: data.password_set_at,
        system_role: data.system_role,
        status: data.status,
        affiliation: data.affiliation
      };

      if (data.status === 'inactive') {
        await supabase.auth.signOut();
        sessionUser = null;
      }
    }
  }

  return { response: supabaseResponse, user: sessionUser, profile };
}
