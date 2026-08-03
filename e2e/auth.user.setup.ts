import { test as setup } from '@playwright/test';
import { authenticateStorageState } from './helpers/supabase-auth-storage';

const userAuthFile = 'e2e/.auth/user.json';

setup('authenticate as user', async ({ context }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set before running E2E tests.'
    );
  }

  await authenticateStorageState(context, email, password, userAuthFile);
});
