import { test as setup } from '@playwright/test';
import { resolveE2EPassword } from './helpers/e2e-credentials';
import { authenticateStorageState } from './helpers/supabase-auth-storage';

const user2AuthFile = 'e2e/.auth/user2.json';

setup('authenticate as user2', async ({ context }) => {
  const email = process.env.E2E_USER2_EMAIL;
  const password = resolveE2EPassword(process.env.E2E_USER2_PASSWORD);

  if (!email || !process.env.E2E_USER2_PASSWORD) {
    throw new Error(
      'E2E_USER2_EMAIL and E2E_USER2_PASSWORD must be set before running E2E tests.'
    );
  }

  await authenticateStorageState(context, email, password, user2AuthFile);
});
