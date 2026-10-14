import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { expectBenefitImportHeaders } from './benefit-notifications';

export type FitnessMonthActivityLog = {
  request_id?: string;
  action?: string;
  http_status?: number;
  message?: string | null;
  metadata?: Record<string, unknown>;
};

export type ImportedBenefitDocument = {
  document_number: string;
  benefit_type: 'book' | 'fitness' | 'education';
  document_created_at: string;
  benefit_month: string | null;
  attributed_month: string;
  amount: number;
};

export function fitnessMonthStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildFitnessMonthPayload(options: {
  documentNumber: string;
  applicantName: string;
  benefitType?: 'book' | 'fitness' | 'education';
  documentCreatedAt?: string;
  amount?: number;
  /** `undefined`면 필드 자체를 생략한다 */
  benefitMonth?: string | number | null;
  extra?: Record<string, unknown>;
}) {
  const payload: Record<string, unknown> = {
    document_number: options.documentNumber,
    task_key: `e2e-fm-${options.documentNumber.toLowerCase()}`,
    benefit_type: options.benefitType ?? 'fitness',
    document_created_at: options.documentCreatedAt ?? '2026-10-14',
    approved_at: '2026-10-14T13:59:00+09:00',
    applicant_name: options.applicantName,
    amount: options.amount ?? 11_000,
    description: 'E2E 체력증진 해당 월',
    source_document_url: 'https://flex.team/e2e/benefit-fitness-month',
    ...options.extra
  };
  if (options.benefitMonth !== undefined) {
    payload.benefit_month = options.benefitMonth;
  }
  return payload;
}

export async function postBenefitImport(
  request: APIRequestContext,
  payload: Record<string, unknown>,
  headers: Record<string, string> = expectBenefitImportHeaders()
): Promise<APIResponse> {
  return request.post('/api/benefits/import', { headers, data: payload });
}

export async function findActivityLogByRequestId(
  request: APIRequestContext,
  action: string,
  requestId: string
): Promise<FitnessMonthActivityLog | undefined> {
  let found: FitnessMonthActivityLog | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `/api/activity-logs?action=${encodeURIComponent(action)}&limit=100&log_user=all`
        );
        if (response.status() !== 200) return false;
        const body = (await response.json()) as {
          data?: { logs?: FitnessMonthActivityLog[] };
        };
        found = (body.data?.logs ?? []).find((log) => log.request_id === requestId);
        return Boolean(found);
      },
      { timeout: 15_000 }
    )
    .toBe(true);
  return found;
}
