import 'server-only';

import { decryptRefreshTokenMaybeMock } from './encrypt';

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

type CachedAccessToken = {
  token: string;
  expiresAt: number;
};

/** Refresh a little early so a cached token never expires mid-request. */
const ACCESS_TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** Per-instance cache keyed by the stored (encrypted) refresh token. */
const accessTokenCache = new Map<string, CachedAccessToken>();
const pendingAccessTokens = new Map<string, Promise<string>>();

function pruneExpiredAccessTokens(now: number) {
  for (const [key, cached] of accessTokenCache) {
    if (cached.expiresAt <= now) {
      accessTokenCache.delete(key);
    }
  }
}

/** Drop a cached token (e.g. after Google answers 401) so the next call refreshes. */
export function invalidateGoogleAccessToken(encryptedRefreshToken: string) {
  accessTokenCache.delete(encryptedRefreshToken);
}

export async function fetchGoogleAccessToken(encryptedRefreshToken: string): Promise<string> {
  if (process.env.E2E_GOOGLE_TASKS_MOCK === '1') {
    return 'mock-access-token';
  }

  const cached = accessTokenCache.get(encryptedRefreshToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const pending = pendingAccessTokens.get(encryptedRefreshToken);
  if (pending) {
    return pending;
  }

  const request = requestGoogleAccessToken(encryptedRefreshToken).finally(() => {
    pendingAccessTokens.delete(encryptedRefreshToken);
  });
  pendingAccessTokens.set(encryptedRefreshToken, request);
  return request;
}

async function requestGoogleAccessToken(encryptedRefreshToken: string): Promise<string> {
  const refreshToken = decryptRefreshTokenMaybeMock(encryptedRefreshToken);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID/SECRET is not configured.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const json = (await response.json()) as TokenResponse & { error?: string; error_description?: string };

  if (!response.ok || !json.access_token) {
    const message = json.error_description ?? json.error ?? 'Google token refresh failed.';
    throw new Error(message);
  }

  const now = Date.now();
  const expiresAt = now + json.expires_in * 1000 - ACCESS_TOKEN_EXPIRY_MARGIN_MS;
  if (expiresAt > now) {
    pruneExpiredAccessTokens(now);
    accessTokenCache.set(encryptedRefreshToken, { token: json.access_token, expiresAt });
  }

  return json.access_token;
}
