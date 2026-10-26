import fs from 'node:fs';
import { test as setup } from '@playwright/test';
import { authenticateStorageState } from './helpers/supabase-auth-storage';
import { createOrgChartTestUser, uniqueOrgChartEmail } from './helpers/org-chart';

/**
 * plan 89 — 동방특송(affiliation='dongbang') 일회용 계정.
 * example.com 이메일 + `E2E ` 이름 → teardown `cleanup_e2e_mock_data`가 삭제한다
 * (퀵 요청은 scripts/cleanup-e2e-mock-data.mjs가 RPC 전에 먼저 지운다).
 */
const authFile = 'e2e/.auth/dongbang.json';
const metaFile = 'e2e/.auth/dongbang.meta.json';
const PASSWORD = 'E2eDongbang9!';

setup('authenticate as 동방특송 user', async ({ context }) => {
  const email = uniqueOrgChartEmail('dongbang');
  const fullName = `E2E 동방특송 ${Date.now()}`;
  const created = await createOrgChartTestUser('dongbang', {
    email,
    password: PASSWORD,
    affiliation: 'dongbang',
    rank: null,
    position_level: null,
    leader_role: null,
    birthday: null,
    phone: '01055550001',
    fullName
  });

  fs.rmSync(authFile, { force: true });
  await authenticateStorageState(context, email, PASSWORD, authFile);
  fs.writeFileSync(
    metaFile,
    JSON.stringify({ userId: created.userId, email, password: PASSWORD, fullName }, null, 2)
  );
});
