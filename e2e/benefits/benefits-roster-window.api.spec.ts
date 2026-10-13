import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  getProfileEmploymentSnapshot,
  getProfileForBenefitsFixture,
  setProfileEmploymentForE2e
} from '../helpers/benefits-fixture';
import { currentKstMonthForE2e } from '../helpers/kst-month';

function readUserIdFromStorage(storagePath: string): string {
  const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), storagePath), 'utf8'));
  const authCookie = (state.cookies as Array<{ name: string; value: string }>).find(
    (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );
  if (!authCookie?.value) {
    throw new Error(`Missing auth cookie in ${storagePath}`);
  }
  const decoded = decodeURIComponent(authCookie.value);
  const session = JSON.parse(
    decoded.startsWith('base64-') ? Buffer.from(decoded.slice(7), 'base64').toString('utf8') : decoded
  ) as { user?: { id?: string } };
  const userId = session.user?.id;
  if (!userId) throw new Error(`Could not parse user id from ${storagePath}`);
  return userId;
}

function memberIds(body: { data?: { members?: Array<{ user_id: string }> } }): string[] {
  return (body.data?.members ?? []).map((member) => member.user_id);
}

test.describe('복지비 관리 명단 재직 윈도우 API', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.describe.configure({ mode: 'serial' });

  const subjectUserId = readUserIdFromStorage('e2e/.auth/user2.json');
  let snapshot: Awaited<ReturnType<typeof getProfileEmploymentSnapshot>>;
  let subjectAffiliation = 'wake';
  const viewMonth = currentKstMonthForE2e();

  test.beforeAll(async () => {
    const profile = await getProfileForBenefitsFixture(subjectUserId);
    subjectAffiliation = profile.affiliation;
    snapshot = await getProfileEmploymentSnapshot(subjectUserId);
  });

  test.afterAll(async () => {
    await setProfileEmploymentForE2e(subjectUserId, snapshot);
  });

  test('AC-07: 입사 월이 조회 월보다 뒤면 명단 제외', async ({ request }) => {
    await setProfileEmploymentForE2e(subjectUserId, {
      ...snapshot,
      created_at: '2099-01-01T00:00:00+09:00',
      status: 'active',
      deactivated_at: null,
      position_level: '과장',
      rank: 'E2E복지팀'
    });

    const response = await request.get(
      `/api/benefits?month=${viewMonth}&affiliation=${subjectAffiliation}`
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.month).toBe(viewMonth);
    expect(memberIds(body)).not.toContain(subjectUserId);
  });

  test('AC-08·09: 재직·퇴사 월(in-range) 명단', async ({ request }) => {
    await setProfileEmploymentForE2e(subjectUserId, {
      ...snapshot,
      created_at: `${viewMonth}-01T00:00:00+09:00`,
      status: 'inactive',
      deactivated_at: `${viewMonth}-28T12:00:00+09:00`,
      position_level: '과장',
      rank: 'E2E복지팀'
    });

    const inMonth = await request.get(
      `/api/benefits?month=${viewMonth}&affiliation=${subjectAffiliation}`
    );
    const inBody = await inMonth.json();
    expect(memberIds(inBody)).toContain(subjectUserId);
    const member = (inBody.data?.members ?? []).find(
      (row: { user_id: string }) => row.user_id === subjectUserId
    );
    expect(member?.is_inactive_profile).toBe(true);
  });

  test('AC-10: 퇴사 월이 조회 월보다 이전이면 제외', async ({ request }) => {
    await setProfileEmploymentForE2e(subjectUserId, {
      ...snapshot,
      created_at: '2026-09-01T00:00:00+09:00',
      status: 'inactive',
      deactivated_at: '2026-09-28T12:00:00+09:00',
      position_level: '과장',
      rank: 'E2E복지팀'
    });

    const response = await request.get(
      `/api/benefits?month=${viewMonth}&affiliation=${subjectAffiliation}`
    );
    const body = await response.json();
    expect(memberIds(body)).not.toContain(subjectUserId);
  });

  test('AC-11: 빈 month는 당월', async ({ request }) => {
    const response = await request.get(`/api/benefits?month=&affiliation=${subjectAffiliation}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.month).toBe(viewMonth);
  });
});
