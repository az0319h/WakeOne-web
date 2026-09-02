import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Windows: `localhost` may resolve to ::1 while Next dev binds IPv4 only — prefer IPv4 without breaking cookie domain.
dns.setDefaultResultOrder('ipv4first');

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

const isNotificationsE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/notifications')
);

const isAnnouncementsE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/announcements')
);

const isContractImportNotificationsE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/contract-import-notifications')
);

const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
  '127.0.0.1',
  'localhost'
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: isNotificationsE2eRun || isAnnouncementsE2eRun || isContractImportNotificationsE2eRun ? 1 : undefined,
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
      dependencies: ['setup', 'setup-user'],
      testIgnore: [
        /auth\.setup\.ts/,
        /auth\.user\.setup\.ts/,
        /\.api\.spec\.ts$/,
        /rbac\.spec\.ts$/,
        /profile\.spec\.ts$/,
        /^notifications\//,
        /contract-import-notifications[\\/]/,
        /announcements\//,
        /profile-name-live-display\//,
        /kbar\/nav-user\.spec\.ts$/,
        /contracts\/my-contracts-viewer\.spec\.ts$/
      ]
    },
    {
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup-user'],
      testMatch: [
        /profile\.spec\.ts$/,
        /system-email-logs-rbac\.spec\.ts$/,
        /kbar\/nav-user\.spec\.ts$/,
        /contracts\/my-contracts-viewer\.spec\.ts$/
      ]
    },
    {
      name: 'chromium-announcements-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup-user', 'setup', 'chromium-announcements'],
      testMatch: [
        /announcements\/rbac\.spec\.ts$/,
        /announcements\/list-detail-dialog\.spec\.ts$/,
        /announcements\/list-infinite-scroll\.spec\.ts$/,
        /announcements\/notify-fanout\.spec\.ts$/
      ],
      fullyParallel: false
    },
    {
      name: 'chromium-announcements',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup'],
      testMatch: [/announcements\/.*\.spec\.ts$/],
      testIgnore: [
        /\.api\.spec\.ts$/,
        /announcements\/rbac\.spec\.ts$/,
        /announcements\/list-detail-dialog\.spec\.ts$/,
        /announcements\/list-infinite-scroll\.spec\.ts$/,
        /announcements\/notify-fanout\.spec\.ts$/
      ],
      fullyParallel: false
    },
    {
      name: 'chromium-contract-import-notifications',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup', 'setup-user'],
      testMatch: [/contract-import-notifications[\\/].*\.spec\.ts$/],
      testIgnore: [/\.api\.spec\.ts$/],
      fullyParallel: false
    },
    {
      name: 'chromium-notifications',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup', 'setup-user'],
      testMatch: [/^notifications\/.*\.spec\.ts$/],
      fullyParallel: false
    },
    {
      name: 'chromium-profile-name-live-display-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup-user', 'setup'],
      testMatch: [
        /profile-name-live-display\/notifications-unchanged\.spec\.ts$/,
        /profile-name-live-display\/nav-user-refresh\.spec\.ts$/
      ],
      fullyParallel: false
    },
    {
      name: 'setup-admin-refresh',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['chromium-profile-name-live-display-user']
    },
    {
      name: 'chromium-profile-name-live-display-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup-admin-refresh'],
      testMatch: [
        /profile-name-live-display\/logs-live-name\.spec\.ts$/,
        /profile-name-live-display\/snapshots-unchanged\.spec\.ts$/,
        /profile-name-live-display\/live-display\.api\.spec\.ts$/
      ],
      fullyParallel: false
    },
    {
      name: 'api',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup', 'setup-user'],
      testMatch: /\.api\.spec\.ts$/,
      testIgnore: [/profile-name-live-display\//, /^notifications\//]
    }
  ]
});
