import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

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
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for benefits E2E fixtures.');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export type InsertBenefitDocumentInput = {
  applicantUserId: string;
  applicantName: string;
  documentNumber: string;
  taskKey: string;
  documentCreatedAt: string;
  amount: number;
  benefitType?: 'book' | 'fitness' | 'education';
};

export async function insertBenefitDocumentForE2e(input: InsertBenefitDocumentInput) {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from('benefit_documents')
    .insert({
      document_number: input.documentNumber,
      task_key: input.taskKey,
      benefit_type: input.benefitType ?? 'fitness',
      document_created_at: input.documentCreatedAt,
      approved_at: new Date().toISOString(),
      applicant_user_id: input.applicantUserId,
      applicant_name: input.applicantName,
      amount: input.amount,
      description: 'E2E benefit cancel',
      source_document_url: 'https://example.com/flex/e2e-benefit'
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert benefit document: ${error?.message ?? 'no row'}`);
  }

  return { id: Number(data.id) };
}

export async function getProfileForBenefitsFixture(userId: string): Promise<{
  fullName: string;
  affiliation: string;
}> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from('profiles')
    .select('full_name, affiliation')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.full_name || !data.affiliation) {
    throw new Error(`Profile not found for benefits fixture: ${userId}`);
  }
  return { fullName: data.full_name, affiliation: data.affiliation };
}

export async function deleteBenefitDocumentByNumber(documentNumber: string) {
  const admin = getServiceRoleClient();
  await admin.from('benefit_documents').delete().eq('document_number', documentNumber);
}

export type ProfileEmploymentSnapshot = {
  created_at: string;
  status: string;
  deactivated_at: string | null;
  position_level: string | null;
  rank: string | null;
};

export async function getProfileEmploymentSnapshot(
  userId: string
): Promise<ProfileEmploymentSnapshot> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from('profiles')
    .select('created_at, status, deactivated_at, position_level, rank')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Profile employment snapshot failed: ${error?.message ?? 'no row'}`);
  }
  return {
    created_at: data.created_at,
    status: data.status,
    deactivated_at: data.deactivated_at,
    position_level: data.position_level,
    rank: data.rank
  };
}

export async function setProfileEmploymentForE2e(
  userId: string,
  input: ProfileEmploymentSnapshot
): Promise<void> {
  const admin = getServiceRoleClient();
  const { error } = await admin
    .from('profiles')
    .update({
      created_at: input.created_at,
      status: input.status,
      deactivated_at: input.deactivated_at,
      position_level: input.position_level,
      rank: input.rank
    })
    .eq('user_id', userId);
  if (error) {
    throw new Error(`Failed to set profile employment: ${error.message}`);
  }
}
