import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_REDIRECT_PATH = '/dashboard/overview';

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_REDIRECT_PATH;
  }

  if (value.startsWith('/auth/')) {
    return DEFAULT_REDIRECT_PATH;
  }

  return value;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const redirectTo = safeRedirectPath(request.nextUrl.searchParams.get('redirectTo'));
  const callbackUrl = new URL('/api/auth/google/callback', request.nextUrl.origin);
  callbackUrl.searchParams.set('redirectTo', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: 'https://www.googleapis.com/auth/tasks',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  if (error || !data.url) {
    const url = new URL('/auth/sign-in', request.nextUrl.origin);
    url.searchParams.set('authError', 'google_oauth_start_failed');
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(data.url);
}
