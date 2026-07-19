import type { APIRequestContext } from '@playwright/test';

type PlaywrightWorker = {
  request: {
    newContext: (options: {
      storageState: string;
      baseURL: string;
    }) => Promise<APIRequestContext>;
  };
};

const ADMIN_STORAGE = 'e2e/.auth/admin.json';
const USER_STORAGE = 'e2e/.auth/user.json';
export const e2eBaseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export async function createAdminRequest(
  playwright: PlaywrightWorker
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    storageState: ADMIN_STORAGE,
    baseURL: e2eBaseURL
  });
}

export async function createUserRequest(
  playwright: PlaywrightWorker
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    storageState: USER_STORAGE,
    baseURL: e2eBaseURL
  });
}
