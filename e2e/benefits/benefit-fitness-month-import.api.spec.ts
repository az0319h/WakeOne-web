import { expect, test } from '@playwright/test';
import {
  buildFitnessMonthPayload,
  findActivityLogByRequestId,
  fitnessMonthStamp,
  postBenefitImport,
  type ImportedBenefitDocument
} from '../helpers/benefit-fitness-month';
import {
  deleteBenefitDocumentByNumber,
  getBenefitDocumentRowByNumber,
  listBenefitImportEventsByRequestId
} from '../helpers/benefits-fixture';
import { createOrgChartTestUser } from '../helpers/org-chart';

// plan: docs/plans/80_benefit-fitness-target-month-plan.md
test.describe.configure({ mode: 'serial' });

test.describe('체력증진비 해당 월 import API (plan 80)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(120_000);

  const stamp = fitnessMonthStamp();
  const createdNumbers: string[] = [];
  let applicantName = '';

  function docNumber(tag: string) {
    const value = `E2E-FM-${tag}-${stamp}`;
    createdNumbers.push(value);
    return value;
  }

  test.beforeAll(async () => {
    const person = await createOrgChartTestUser('benefit-fm-import', {
      fullName: `E2E FM Import ${stamp}`,
      affiliation: 'wake',
      rank: '마케팅팀',
      position_level: '과장'
    });
    applicantName = person.fullName;
  });

  test.afterAll(async () => {
    for (const documentNumber of createdNumbers) {
      await deleteBenefitDocumentByNumber(documentNumber);
    }
  });

  test('AC-01: fitness "10월" import → 201 · benefit_month·attributed_month 2026-10-01', async ({
    request
  }) => {
    const documentNumber = docNumber('AC01');
    const response = await postBenefitImport(
      request,
      buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: '10월' })
    );
    expect(response.status()).toBe(201);
    expect(response.headers()['x-request-id']).toBeTruthy();
    const body = (await response.json()) as { document: ImportedBenefitDocument };
    expect(body.document.benefit_month).toBe('2026-10-01');
    expect(body.document.attributed_month).toBe('2026-10-01');
  });

  test('AC-03: 허용 입력 정규화 (작성일 2026-10-14)', async ({ request }) => {
    const cases: Array<{ input: string | number; expected: string }> = [
      { input: '10', expected: '2026-10-01' },
      { input: 10, expected: '2026-10-01' },
      { input: '01월', expected: '2026-01-01' },
      { input: ' 9 월', expected: '2026-09-01' },
      { input: '9월분', expected: '2026-09-01' },
      { input: '１０', expected: '2026-10-01' },
      { input: '１０월', expected: '2026-10-01' },
      { input: '2026-10', expected: '2026-10-01' },
      { input: '2026.10', expected: '2026-10-01' },
      { input: '2026년 10월', expected: '2026-10-01' }
    ];
    for (const [index, item] of cases.entries()) {
      const documentNumber = docNumber(`AC03-${index}`);
      const response = await postBenefitImport(
        request,
        buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: item.input })
      );
      expect(response.status(), `input=${JSON.stringify(item.input)}`).toBe(201);
      const body = (await response.json()) as { document: ImportedBenefitDocument };
      expect(body.document.benefit_month, `input=${JSON.stringify(item.input)}`).toBe(
        item.expected
      );
    }
  });

  test('AC-04: 작성일 2027-01-05 · "12" → 2027-12-01 (작성 연도 고정)', async ({ request }) => {
    const documentNumber = docNumber('AC04');
    const response = await postBenefitImport(
      request,
      buildFitnessMonthPayload({
        documentNumber,
        applicantName,
        documentCreatedAt: '2027-01-05',
        benefitMonth: '12'
      })
    );
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { document: ImportedBenefitDocument };
    expect(body.document.benefit_month).toBe('2027-12-01');
    expect(body.document.attributed_month).toBe('2027-12-01');
  });

  test('AC-05: 파싱 불가 입력 → 400 · 행 미생성', async ({ request }) => {
    const inputs: Array<string | number> = [
      '13',
      '0',
      '001',
      '9,10월',
      '9~10월',
      '구월',
      'ex. 9월',
      '2025년 12월',
      10.5
    ];
    for (const [index, input] of inputs.entries()) {
      const documentNumber = docNumber(`AC05-${index}`);
      const response = await postBenefitImport(
        request,
        buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: input })
      );
      expect(response.status(), `input=${JSON.stringify(input)}`).toBe(400);
      const body = (await response.json()) as { success: boolean; message: string };
      expect(body.success).toBe(false);
      expect(body.message).toContain('해당 월 형식이 올바르지 않습니다');
      expect(await getBenefitDocumentRowByNumber(documentNumber)).toBeNull();
    }
  });

  test('AC-06: 해당 월 누락(필드 없음·null·""·공백) → 400 · 행 미생성', async ({ request }) => {
    const inputs: Array<string | null | undefined> = [undefined, null, '', '   '];
    for (const [index, input] of inputs.entries()) {
      const documentNumber = docNumber(`AC06-${index}`);
      const response = await postBenefitImport(
        request,
        buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: input })
      );
      expect(response.status(), `input=${JSON.stringify(input)}`).toBe(400);
      const body = (await response.json()) as { message: string };
      expect(body.message).toBe('체력증진비는 해당 월(1~12월)이 필요합니다.');
      expect(await getBenefitDocumentRowByNumber(documentNumber)).toBeNull();
    }
  });

  test('AC-07: 400 거부 시 x-request-id · activity log · import event 기록', async ({
    request
  }) => {
    const cases: Array<{ input: string | undefined; reason: string }> = [
      { input: '13', reason: 'benefit_month_invalid' },
      { input: undefined, reason: 'benefit_month_missing' }
    ];
    for (const [index, item] of cases.entries()) {
      const documentNumber = docNumber(`AC07-${index}`);
      const response = await postBenefitImport(
        request,
        buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: item.input })
      );
      expect(response.status()).toBe(400);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      const log = await findActivityLogByRequestId(request, 'benefit.import_failed', requestId);
      expect(log?.http_status).toBe(400);
      expect(log?.metadata?.error_code).toBe('validation');
      expect(log?.metadata?.benefit_month_reason).toBe(item.reason);

      const events = await listBenefitImportEventsByRequestId(requestId);
      expect(events).toHaveLength(1);
      expect(events[0]?.status).toBe('failed');
      expect(events[0]?.error_code).toBe(item.reason);
    }
  });

  test('AC-08: book·education은 benefit_month 무시 → null · 작성일 월 귀속', async ({
    request
  }) => {
    for (const benefitType of ['book', 'education'] as const) {
      const documentNumber = docNumber(`AC08-${benefitType}`);
      const response = await postBenefitImport(
        request,
        buildFitnessMonthPayload({ documentNumber, applicantName, benefitType, benefitMonth: 'abc' })
      );
      expect(response.status(), benefitType).toBe(201);
      const body = (await response.json()) as { document: ImportedBenefitDocument };
      expect(body.document.benefit_month).toBeNull();
      expect(body.document.attributed_month).toBe('2026-10-01');
    }
  });

  test('AC-09: duplicate 우선 — 해당 월 누락·불가여도 200 · 저장값 불변', async ({ request }) => {
    const documentNumber = docNumber('AC09');
    const first = await postBenefitImport(
      request,
      buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: '10' })
    );
    expect(first.status()).toBe(201);

    for (const benefitMonth of [undefined, '13']) {
      const response = await postBenefitImport(
        request,
        buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth })
      );
      expect(response.status(), `benefit_month=${String(benefitMonth)}`).toBe(200);
      const body = (await response.json()) as {
        status: string;
        document: ImportedBenefitDocument;
      };
      expect(body.status).toBe('duplicate');
      expect(body.document.benefit_month).toBe('2026-10-01');

      const requestId = response.headers()['x-request-id'];
      const log = await findActivityLogByRequestId(request, 'benefit.import_duplicate', requestId);
      expect(log?.http_status).toBe(200);
    }

    const row = await getBenefitDocumentRowByNumber(documentNumber);
    expect(row?.benefit_month).toBe('2026-10-01');
  });

  test('AC-17: 민감정보 키는 저장·로그되지 않고 create·duplicate 로그 기록', async ({
    request
  }) => {
    const sensitive = '110-000-000000';
    const documentNumber = docNumber('AC17');
    const payload = buildFitnessMonthPayload({
      documentNumber,
      applicantName,
      benefitMonth: '10',
      extra: { bank_account: sensitive }
    });

    const first = await postBenefitImport(request, payload);
    expect(first.status()).toBe(201);
    const firstId = first.headers()['x-request-id'];
    expect(firstId).toBeTruthy();

    const second = await postBenefitImport(request, payload);
    expect(second.status()).toBe(200);
    const secondId = second.headers()['x-request-id'];
    expect(secondId).toBeTruthy();

    const createLog = await findActivityLogByRequestId(request, 'benefit.import_create', firstId);
    expect(createLog?.metadata?.benefit_month).toBe('2026-10');
    const duplicateLog = await findActivityLogByRequestId(
      request,
      'benefit.import_duplicate',
      secondId
    );
    expect(duplicateLog).toBeTruthy();

    for (const log of [createLog, duplicateLog]) {
      const serialized = JSON.stringify({ metadata: log?.metadata, message: log?.message });
      expect(serialized).not.toContain(sensitive);
      expect(serialized.toLowerCase()).not.toContain('bank');
    }

    const row = await getBenefitDocumentRowByNumber(documentNumber);
    expect(row).not.toBeNull();
    const rowSerialized = JSON.stringify(row);
    expect(rowSerialized).not.toContain(sensitive);
    expect(Object.keys(row ?? {}).some((key) => key.includes('bank'))).toBe(false);

    for (const requestId of [firstId, secondId]) {
      const events = await listBenefitImportEventsByRequestId(requestId);
      expect(JSON.stringify(events)).not.toContain(sensitive);
    }
  });

  test('AC-18: 잘못된 Bearer → 401 · unauthenticated 로그 · 행 미생성', async ({ request }) => {
    const documentNumber = docNumber('AC18');
    const response = await postBenefitImport(
      request,
      buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: '10' }),
      { Authorization: 'Bearer invalid-e2e-token', 'Content-Type': 'application/json' }
    );
    expect(response.status()).toBe(401);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();
    const log = await findActivityLogByRequestId(request, 'benefit.import_failed', requestId);
    expect(log?.metadata?.error_code).toBe('unauthenticated');
    expect(await getBenefitDocumentRowByNumber(documentNumber)).toBeNull();
  });

  test('AC-19: 이름 불일치 → 422 · import_failed 로그 · 행 미생성', async ({ request }) => {
    const documentNumber = docNumber('AC19');
    const response = await postBenefitImport(
      request,
      buildFitnessMonthPayload({
        documentNumber,
        applicantName: `E2E FM NoMatch ${stamp}`,
        benefitMonth: '10'
      })
    );
    expect(response.status()).toBe(422);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();
    const log = await findActivityLogByRequestId(request, 'benefit.import_failed', requestId);
    expect(log?.http_status).toBe(422);
    expect(await getBenefitDocumentRowByNumber(documentNumber)).toBeNull();
  });

  test('AC-20: E2E-IMPORT-FAIL 시뮬레이션 → 500 · internal_error 로그 · 앱 정상', async ({
    request
  }) => {
    const documentNumber = docNumber('E2E-IMPORT-FAIL-AC20');
    const response = await postBenefitImport(
      request,
      buildFitnessMonthPayload({ documentNumber, applicantName, benefitMonth: '10' })
    );
    expect(response.status()).toBe(500);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(false);
    const log = await findActivityLogByRequestId(request, 'benefit.import_failed', requestId);
    expect(log?.http_status).toBe(500);
    expect(log?.metadata?.error_code).toBe('internal_error');
    expect(await getBenefitDocumentRowByNumber(documentNumber)).toBeNull();

    const health = await request.get('/api/benefits?month=2026-10&affiliation=wake');
    expect(health.status()).toBe(200);
  });
});
