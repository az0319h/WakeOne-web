import fs from 'node:fs';
import type { APIRequestContext, BrowserContextOptions } from '@playwright/test';

type PlaywrightWorker = Pick<typeof import('@playwright/test'), 'request'>;

type StorageStateObject = Exclude<
  NonNullable<BrowserContextOptions['storageState']>,
  string
>;

const ADMIN_STORAGE = 'e2e/.auth/admin.json';
const USER_STORAGE = 'e2e/.auth/user.json';
/** Match playwright.config baseURL — cookies are scoped to `localhost` (see supabase-auth-storage). */
export const e2eBaseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
  '127.0.0.1',
  'localhost'
);

export function normalizePlaywrightStorageState(
  raw: {
    cookies?: StorageStateObject['cookies'];
    origins?: StorageStateObject['origins'];
  },
  baseURL = e2eBaseURL
): StorageStateObject {
  const cookies = (raw.cookies ?? []).map((cookie) => {
    const c = cookie as StorageStateObject['cookies'][number] & {
      url?: string;
      domain?: string;
    };

    if (typeof c.domain === 'string' && c.domain.length > 0) {
      const { url: _url, ...rest } = c;
      return rest;
    }

    const { domain: _domain, ...rest } = c;
    return { ...rest, url: c.url ?? baseURL };
  }) as StorageStateObject['cookies'];

  return {
    cookies,
    origins: raw.origins ?? []
  };
}

export function readNormalizedStorageState(
  storageStatePath: string
): StorageStateObject {
  if (!fs.existsSync(storageStatePath)) {
    return { cookies: [], origins: [] };
  }

  const raw = JSON.parse(fs.readFileSync(storageStatePath, 'utf8')) as {
    cookies?: StorageStateObject['cookies'];
    origins?: StorageStateObject['origins'];
  };

  return normalizePlaywrightStorageState(raw);
}

export async function createAdminRequest(
  playwright: PlaywrightWorker
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    storageState: readNormalizedStorageState(ADMIN_STORAGE),
    baseURL: e2eBaseURL
  });
}

export async function createUserRequest(
  playwright: PlaywrightWorker
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    storageState: readNormalizedStorageState(USER_STORAGE),
    baseURL: e2eBaseURL
  });
}
