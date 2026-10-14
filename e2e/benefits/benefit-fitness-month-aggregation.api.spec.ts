import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  buildFitnessMonthPayload,
  fitnessMonthStamp,
  postBenefitImport
} from '../helpers/benefit-fitness-month';
import {
  deleteBenefitDocumentByNumber,
  insertBenefitDocumentForE2e
} from '../helpers/benefits-fixture';
import { currentKstMonthForE2e } from '../helpers/kst-month';
import { createOrgChartTestUser } from '../helpers/org-chart';

// plan: docs/plans/80_benefit-fitness-target-month-plan.md
test.describe.configure({ mode: 'serial' });

type ApiDocument = {
  document_number: string;
  benefit_month: string | null;
  attributed_month: string;
  amount: number;
};

type AdminMember = {
  user_id: string;
  total_used: number;
  category_totals: { book: number; fitness: number; education: number };
  documents: ApiDocument[];
};

test.describe('체력증진비 귀속 월 집계 API (plan 80)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(120_000);

  const stamp = fitnessMonthStamp();
  const numbers = {
    ac02: `E2E-FM-AGG-AC02-${stamp}`,
    ac10: `E2E-FM-AGG-AC10-${stamp}`,
    ac11: `E2E-FM-AGG-AC11-${stamp}`,
    ac12: `E2E-FM-AGG-AC12-${stamp}`,
    ac13: `E2E-FM-AGG-AC13-${stamp}`
  };
  const amounts = { ac02: 11_000, ac10: 7_000, ac11: 13_000, ac12: 17_000, ac13: 19_000 };
  const expectedOctoberTotal = amounts.ac02 + amounts.ac10 + amounts.ac11;
  let userId = '';

  async function getAdminMember(request: APIRequestContext, month: string) {
    const response = await request.get(`/api/benefits?month=${month}&affiliation=wake`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data: { month: string; members: AdminMember[] };
    };
    return { month: body.data.month, member: body.data.members.find((m) => m.user_id === userId) };
  }

  async function getMyBenefits(request: APIRequestContext, month: string) {
    const response = await request.get(`/api/my-benefits?month=${month}&user=${userId}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data: { month: string; total_used: number; documents: ApiDocument[] };
    };
    return body.data;
  }

  test.beforeAll(async ({ request }) => {
    const person = await createOrgChartTestUser('benefit-fm-agg', {
      fullName: `E2E FM Agg ${stamp}`,
      affiliation: 'wake',
      rank: '마케팅팀',
      position_level: '과장'
    });
    userId = person.userId;

    const imports = [
      { documentNumber: numbers.ac02, createdAt: '2026-10-14', month: '10월', amount: amounts.ac02 },
      { documentNumber: numbers.ac11, createdAt: '2026-11-02', month: '10', amount: amounts.ac11 },
      { documentNumber: numbers.ac12, createdAt: '2026-10-30', month: '11', amount: amounts.ac12 },
      { documentNumber: numbers.ac13, createdAt: '2026-10-14', month: '9', amount: amounts.ac13 }
    ];
    for (const item of imports) {
      const response = await postBenefitImport(
        request,
        buildFitnessMonthPayload({
          documentNumber: item.documentNumber,
          applicantName: person.fullName,
          documentCreatedAt: item.createdAt,
          benefitMonth: item.month,
          amount: item.amount
        })
      );
      expect(response.status(), item.documentNumber).toBe(201);
    }

    await insertBenefitDocumentForE2e({
      applicantUserId: person.userId,
      applicantName: person.fullName,
      documentNumber: numbers.ac10,
      taskKey: `e2e-fm-agg-ac10-${stamp}`,
      documentCreatedAt: '2026-10-05',
      amount: amounts.ac10,
      benefitType: 'fitness'
    });
  });

  test.afterAll(async () => {
    for (const documentNumber of Object.values(numbers)) {
      await deleteBenefitDocumentByNumber(documentNumber);
    }
  });

  test('AC-02: admin·내 복지비 10월 응답에 문서 포함 · 합계 반영', async ({ request }) => {
    const { member } = await getAdminMember(request, '2026-10');
    expect(member).toBeTruthy();
    const numbersInAdmin = member!.documents.map((doc) => doc.document_number);
    expect(numbersInAdmin).toContain(numbers.ac02);
    expect(member!.category_totals.fitness).toBe(expectedOctoberTotal);
    expect(member!.total_used).toBe(expectedOctoberTotal);

    const mine = await getMyBenefits(request, '2026-10');
    expect(mine.documents.map((doc) => doc.document_number)).toContain(numbers.ac02);
    expect(mine.total_used).toBe(expectedOctoberTotal);
  });

  test('AC-10: 기존형 fitness(benefit_month null) → 작성일 월 귀속 · 합계 반영', async ({
    request
  }) => {
    const { member } = await getAdminMember(request, '2026-10');
    const doc = member?.documents.find((item) => item.document_number === numbers.ac10);
    expect(doc).toBeTruthy();
    expect(doc?.benefit_month).toBeNull();
    expect(doc?.attributed_month).toBe('2026-10-01');
    expect(member!.total_used).toBe(expectedOctoberTotal);
  });

  test('AC-11: 작성 11월 · 해당 월 10 → 10월 집계 포함', async ({ request }) => {
    const { member } = await getAdminMember(request, '2026-10');
    const doc = member?.documents.find((item) => item.document_number === numbers.ac11);
    expect(doc?.attributed_month).toBe('2026-10-01');
    expect(member!.total_used).toBe(expectedOctoberTotal);

    const mine = await getMyBenefits(request, '2026-10');
    expect(mine.documents.map((item) => item.document_number)).toContain(numbers.ac11);
    expect(mine.total_used).toBe(expectedOctoberTotal);
  });

  test('AC-12: 작성 10월 · 해당 월 11 → 10월 미포함 · 합계 불포함', async ({ request }) => {
    const { member } = await getAdminMember(request, '2026-10');
    expect(member?.documents.map((item) => item.document_number)).not.toContain(numbers.ac12);
    expect(member!.total_used).toBe(expectedOctoberTotal);
  });

  test('AC-13: 해당 월 9 → 하한 2026-10 유지 · 9월/10월 모두 미노출', async ({ request }) => {
    const current = currentKstMonthForE2e();

    const october = await getAdminMember(request, '2026-10');
    expect(october.month).toBe(current);
    expect(october.member?.documents.map((item) => item.document_number)).not.toContain(
      numbers.ac13
    );

    const september = await getAdminMember(request, '2026-09');
    expect(september.month).toBe(current);
    expect(september.member?.documents.map((item) => item.document_number)).not.toContain(
      numbers.ac13
    );

    const mineSeptember = await getMyBenefits(request, '2026-09');
    expect(mineSeptember.month).toBe(current);
    expect(mineSeptember.documents.map((item) => item.document_number)).not.toContain(
      numbers.ac13
    );
  });
});
