import { test as setup } from '@playwright/test';
import { authenticateStorageState } from './helpers/supabase-auth-storage';

const adminAuthFile = 'e2e/.auth/admin.json';

setup('authenticate as admin', async ({ context }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set before running E2E tests.'
    );
  }

  await authenticateStorageState(context, email, password, adminAuthFile);
});
