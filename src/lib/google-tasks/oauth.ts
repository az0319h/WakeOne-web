import 'server-only';

import { decryptRefreshTokenMaybeMock } from './encrypt';

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export async function fetchGoogleAccessToken(encryptedRefreshToken: string): Promise<string> {
  if (process.env.E2E_GOOGLE_TASKS_MOCK === '1') {
    return 'mock-access-token';
  }

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

  return json.access_token;
}
