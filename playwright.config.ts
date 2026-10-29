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

const isLiveUsersE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/live-users')
);

const isWalletBalanceEmailE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/wallet-balance-email')
);

const isGoogleTasksE2eRun = process.argv.some((arg) => {
  const normalized = arg.replace(/\\/g, '/');
  return (
    normalized.includes('e2e/google-tasks') ||
    normalized.includes('e2e/kanban') ||
    normalized.includes('google-tasks-activity-log')
  );
});

const isGoogleAuthPendingNotifE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('pending-admin-notifications')
);

const isDevProvisionE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('dev-provision')
);

const isAttachmentsE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/attachments')
);

const isQuickRequestE2eRun = process.argv.some((arg) => {
  const normalized = arg.replace(/\\/g, '/');
  // plan 89·92 — 퀵 업무 흐름(e2e/quick-workflow)도 같은 env(지연 page)로 직렬 실행. 외부 mock 서버 없음
  return (
    normalized.includes('e2e/quick-request') ||
    normalized.includes('e2e/quick-workflow') ||
    normalized.includes('e2e/quick-info') ||
    // plan 93 — 퀵 대화(e2e/quick-chat): 2 context 실시간·계정 공유 → 직렬
    normalized.includes('e2e/quick-chat') ||
    // plan 94 — 퀵 2차(e2e/quick-round2): Broadcast 실시간·WebSocket 차단·계정 공유 → 직렬
    normalized.includes('e2e/quick-round2')
  );
});

/** plan 92 AC-27 — 가드 parity(dev): user.json·dongbang.json 둘 다 필요해 별도 project로 돌린다 */
const isGuardParityE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/auth')
);

const isWorkflowE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/workflow')
);

/** plan 91 — 휴대폰 웹 푸시: mock 전송기(E2E_WEB_PUSH_MOCK=1) · user.json 직렬 */
const isPushE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/push-notifications')
);

if (isPushE2eRun) {
  process.env.E2E_WEB_PUSH_MOCK = '1';
}

/** plan 103 — 구독·비품 대장: 전용 계정 4명 + 공유 fixture(요청 배지·건수) → 직렬 · 푸시 mock */
const isAssetLedgerE2eRun = process.argv.some((arg) =>
  arg.replace(/\\/g, '/').includes('e2e/subscription-equipment')
);

if (isAssetLedgerE2eRun) {
  process.env.E2E_WEB_PUSH_MOCK = '1';
}

if (isDevProvisionE2eRun) {
  process.env.WAKEONE_ENV = 'development';
  process.env.NEXT_PUBLIC_WAKEONE_ENV = 'development';
}

if (isGoogleTasksE2eRun) {
  process.env.E2E_GOOGLE_TASKS_MOCK = '1';
}

if (isQuickRequestE2eRun) {
  process.env.E2E_SLOW_QUICK_REQUEST = '1';
}

const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
  '127.0.0.1',
  'localhost'
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers:
    isNotificationsE2eRun ||
    isAnnouncementsE2eRun ||
    isContractImportNotificationsE2eRun ||
    isLiveUsersE2eRun ||
    isWalletBalanceEmailE2eRun ||
    isGoogleTasksE2eRun ||
    isGoogleAuthPendingNotifE2eRun ||
    isDevProvisionE2eRun ||
    isAttachmentsE2eRun || isQuickRequestE2eRun || isWorkflowE2eRun || isPushE2eRun ||
    isAssetLedgerE2eRun
      ? 1
      : undefined,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !isGoogleTasksE2eRun && !isDevProvisionE2eRun,
          timeout: 120_000,
          env: {
            ...process.env,
            NEXT_PUBLIC_DISABLE_RQ_DEVTOOLS: '1',
            ...(isGoogleTasksE2eRun ? { E2E_GOOGLE_TASKS_MOCK: '1' } : {}),
            ...(isPushE2eRun ? { E2E_WEB_PUSH_MOCK: '1' } : {}),
            ...(isQuickRequestE2eRun ? { E2E_SLOW_QUICK_REQUEST: '1' } : {}),
            // plan 99 — e2e는 외부 장소 검색(카카오)을 실제로 부르지 않는다: fixture(e2e/fixtures/kakao-places.json) mock.
            // 미설정 AC-10은 E2E_KAKAO_PLACES_UNCONFIGURED=1을 같이 넘긴다(MOCK보다 우선 · ...process.env).
            // reuseExistingServer라 이미 떠 있는 dev 서버에는 적용되지 않는다 → 직접 띄울 때도 같은 env로 띄울 것
            E2E_KAKAO_PLACES_MOCK: process.env.E2E_KAKAO_PLACES_MOCK ?? '1',
            ...(isDevProvisionE2eRun
              ? {
                  WAKEONE_ENV: 'development',
                  NEXT_PUBLIC_WAKEONE_ENV: 'development'
                }
              : {})
          }
        }
      }),
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      timeout: 90_000
    },
    {
      name: 'setup-user',
      testMatch: /auth\.user\.setup\.ts/,
      timeout: 90_000
    },
    {
      name: 'setup-user2',
      testMatch: /auth\.user2\.setup\.ts/,
      timeout: 90_000
    },
    {
      name: 'setup-hr-benefits',
      testMatch: /auth\.hr-benefits\.setup\.ts/,
      timeout: 90_000
    },
    {
      // plan 89 — 동방특송 일회용 계정 (e2e/.auth/dongbang.json)
      name: 'setup-dongbang',
      testMatch: /auth\.dongbang\.setup\.ts/,
      timeout: 90_000
    },
    {
      // plan 89 — 구매물류팀 일회용 계정 (e2e/.auth/logistics.json)
      name: 'setup-logistics',
      testMatch: /auth\.logistics\.setup\.ts/,
      timeout: 90_000
    },
    {
      // plan 103 — 구독·비품 전용 일회용 계정 4명 (회계팀 · 디자인팀 A·B · 마케팅팀 C)
      name: 'setup-asset-ledger',
      testMatch: /auth\.asset-ledger\.setup\.ts/,
      timeout: 120_000
    },
    {
      // plan 103 — 구독·비품 대장 · 요청 · 댓글 · 알림: admin·hr·회계·직원 3·동방 storageState + 2 context → 직렬
      name: 'chromium-asset-ledger',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/asset-staff.json'
      },
      dependencies: ['setup', 'setup-hr-benefits', 'setup-dongbang', 'setup-asset-ledger'],
      testMatch: [/subscription-equipment[\\/].*\.spec\.ts$/],
      fullyParallel: false,
      timeout: 150_000
    },
    {
      name: 'wallet-balance-email-api',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup', 'setup-user'],
      testMatch: isWalletBalanceEmailE2eRun
        ? [
            /wallet-balance-email\/56-slot-copy\.api\.spec\.ts$/,
            /wallet-balance-email\/00-due-zero\.api\.spec\.ts$/,
            /wallet-balance-email\/00-plan55\.api\.spec\.ts$/,
            /wallet-balance-email\/dispatch\.api\.spec\.ts$/
          ]
        : [/^\b$/],
      fullyParallel: false
    },
    {
      name: 'wallet-balance-email-notifications',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup', 'setup-user', 'wallet-balance-email-api'],
      testMatch: isWalletBalanceEmailE2eRun
        ? [/wallet-balance-email\/notifications\.spec\.ts$/]
        : [/^\b$/],
      fullyParallel: false
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: isWalletBalanceEmailE2eRun
        ? ['setup', 'setup-user', 'setup-user2', 'setup-hr-benefits', 'wallet-balance-email-api']
        : ['setup', 'setup-user', 'setup-user2', 'setup-hr-benefits'],
      testIgnore: [
        /auth\.setup\.ts/,
        /auth\.user\.setup\.ts/,
        /auth\.user2\.setup\.ts/,
        /\.api\.spec\.ts$/,
        /rbac\.spec\.ts$/,
        /profile\.spec\.ts$/,
        /^notifications\//,
        /contract-import-notifications[\\/]/,
        /announcements\//,
        /profile-name-live-display\//,
        /kbar\/nav-user\.spec\.ts$/,
        /contracts\/my-contracts-viewer\.spec\.ts$/,
        /benefits\/my-benefits\.spec\.ts$/,
        /benefits\/my-benefits-url-filters\.spec\.ts$/,
        /attachments\//,
        /live-users\//,
        /[\\/]workflow[\\/]/,
        /quick-workflow[\\/]/,
        /quick-info[\\/]/,
        /quick-chat[\\/]/,
        /quick-round2[\\/]/,
        /push-notifications[\\/]/,
        /subscription-equipment[\\/]/,
        /wallet-balance-email\/00-preferences-ui\.spec\.ts$/,
        /wallet-balance-email\/notifications\.spec\.ts$/,
        /wallet-balance-email\/balance-email-logs-rbac\.spec\.ts$/,
        ...(isDevProvisionE2eRun ? [] : [/users\/dev-provision\.spec\.ts$/])
      ]
    },
    {
      name: 'chromium-live-users',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
          '127.0.0.1',
          'localhost'
        )
      },
      dependencies: ['setup', 'setup-user', 'setup-user2'],
      testMatch: [/live-users\/.*\.spec\.ts$/],
      fullyParallel: false
    },
    {
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: isWalletBalanceEmailE2eRun
        ? ['setup-user', 'wallet-balance-email-api', 'wallet-balance-email-notifications']
        : ['setup-user'],
      testMatch: [
        /profile\.spec\.ts$/,
        /system-email-logs-rbac\.spec\.ts$/,
        /balance-email-logs-rbac\.spec\.ts$/,
        /kbar\/nav-user\.spec\.ts$/,
        /contracts\/my-contracts-viewer\.spec\.ts$/,
        /benefits\/my-benefits\.spec\.ts$/,
        /benefits\/my-benefits-url-filters\.spec\.ts$/,
        /wallet-balance-email\/00-preferences-ui\.spec\.ts$/,
        /google-tasks\/rbac\.spec\.ts$/,
        ...(isWalletBalanceEmailE2eRun ? [] : [/wallet-balance-email\/notifications\.spec\.ts$/])
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
      // plan 88 — 워크플로우: 여러 storageState(user·user2·hr-benefits·admin) + 전역 기본 결재선 공유 → 직렬
      name: 'chromium-workflow',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup', 'setup-user', 'setup-user2', 'setup-hr-benefits'],
      testMatch: [/[\\/]workflow[\\/].*\.spec\.ts$/],
      fullyParallel: false,
      timeout: 120_000
    },
    {
      // plan 92 AC-27 — 가드 parity(dev): 쿠키 없음·user.json·dongbang.json 3값
      name: 'guard-parity-api',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup-user', 'setup-dongbang'],
      testMatch: isGuardParityE2eRun ? [/auth[\\/]guard-parity\.api\.spec\.ts$/] : [/^\b$/],
      fullyParallel: false
    },
    {
      // plan 89·92 — 퀵 업무 흐름: user·user2·admin·동방특송·구매물류팀 storageState 공유 → 직렬
      name: 'chromium-quick-workflow',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup', 'setup-user', 'setup-user2', 'setup-dongbang', 'setup-logistics'],
      testMatch: [/quick-workflow[\\/].*\.spec\.ts$/],
      fullyParallel: false,
      timeout: 120_000
    },
    {
      // plan 90 — 퀵 권한 안내 ⓘ 패널: admin·user·동방특송·구매물류팀 storageState → 직렬
      name: 'chromium-quick-info',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup', 'setup-user', 'setup-dongbang', 'setup-logistics'],
      testMatch: [/quick-info[\\/].*\.spec\.ts$/],
      fullyParallel: false,
      timeout: 120_000
    },
    {
      // plan 93 — 퀵 대화: user·user2·admin·동방특송·구매물류팀 storageState + 2 context 실시간 → 직렬
      name: 'chromium-quick-chat',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup', 'setup-user', 'setup-user2', 'setup-dongbang', 'setup-logistics'],
      testMatch: [/quick-chat[\\/].*\.spec\.ts$/],
      fullyParallel: false,
      timeout: 120_000
    },
    {
      // plan 94 — 퀵 2차(실시간 Broadcast·푸시 클릭·작은 수정·수정 알림·잠금 해제): user·user2·admin·동방·구매물류 storageState + 2 context → 직렬
      // plan 95 — 동방 노출 범위 감사: hr(복지비 관리자) storageState 추가
      name: 'chromium-quick-round2',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup', 'setup-user', 'setup-user2', 'setup-hr-benefits', 'setup-dongbang', 'setup-logistics'],
      testMatch: [/quick-round2[\\/].*\.spec\.ts$/],
      fullyParallel: false,
      timeout: 150_000
    },
    {
      // plan 91 — 휴대폰 웹 푸시: user.json 기본 + admin·동방특송 request 컨텍스트 · 공유 구독 상태 → 직렬
      name: 'chromium-push',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup', 'setup-user', 'setup-user2', 'setup-dongbang'],
      testMatch: [/push-notifications[\\/].*\.spec\.ts$/],
      fullyParallel: false,
      timeout: 120_000
    },
    {
      name: 'chromium-attachments',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json'
      },
      dependencies: ['setup', 'setup-user', 'setup-user2'],
      testMatch: [/attachments\/.*\.spec\.ts$/],
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
      dependencies: ['setup', 'setup-user', 'setup-hr-benefits'],
      testMatch: /\.api\.spec\.ts$/,
      testIgnore: [
        /profile-name-live-display\//,
        /^notifications\//,
        /[\\/]workflow[\\/]/,
        /quick-workflow[\\/]/,
        /quick-chat[\\/]/,
        /quick-round2[\\/]/,
        /push-notifications[\\/]/,
        /subscription-equipment[\\/]/,
        /auth[\\/]guard-parity\.api\.spec\.ts$/,
        ...(isWalletBalanceEmailE2eRun ? [/wallet-balance-email\//] : []),
        ...(isDevProvisionE2eRun ? [] : [/users\/dev-provision\.api\.spec\.ts$/])
      ]
    }
  ]
});
