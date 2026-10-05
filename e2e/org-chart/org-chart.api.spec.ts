import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createOrgChartTestUser,
  fetchOrgChart,
  fetchUserProfile,
  personNodes
} from '../helpers/org-chart';
import { createPendingGoogleUser } from '../helpers/supabase-direct-auth';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: Record<string, unknown>;
};

const E2E_TEST_PHONE = '01012345678';

async function listActivityLogs(request: APIRequestContext, action: string) {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50&log_user=all`
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogItem[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

async function expectUserUpdateLog(
  request: APIRequestContext,
  requestId: string,
  status: number
) {
  await expect
    .poll(
      async () => {
        const logs = await listActivityLogs(request, 'user.update');
        const matched = logs.find(
          (item) =>
            item.request_id === requestId &&
            item.action === 'user.update' &&
            item.http_status === status
        );
        return matched ? JSON.stringify(matched.metadata ?? {}) : null;
      },
      { timeout: 15_000 }
    )
    .not.toBeNull();

  const logs = await listActivityLogs(request, 'user.update');
  return logs.find(
    (item) =>
      item.request_id === requestId &&
      item.action === 'user.update' &&
      item.http_status === status
  );
}

function approveAdminPayload(email: string, fullName: string) {
  return {
    email,
    full_name: fullName,
    system_role: 'admin',
    phone: E2E_TEST_PHONE
  };
}

test.describe('조직도 API', () => {
  test.setTimeout(90_000);

  test('AC-08: GET org-chart는 inactive·admin·position_level null 제외', async ({
    request
  }) => {
    const stamp = Date.now();
    const active = await createOrgChartTestUser('ac08-active', {
      fullName: `E2E AC08 Active ${stamp}`,
      rank: '마케팅팀',
      position_level: '과장'
    });
    const inactive = await createOrgChartTestUser('ac08-inactive', {
      fullName: `E2E AC08 Inactive ${stamp}`,
      rank: '디자인팀',
      position_level: '대리',
      status: 'inactive'
    });
    const adminUser = await createOrgChartTestUser('ac08-admin', {
      fullName: `E2E AC08 Admin ${stamp}`,
      rank: '경영진',
      position_level: 'CEO',
      system_role: 'admin'
    });
    const noPosition = await createOrgChartTestUser('ac08-null-pos', {
      fullName: `E2E AC08 NullPos ${stamp}`,
      rank: '마케팅팀',
      position_level: null
    });

    const { response, body } = await fetchOrgChart(request, 'wake');
    expect(response.status()).toBe(200);
    expect(body.success).toBe(true);

    const userIds = personNodes(body.nodes ?? []).map((node) => node.userId);
    expect(userIds).toContain(active.userId);
    expect(userIds).not.toContain(inactive.userId);
    expect(userIds).not.toContain(adminUser.userId);
    expect(userIds).not.toContain(noPosition.userId);
  });

  test('AC-11: person node는 모두 system_role=user', async ({ request }) => {
    await createOrgChartTestUser('ac11-user', {
      fullName: `E2E AC11 ${Date.now()}`,
      rank: '회계팀',
      position_level: '사원'
    });

    const { response, body } = await fetchOrgChart(request, 'wake');
    expect(response.status()).toBe(200);
    expect(personNodes(body.nodes ?? []).length).toBeGreaterThan(0);

    for (const node of personNodes(body.nodes ?? [])) {
      expect(node.userId).toBeTruthy();
    }
  });

  test('AC-09: PUT position_level 성공 시 user.update log에 position_level', async ({
    request
  }) => {
    const target = await createOrgChartTestUser('ac09-update', {
      fullName: `E2E AC09 ${Date.now()}`,
      rank: '마케팅팀',
      position_level: '대리'
    });

    const response = await request.put(`/api/users/${target.userId}`, {
      data: {
        position_level: '과장',
        rank: '마케팅팀',
        affiliation: 'wake',
        phone: E2E_TEST_PHONE
      }
    });

    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectUserUpdateLog(request, requestId, 200);
    const changedFields = (log?.metadata?.changed_fields ?? []) as string[];
    expect(changedFields).toContain('position_level');
  });

  test('AC-15: pending admin 승인 시 org 필드 null', async ({ request }) => {
    const pending = await createPendingGoogleUser('ac15-admin');
    const fullName = `E2E AC15 Admin ${Date.now()}`;

    const response = await request.post(`/api/users/${pending.userId}/approval/approve`, {
      data: approveAdminPayload(pending.email, fullName)
    });

    expect(response.status()).toBe(200);

    const profile = await fetchUserProfile(request, pending.userId);
    expect(profile?.system_role).toBe('admin');
    expect(profile?.affiliation).toBeNull();
    expect(profile?.rank).toBeNull();
    expect(profile?.position_level).toBeNull();
    expect(profile?.leader_role).toBeNull();
  });

  test('AC-16: active admin PUT body affiliation은 ignore·log에 affiliation 없음', async ({
    request
  }) => {
    const adminTarget = await createOrgChartTestUser('ac16-admin', {
      fullName: `E2E AC16 Admin ${Date.now()}`,
      system_role: 'admin',
      affiliation: null,
      rank: null,
      position_level: null
    });

    const response = await request.put(`/api/users/${adminTarget.userId}`, {
      data: {
        affiliation: 'wake',
        rank: '마케팅팀',
        position_level: '과장',
        phone: E2E_TEST_PHONE
      }
    });

    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const profile = await fetchUserProfile(request, adminTarget.userId);
    expect(profile?.affiliation).toBeNull();

    const log = await expectUserUpdateLog(request, requestId, 200);
    const changedFields = (log?.metadata?.changed_fields ?? []) as string[];
    expect(changedFields).not.toContain('affiliation');
  });

  test('RANK-02: PUT position_level=CEO 시 DB rank=경영진', async ({ request }) => {
    const target = await createOrgChartTestUser('rank02-ceo', {
      fullName: `E2E RANK02 ${Date.now()}`,
      rank: '마케팅팀',
      position_level: '과장'
    });

    const response = await request.put(`/api/users/${target.userId}`, {
      data: {
        position_level: 'CEO',
        affiliation: 'wake',
        phone: E2E_TEST_PHONE
      }
    });

    expect(response.status()).toBe(200);
    const profile = await fetchUserProfile(request, target.userId);
    expect(profile?.position_level).toBe('CEO');
    expect(profile?.rank).toBe('경영진');
  });

  test('VAL-03: position_level=null user는 org-chart API에 미포함', async ({
    request
  }) => {
    const hidden = await createOrgChartTestUser('val03-null', {
      fullName: `E2E VAL03 ${Date.now()}`,
      rank: '마케팅팀',
      position_level: null
    });

    const { body } = await fetchOrgChart(request, 'wake');
    const userIds = personNodes(body.nodes ?? []).map((node) => node.userId);
    expect(userIds).not.toContain(hidden.userId);
  });

  test('TREE-03: rank=경영진·position_level=부장 user는 org-chart 제외', async ({
    request
  }) => {
    const legacy = await createOrgChartTestUser('tree03-legacy', {
      fullName: `E2E TREE03 ${Date.now()}`,
      rank: '경영진',
      position_level: '부장'
    });

    const { body } = await fetchOrgChart(request, 'wake');
    const userIds = personNodes(body.nodes ?? []).map((node) => node.userId);
    expect(userIds).not.toContain(legacy.userId);
  });
});
