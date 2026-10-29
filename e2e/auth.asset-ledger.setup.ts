import fs from 'node:fs';
import { test as setup } from '@playwright/test';
import { authenticateStorageState } from './helpers/supabase-auth-storage';
import { createOrgChartTestUser, uniqueOrgChartEmail } from './helpers/org-chart';

/**
 * plan 103 — 구독·비품 전용 일회용 계정 4명 (공용 admin·user 세션 의존 최소화).
 * example.com 이메일 + `E2E ` 이름 → teardown `cleanup_e2e_mock_data`가 삭제한다.
 * - asset-accounting.json : wake · 회계팀 (권한자)
 * - asset-staff.json      : wake · 디자인팀 · 「직원 A」
 * - asset-teammate.json   : wake · 디자인팀 · 「직원 B」
 * - asset-other.json      : wake · 마케팅팀 · 「직원 C」
 * userId·이름은 `e2e/.auth/asset-ledger.meta.json`에 남긴다(fixture 대상자 지정용).
 */

const PASSWORD = 'E2eAssetLedger9!';
/** e2e/helpers/asset-ledger.ts `ASSET_META_FILE`와 같은 경로 (setup 파일은 spec에서 import하지 않는다) */
const ASSET_LEDGER_META_FILE = 'e2e/.auth/asset-ledger.meta.json';

const ACCOUNTS = [
  { key: 'accounting', file: 'e2e/.auth/asset-accounting.json', rank: '회계팀', label: '회계' },
  { key: 'staff', file: 'e2e/.auth/asset-staff.json', rank: '디자인팀', label: '직원A' },
  { key: 'teammate', file: 'e2e/.auth/asset-teammate.json', rank: '디자인팀', label: '직원B' },
  { key: 'other', file: 'e2e/.auth/asset-other.json', rank: '마케팅팀', label: '직원C' }
] as const;

setup('authenticate plan 103 asset-ledger accounts (회계팀 · 디자인팀 A·B · 마케팅팀 C)', async ({
  context
}) => {
  const stamp = Date.now().toString(36);
  const meta: Record<string, { userId: string; email: string; fullName: string; rank: string }> = {};

  for (const account of ACCOUNTS) {
    const email = uniqueOrgChartEmail(`asset-${account.key}`);
    const fullName = `E2E Asset ${account.label} ${stamp}`;
    const created = await createOrgChartTestUser(`asset-${account.key}`, {
      email,
      password: PASSWORD,
      affiliation: 'wake',
      rank: account.rank,
      position_level: '사원',
      leader_role: null,
      fullName
    });

    fs.rmSync(account.file, { force: true });
    await authenticateStorageState(context, email, PASSWORD, account.file);
    meta[account.key] = { userId: created.userId, email, fullName, rank: account.rank };
  }

  fs.writeFileSync(ASSET_LEDGER_META_FILE, JSON.stringify(meta, null, 2));
});
