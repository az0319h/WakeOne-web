import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'));

const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
  '127.0.0.1',
  'localhost'
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/
    },
    {
      name: 'setup-user',
      testMatch: /auth\.user\.setup\.ts/
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /auth\.user\.setup\.ts/, /\.api\.spec\.ts$/, /rbac\.spec\.ts$/, /profile\.spec\.ts$/]
    },
    {
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup-user'],
      testMatch: [
        /rbac\.spec\.ts$/,
        /profile\.spec\.ts$/,
        /system-email-logs-rbac\.spec\.ts$/
      ]
    },
    {
      name: 'api',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup', 'setup-user'],
      testMatch: /\.api\.spec\.ts$/
    }
  ]
});
