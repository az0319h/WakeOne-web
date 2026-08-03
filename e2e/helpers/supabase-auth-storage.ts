import { createClient, type Session } from '@supabase/supabase-js';
import { expect, type BrowserContext } from '@playwright/test';

const BASE64_PREFIX = 'base64-';

function getAuthCookieName(supabaseUrl: string) {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

function encodeSessionCookie(session: Session) {
  const payload = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user
  });

  return BASE64_PREFIX + Buffer.from(payload).toString('base64url');
}

export async function authenticateStorageState(
  context: BrowserContext,
  email: string,
  password: string,
  outputPath: string
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
    '127.0.0.1',
    'localhost'
  );

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set for E2E auth.'
    );
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw error ?? new Error(`Failed to sign in as ${email}`);
  }

  const domain = new URL(baseURL).hostname;

  await context.addCookies([
    {
      name: getAuthCookieName(supabaseUrl),
      value: encodeSessionCookie(data.session),
      domain,
      path: '/',
      sameSite: 'Lax',
      expires: data.session.expires_at ?? undefined
    }
  ]);

  const page = await context.newPage();
  await page.goto(`${baseURL}/dashboard/overview`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await context.storageState({ path: outputPath });
  await page.close();
}
