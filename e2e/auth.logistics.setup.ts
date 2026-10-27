import fs from 'node:fs';
import { test as setup } from '@playwright/test';
import { authenticateStorageState } from './helpers/supabase-auth-storage';
import { createOrgChartTestUser, uniqueOrgChartEmail } from './helpers/org-chart';

/** plan 89 — 구매물류팀(wake · rank='구매물류팀') 일회용 계정 (전체 조회 전용) */
const authFile = 'e2e/.auth/logistics.json';
const metaFile = 'e2e/.auth/logistics.meta.json';
const PASSWORD = 'E2eLogistics9!';

setup('authenticate as wake 구매물류팀 user', async ({ context }) => {
  const email = uniqueOrgChartEmail('logistics');
  const fullName = `E2E 구매물류 ${Date.now()}`;
  const created = await createOrgChartTestUser('logistics', {
    email,
    password: PASSWORD,
    affiliation: 'wake',
    rank: '구매물류팀',
    position_level: '대리',
    fullName
  });

  fs.rmSync(authFile, { force: true });
  await authenticateStorageState(context, email, PASSWORD, authFile);
  fs.writeFileSync(
    metaFile,
    JSON.stringify({ userId: created.userId, email, password: PASSWORD, fullName }, null, 2)
  );
});
