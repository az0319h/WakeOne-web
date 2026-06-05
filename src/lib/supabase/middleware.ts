import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export type SessionProfileFlags = {
  password_set_at: string | null;
  system_role: 'admin' | 'user';
  status: 'active' | 'inactive';
};

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
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
      .select('password_set_at, system_role, status')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (data) {
      profile = {
        password_set_at: data.password_set_at,
        system_role: data.system_role,
        status: data.status
      };

      if (data.status === 'inactive') {
        await supabase.auth.signOut();
        sessionUser = null;
      }
    }
  }

  return { response: supabaseResponse, user: sessionUser, profile };
}
