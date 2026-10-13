import { test as setup } from '@playwright/test';
import { authenticateStorageState } from './helpers/supabase-auth-storage';
import { createOrgChartTestUser, uniqueOrgChartEmail } from './helpers/org-chart';

const hrAuthFile = 'e2e/.auth/hr-benefits.json';
const HR_PASSWORD = 'E2eHrBenefits9!';

setup('authenticate as wake HR benefits manager', async ({ context }) => {
  const email = uniqueOrgChartEmail('hr-benefits');
  await createOrgChartTestUser('hr-benefits', {
    email,
    password: HR_PASSWORD,
    affiliation: 'wake',
    rank: '인사팀',
    position_level: '대리',
    fullName: `E2E HR Benefits ${Date.now()}`
  });

  await authenticateStorageState(context, email, HR_PASSWORD, hrAuthFile);
});
