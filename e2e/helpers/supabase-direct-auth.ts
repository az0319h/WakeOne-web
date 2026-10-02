import fs from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { APIRequestContext } from '@playwright/test';
import { e2eBaseURL, normalizePlaywrightStorageState } from './auth-request';

type CookieJarEntry = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    path?: string;
    expires?: number | Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: boolean | 'strict' | 'lax' | 'none' | 'Strict' | 'Lax' | 'None';
  };
};

function loadEnvValue(key: string): string {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return process.env[key]?.trim() ?? '';
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && match[1] === key) {
      return match[2].trim();
    }
  }

  return process.env[key]?.trim() ?? '';
}

function getSupabasePublicConfig() {
  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const key =
    loadEnvValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    loadEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and publishable/anon key are required for E2E auth.');
  }

  return { url, key };
}

function getServiceRoleClient() {
  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = loadEnvValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Google auth E2E fixtures.');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function normalizeSameSite(value: unknown): 'Strict' | 'Lax' | 'None' {
  if (typeof value !== 'string') {
    return 'Lax';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'none') return 'None';
  return 'Lax';
}

function cookieJarToPlaywrightCookies(cookieJar: CookieJarEntry[], baseURL: string) {
  const hostname = new URL(baseURL).hostname;

  return cookieJar.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.options?.domain ?? hostname,
    path: cookie.options?.path ?? '/',
    expires:
      cookie.options?.expires instanceof Date
        ? Math.floor(cookie.options.expires.getTime() / 1000)
        : (cookie.options?.expires ?? -1),
    httpOnly: cookie.options?.httpOnly ?? false,
    secure: cookie.options?.secure ?? baseURL.startsWith('https'),
    sameSite: normalizeSameSite(cookie.options?.sameSite)
  }));
}

export async function signInWithSupabasePassword(email: string, password: string) {
  const { url, key } = getSupabasePublicConfig();
  const authClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Supabase sign-in failed for ${email}: ${error?.message ?? 'no session'}`);
  }

  const cookieJar: CookieJarEntry[] = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieJar.map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          const existingIndex = cookieJar.findIndex((item) => item.name === cookie.name);
          if (existingIndex >= 0) {
            cookieJar[existingIndex] = cookie;
          } else {
            cookieJar.push(cookie);
          }
        }
      }
    }
  });

  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });

  if (setSessionError) {
    throw new Error(`Failed to persist Supabase session cookies: ${setSessionError.message}`);
  }

  return {
    session: data.session,
    storageState: normalizePlaywrightStorageState(
      { cookies: cookieJarToPlaywrightCookies(cookieJar, e2eBaseURL), origins: [] },
      e2eBaseURL
    )
  };
}

export async function createPendingGoogleUser(prefix: string, password = 'E2ePending9!') {
  const admin = getServiceRoleClient();
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: 'E2E Pending', name: 'E2E Pending' }
  });

  if (error || !data.user) {
    throw new Error(`Failed to create pending Google user: ${error?.message ?? 'no user'}`);
  }

  const userId = data.user.id;

  await admin
    .from('profiles')
    .update({
      email,
      status: 'pending_approval',
      google_email: email,
      google_display_name: 'E2E Pending',
      full_name: '',
      approval_requested_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  return { userId, email, password };
}

export type ActiveTestUserOptions = {
  email?: string;
  fullName?: string;
  birthday?: string | null;
  phone?: string;
  password?: string;
};

export async function createActiveTestUser(
  prefix: string,
  options: ActiveTestUserOptions = {}
) {
  const admin = getServiceRoleClient();
  const email =
    options.email ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = options.password ?? 'E2eActive9!';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error || !data.user) {
    throw new Error(`Failed to create active test user: ${error?.message ?? 'no user'}`);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      email,
      full_name: options.fullName ?? 'E2E 테스트',
      affiliation: 'wake',
      rank: '경영진',
      system_role: 'user',
      birthday: options.birthday === undefined ? '1990-01-01' : options.birthday,
      phone: options.phone ?? '01012345678',
      status: 'active',
      deactivated_at: null
    })
    .eq('user_id', data.user.id);

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(`Failed to activate test profile: ${profileError.message}`);
  }

  return { userId: data.user.id, email, password };
}

export async function setProfileStatus(userId: string, status: 'active' | 'inactive' | 'pending_approval' | 'rejected') {
  const admin = getServiceRoleClient();
  const { error } = await admin.from('profiles').update({ status }).eq('user_id', userId);
  if (error) {
    throw new Error(`Failed to set profile status ${status}: ${error.message}`);
  }
}

export async function createGuestRequestWithPassword(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } },
  email: string,
  password: string
) {
  const { storageState } = await signInWithSupabasePassword(email, password);
  return playwright.request.newContext({
    baseURL: e2eBaseURL,
    storageState
  });
}
