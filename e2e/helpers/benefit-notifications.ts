import { expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { resolveUserIdByEmail } from '../notifications/helpers';
import { deleteBenefitDocumentByNumber } from './benefits-fixture';

export type BenefitNotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  status: string;
  metadata?: Record<string, unknown>;
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

function getServiceRoleClient() {
  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = loadEnvValue('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for benefit notification E2E.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function uniqueBenefitDocumentNumber(suffix: string) {
  return `E2E-BEN-${suffix}-${Date.now()}`;
}

export function benefitImportAuthHeaders(): Record<string, string> | undefined {
  const token =
    process.env.BENEFIT_IMPORT_TOKEN ??
    loadEnvValue('BENEFIT_IMPORT_TOKEN') ??
    process.env.CONTRACT_IMPORT_TOKEN ??
    loadEnvValue('CONTRACT_IMPORT_TOKEN');
  if (!token) {
    return undefined;
  }
  return {
    Authorization: `Bearer ${token}`,
    'x-benefit-import-token': token,
    'Content-Type': 'application/json'
  };
}

export function expectBenefitImportHeaders() {
  const headers = benefitImportAuthHeaders();
  expect(headers, 'BENEFIT_IMPORT_TOKEN is required in .env').toBeTruthy();
  return headers!;
}

export function buildBenefitImportPayload(options: {
  documentNumber: string;
  taskKey: string;
  applicantName: string;
  benefitType?: 'book' | 'fitness' | 'education';
}) {
  const benefitType = options.benefitType ?? 'book';
  return {
    document_number: options.documentNumber,
    task_key: options.taskKey,
    benefit_type: benefitType,
    document_created_at: '2026-10-01',
    approved_at: '2026-10-02T10:00:00+09:00',
    applicant_name: options.applicantName,
    amount: 12_000,
    source_document_url: 'https://flex.team/e2e/benefit-import',
    ...(benefitType === 'fitness' ? { benefit_month: '10' } : {})
  };
}

export async function importBenefitForNotifications(
  request: APIRequestContext,
  options: {
    documentNumber: string;
    taskKey: string;
    applicantName: string;
    benefitType?: 'book' | 'fitness' | 'education';
  }
) {
  return request.post('/api/benefits/import', {
    headers: expectBenefitImportHeaders(),
    data: buildBenefitImportPayload(options)
  });
}

export async function listNotificationsForUser(
  request: APIRequestContext,
  userId?: string
): Promise<BenefitNotificationItem[]> {
  const query = userId ? `&notif_user=${encodeURIComponent(userId)}` : '';
  const response = await request.get(`/api/notifications?limit=50${query}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { notifications?: BenefitNotificationItem[] };
  };
  return body.data?.notifications ?? [];
}

export function filterBenefitNotifications(
  notifications: BenefitNotificationItem[],
  type: string,
  documentNumber: string
) {
  return notifications.filter(
    (item) => item.type === type && item.metadata?.document_number === documentNumber
  );
}

export async function listActiveBenefitOperationsUserIds(): Promise<string[]> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, system_role, affiliation, rank, status')
    .eq('status', 'active');

  if (error) {
    throw new Error(error.message);
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.system_role === 'admin') {
      ids.add(row.user_id as string);
      continue;
    }
    if (
      row.system_role === 'user' &&
      row.affiliation === 'wake' &&
      row.rank === '인사팀'
    ) {
      ids.add(row.user_id as string);
    }
  }
  return [...ids];
}

export async function ensureApplicantName(
  request: APIRequestContext,
  email: string,
  applicantName: string
) {
  const userId = await resolveUserIdByEmail(request, email);
  const admin = getServiceRoleClient();
  const { error } = await admin
    .from('profiles')
    .update({ full_name: applicantName })
    .eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
  return userId;
}

export async function cleanupBenefitImportFixture(documentNumber: string) {
  await deleteBenefitDocumentByNumber(documentNumber);
}
