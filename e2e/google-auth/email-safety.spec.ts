import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const AUTH_MIGRATION_PATHS = [
  'src/app/api/auth/google/callback/route.ts',
  'src/app/api/users/[id]/approval/approve/route.ts',
  'src/app/api/users/[id]/approval/reject/route.ts',
  'src/features/auth/components/user-auth-form.tsx',
  'src/features/users/components/users-table/cell-action.tsx',
  'src/features/users/components/user-approval-sheet.tsx'
];

const MAIL_PATTERNS = [
  /\bsendMail\b/i,
  /\bnodemailer\b/i,
  /\bcreateTransport\b/i,
  /\bresend\b/i,
  /\bsmtp\b/i,
  /\bsendEmail\b/i,
  /\btransporter\.send/i
];

test.describe('Google auth email safety grep', () => {
  test('AC-20: auth migration 경로에 mail send/SMTP 호출이 없다', () => {
    for (const relativePath of AUTH_MIGRATION_PATHS) {
      const absolutePath = path.join(process.cwd(), relativePath);
      expect(fs.existsSync(absolutePath), `${relativePath} must exist`).toBe(true);

      const source = fs.readFileSync(absolutePath, 'utf8');
      for (const pattern of MAIL_PATTERNS) {
        expect(source, `${relativePath} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test('AC-21 grep: forgot/force password route helper에 이메일 발송 호출이 없다', () => {
    const routePaths = [
      'src/app/api/auth/forgot-password/request/route.ts',
      'src/app/api/auth/forgot-password/verify/route.ts',
      'src/app/api/auth/force-password-change/route.ts'
    ];

    for (const relativePath of routePaths) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      for (const pattern of MAIL_PATTERNS) {
        expect(source, `${relativePath} must not match ${pattern}`).not.toMatch(pattern);
      }
      expect(source).toMatch(/410|종료/);
    }
  });
});
