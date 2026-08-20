import { test as setup } from '@playwright/test';
import { resolveE2EPassword } from './helpers/e2e-credentials';
import { authenticateStorageState } from './helpers/supabase-auth-storage';

const userAuthFile = 'e2e/.auth/user.json';

setup('authenticate as user', async ({ context }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = resolveE2EPassword(process.env.E2E_USER_PASSWORD);

  if (!email || !process.env.E2E_USER_PASSWORD) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set before running E2E tests.'
    );
  }

  await authenticateStorageState(context, email, password, userAuthFile);
});
