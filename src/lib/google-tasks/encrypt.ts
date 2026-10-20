import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

function getEncryptionKey(): Buffer {
  const raw = process.env.GOOGLE_TASKS_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('GOOGLE_TASKS_TOKEN_ENCRYPTION_KEY is not configured.');
  }

  if (/^[A-Za-z0-9+/]+=*$/.test(raw) && raw.length >= 32) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length >= 32) {
      return buf.subarray(0, 32);
    }
  }

  return scryptSync(raw, 'wakeone-google-tasks', 32);
}

export function encryptRefreshToken(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(
    ':'
  );
}

export function decryptRefreshToken(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted refresh token format.');
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

export function encryptRefreshTokenForMock(plain: string): string {
  if (process.env.E2E_GOOGLE_TASKS_MOCK === '1') {
    return `mock:${plain}`;
  }
  return encryptRefreshToken(plain);
}

export function decryptRefreshTokenMaybeMock(payload: string): string {
  if (payload.startsWith('mock:')) {
    return payload.slice('mock:'.length);
  }
  return decryptRefreshToken(payload);
}
