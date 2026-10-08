import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import {
  createActiveTestUser,
  createPendingGoogleUser,
  setProfileStatus,
  signInWithSupabasePassword
} from '../helpers/supabase-direct-auth';

export const E2E_TEST_PHONE = '01012345678';

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export function createProvisionPayload(email: string, fullName = 'E2E Dev Provision') {
  return {
    email,
    full_name: fullName,
    affiliation: 'wake',
    rank: '경영진',
    position_level: 'CEO',
    system_role: 'user',
    birthday: '1990-01-01',
    phone: E2E_TEST_PHONE
  };
}

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

function getServiceRoleClient() {
  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = loadEnvValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for dev provision E2E.');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function createProfileWithStatus(
  prefix: string,
  status: 'active' | 'inactive' | 'rejected' | 'pending_approval',
  email?: string
) {
  if (status === 'pending_approval') {
    return createPendingGoogleUser(prefix);
  }

  const created = await createActiveTestUser(prefix, { email });
  if (status !== 'active') {
    await setProfileStatus(created.userId, status);
    if (status === 'inactive') {
      const admin = getServiceRoleClient();
      const { error } = await admin
        .from('profiles')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('user_id', created.userId);
      if (error) {
        throw new Error(`Failed to set deactivated_at: ${error.message}`);
      }
    }
  }

  return created;
}

export async function fillProvisionSheet(
  page: Page,
  sheet: ReturnType<Page['getByRole']>,
  options: {
    email: string;
    fullName: string;
    birthdayUnset?: boolean;
  }
) {
  await sheet.getByRole('textbox', { name: '이름' }).fill(options.fullName);
  await sheet.getByRole('textbox', { name: '이메일' }).fill(options.email);
  await sheet.getByRole('textbox', { name: '연락처' }).fill(E2E_TEST_PHONE);
  await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
  await page.getByRole('option', { name: 'User', exact: true }).click();
  await sheet.getByRole('combobox', { name: '소속' }).click();
  await page.getByRole('option', { name: '웨이크', exact: true }).click();
  await sheet.getByRole('combobox', { name: '부서/사업장' }).click();
  await page.getByRole('option', { name: '사업기획팀', exact: true }).click();
  await sheet.getByRole('combobox', { name: '직급' }).click();
  await page.getByRole('option', { name: '부장', exact: true }).click();

  if (options.birthdayUnset) {
    const unsetButton = sheet.getByRole('button', { name: '미설정' });
    if ((await unsetButton.getAttribute('aria-pressed')) !== 'true') {
      await unsetButton.click();
    }
  }
}

/** Simulates Google OAuth link for a pre-provisioned email-only auth user (plan 70 AC-12). */
export async function simulateGoogleLinkForPreProvisionedUser(userId: string, email: string) {
  const admin = getServiceRoleClient();
  const password = 'E2eGoogleLink9!';

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: 'E2E Google Link', name: 'E2E Google Link' }
  });

  if (updateError) {
    throw new Error(`Failed to simulate Google link: ${updateError.message}`);
  }

  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey =
    loadEnvValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    loadEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    throw new Error('Supabase public config required for Google link simulation.');
  }

  const { session } = await signInWithSupabasePassword(email, password);
  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { error: sessionError } = await userClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  if (sessionError) {
    throw new Error(`Failed to set user session: ${sessionError.message}`);
  }

  const { data, error: rpcError } = await userClient.rpc('ensure_google_auth_profile', {
    p_google_email: email,
    p_google_display_name: 'E2E Google Link'
  });

  if (rpcError) {
    throw new Error(`ensure_google_auth_profile failed: ${rpcError.message}`);
  }

  return {
    rows: data as Array<{ user_id: string; status: string }>,
    session
  };
}
