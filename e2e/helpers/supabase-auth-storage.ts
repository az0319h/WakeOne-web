import fs from 'node:fs';
import path from 'node:path';
import {
  request as playwrightRequest,
  type APIRequestContext,
  type BrowserContext
} from '@playwright/test';
import { e2eBaseURL, normalizePlaywrightStorageState } from './auth-request';


const REUSE_BUFFER_SECONDS = 120;
const REUSE_MAX_AGE_MS = 20 * 60 * 1000;
const DEFAULT_AUTH_PROBE_PATH = '/api/notifications?limit=1';

function readAuthCookieExpires(outputPath: string): number | null {
  if (!fs.existsSync(outputPath)) {
    return null;
  }

  try {
    const state = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as {
      cookies?: Array<{ name: string; expires?: number }>;
    };
    const authCookie = state.cookies?.find(
      (cookie) =>
        cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
    );
    return authCookie?.expires ?? null;
  } catch {
    return null;
  }
}

function isStorageStateFresh(outputPath: string) {
  if (!fs.existsSync(outputPath)) {
    return false;
  }

  const expires = readAuthCookieExpires(outputPath);
  if (!expires) {
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (expires <= nowSec + REUSE_BUFFER_SECONDS) {
    return false;
  }

  const { mtimeMs } = fs.statSync(outputPath);
  return Date.now() - mtimeMs < REUSE_MAX_AGE_MS;
}

async function probeAuthenticatedStorageState(
  outputPath: string,
  baseURL: string,
  probePath: string
) {
  const probe = await playwrightRequest.newContext({
    baseURL,
    storageState: outputPath
  });

  try {
    const response = await probe.get(probePath);
    return response.status() === 200;
  } finally {
    await probe.dispose();
  }
}

async function canReuseStorageState(
  outputPath: string,
  baseURL: string,
  probePath: string
) {
  if (!isStorageStateFresh(outputPath)) {
    return false;
  }

  return probeAuthenticatedStorageState(outputPath, baseURL, probePath);
}

function writeStorageState(
  outputPath: string,
  storageState: Awaited<ReturnType<APIRequestContext['storageState']>>,
  baseURL: string
) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const normalized = normalizePlaywrightStorageState(storageState, baseURL);
  fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2));
}

export async function persistRequestStorageState(
  apiContext: APIRequestContext,
  outputPath: string
) {
  const storageState = await apiContext.storageState();
  writeStorageState(outputPath, storageState, e2eBaseURL);
}

export async function authenticateStorageState(
  _context: BrowserContext,
  email: string,
  password: string,
  outputPath: string,
  probePath = DEFAULT_AUTH_PROBE_PATH
) {
  const baseURL = e2eBaseURL;

  if (await canReuseStorageState(outputPath, baseURL, probePath)) {
    return;
  }

  const apiContext = await playwrightRequest.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] }
  });

  try {
    let signedIn = false;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const signInResponse = await apiContext.post('/api/auth/sign-in', {
        data: { email, password }
      });

      if (signInResponse.status() === 200) {
        const body = (await signInResponse.json()) as { mustChange?: boolean };
        if (body.mustChange) {
          throw new Error(`E2E account ${email} must change password before setup`);
        }
        signedIn = true;
        break;
      }

      const bodyText = await signInResponse.text();
      const retryable =
        signInResponse.status() === 429 ||
        /rate limit|too many|잠시 후 다시 시도/i.test(bodyText);

      if (!retryable || attempt === 7) {
        throw new Error(`sign-in failed (${signInResponse.status()}): ${bodyText}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
    }

    if (!signedIn) {
      throw new Error(`Failed to sign in as ${email}`);
    }

    const storageState = await apiContext.storageState();
    writeStorageState(outputPath, storageState, baseURL);

    if (!(await probeAuthenticatedStorageState(outputPath, baseURL, probePath))) {
      throw new Error(`auth storage probe failed for ${email}`);
    }
  } finally {
    await apiContext.dispose();
  }
}
