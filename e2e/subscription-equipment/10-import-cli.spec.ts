import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { service } from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md) — 엑셀 1회 이관 스크립트 (Dev 전용)
 * AC-47 dry-run 리포트 · AC-48 Dev 가드(.env 복사본) · AC-49 비밀번호 칸 미이관 · AC-50 건수 · AC-52 저장소에 엑셀·추출물 없음
 * (AC-51 재실행 · AC-53 cleanup 전후 건수는 verifier가 CLI + Dev MCP 읽기로 별도 판정 — 이관 행 쓰기 금지)
 * 이관 데이터(`source='excel_import'`)는 읽기만 한다. 실제 이관(쓰기) 실행은 하지 않는다.
 */

const EXCEL_DIR = '/Users/hoon/Desktop/Wake_Auto/Excel';
const SUBSCRIPTIONS_XLSX = path.join(EXCEL_DIR, '구독관리대장_원본.xlsx');
const EQUIPMENT_XLSX = path.join(EXCEL_DIR, '비품대장_원본.xlsx');
const SCRIPT = 'scripts/asset-ledger-import/run.mjs';
const DEV_ONLY = 'Dev DB에서만 실행할 수 있어요.';
const SECRET_LIKE_PATTERN = /(pw|password|passwd|비밀번호|비번|아이디|login|\bid\b)\s*[:=]|비밀번호|비번/i;
const MEMO_SQL_PATTERN = /(pw|password|passwd|비밀번호|비번|아이디|login|\bid\b)\s*[:=]/i;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

test.skip(!fs.existsSync(SUBSCRIPTIONS_XLSX) || !fs.existsSync(EQUIPMENT_XLSX), '엑셀 원본(저장소 밖)이 없는 머신');

type Snapshot = Record<string, { count: number; maxUpdated: string | null }>;

async function snapshot(): Promise<Snapshot> {
  const result: Snapshot = {};
  for (const table of ['subscriptions', 'subscription_assignees', 'equipment_items'] as const) {
    const { count } = await service().from(table).select('id', { count: 'exact', head: true });
    const column = table === 'subscription_assignees' ? 'created_at' : 'updated_at';
    const { data } = await service().from(table).select(column).order(column, { ascending: false }).limit(1);
    result[table] = {
      count: count ?? -1,
      maxUpdated: ((data ?? [])[0] as Record<string, string> | undefined)?.[column] ?? null
    };
  }
  return result;
}

function tmpImportDirs(): string[] {
  return fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('asset-ledger-import-'));
}

function runImport(args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync('node', ['--no-warnings', SCRIPT, '--subscriptions', SUBSCRIPTIONS_XLSX, '--equipment', EQUIPMENT_XLSX, ...args], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    timeout: 120_000
  });
}

function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

let dryRunStdout = '';

test.describe.configure({ mode: 'serial' });

test.describe('plan 103 · 엑셀 이관 스크립트', () => {
  test('AC-47: dry-run — DB 변경 0 · 구독 70건(사본 시트 제외 표시)·대상자 매칭 건수 · 비품 159대(접두사별) · 의심 칸은 시트·행만(값 0)', async () => {
    test.setTimeout(180_000);
    const before = await snapshot();
    const tmpBefore = tmpImportDirs();
    const result = runImport(['--dry-run']);
    expect(result.status, result.stderr).toBe(0);
    dryRunStdout = result.stdout;
    const out = result.stdout;

    expect(out).toContain('(dry-run · DB 변경 없음)');
    expect(out).toContain('dry-run 완료 — DB 변경 0');
    expect(out).toMatch(/\[구독\] 이관 대상 70건/);
    expect(out).toMatch(/9937 \(킨키\)의 사본: 「사본」 시트 제외/);
    expect(out).toMatch(/대상자 매칭: 사람 \d+ · 팀 \d+ · 소속 전체 \d+ · 미매칭\(관리 메모로\) \d+/);
    const equipmentLine = out.split('\n').find((line) => line.startsWith('[비품] 이관 대상')) ?? '';
    expect(equipmentLine).toMatch(/^\[비품\] 이관 대상 159대/);
    const prefixCounts = Object.fromEntries(
      [...equipmentLine.matchAll(/\b(N|M|T|R|F|TER|S|K|A|W) (\d+)/g)].map((match) => [match[1], Number(match[2])])
    );
    expect({
      N: prefixCounts.N,
      M: prefixCounts.M,
      T: prefixCounts.T,
      R: prefixCounts.R,
      'F/TER': (prefixCounts.F ?? 0) + (prefixCounts.TER ?? 0),
      S: prefixCounts.S,
      K: prefixCounts.K,
      A: prefixCounts.A,
      W: prefixCounts.W
    }).toEqual({ N: 29, M: 47, T: 1, R: 1, 'F/TER': 4, S: 23, K: 15, A: 36, W: 3 });

    // 의심 칸 리포트: 제목 줄 + 「시트 · 행 N · 열 X」 줄만 · 그 밖 출력에 비밀번호·로그인 패턴 없음
    const lines = out.split('\n');
    const headerIndexes = lines
      .map((line, index) => (/비밀번호·로그인 의심 칸 제외 \d+개 \(값은 출력하지 않음\)/.test(line) ? index : -1))
      .filter((index) => index >= 0);
    expect(headerIndexes.length, '구독·비품 각 1줄').toBe(2);
    let flagged = 0;
    for (const index of headerIndexes) {
      const total = Number(lines[index].match(/제외 (\d+)개/)?.[1] ?? -1);
      for (let offset = 1; offset <= total; offset += 1) {
        expect(lines[index + offset], '위치만').toMatch(/^ {4}- .+ · 행 \d+ · 열 [^·]+( \(열 전체\))?$/);
        flagged += 1;
      }
    }
    expect(flagged, '정찰 기준 약 11~12칸').toBeGreaterThanOrEqual(11);
    const others = lines.filter((_, index) => !headerIndexes.includes(index));
    const leaking = others.filter((line) => SECRET_LIKE_PATTERN.test(line));
    expect(leaking, '비밀번호·로그인 값 출력 0').toEqual([]);

    const after = await snapshot();
    expect(after, 'dry-run DB 변경 0').toEqual(before);
    expect(tmpImportDirs(), '임시 폴더는 끝나면 삭제').toEqual(tmpBefore);
  });

  test('AC-48: .env 복사본으로 ① URL ref가 Dev 아님 ② WAKEONE_ENV≠development → 쓰기 전에 exit 1 「Dev DB에서만 실행할 수 있어요.」 · DB 변경 0', async () => {
    const original = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const before = await snapshot();
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifier103-ac48-'));
    try {
      const cases = [
        {
          label: 'URL ref not dev',
          transform: (text: string) =>
            text.replace(/^(NEXT_PUBLIC_SUPABASE_URL=https:\/\/)[a-z0-9]+/m, '$1zzzzprodzzzzzzzzzzzz')
        },
        {
          label: 'WAKEONE_ENV=production',
          transform: (text: string) => text.replace(/^WAKEONE_ENV=.*$/m, 'WAKEONE_ENV=production')
        }
      ];
      for (const item of cases) {
        const copyPath = path.join(workDir, `env-${cases.indexOf(item)}`);
        fs.writeFileSync(copyPath, item.transform(original), { mode: 0o600 });
        const copyEnv = parseEnvFile(fs.readFileSync(copyPath, 'utf8'));
        expect(copyEnv.NEXT_PUBLIC_SUPABASE_URL, item.label).toBeTruthy();
        const result = runImport([], {
          NODE_ENV: process.env.NODE_ENV,
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          TMPDIR: process.env.TMPDIR,
          ...copyEnv
        });
        expect(result.status, `${item.label} exit`).toBe(1);
        expect(result.stderr, item.label).toContain(DEV_ONLY);
        expect(result.stdout, `${item.label} — 이관 시작 전 종료`).not.toContain('asset-ledger-import (실행');
      }
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
    expect(fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8'), '원본 .env 그대로').toBe(original);
    expect(await snapshot(), 'DB 변경 0').toEqual(before);
  });

  test('AC-49: 이관 행 관리 메모에 비밀번호·로그인 패턴 0건 · 의심 칸이 있던 행은 그 값이 통째로 없음 · owner_account는 이메일만', async () => {
    const { data: subs, error } = await service()
      .from('subscriptions')
      .select('import_key, manager_memo, owner_account')
      .eq('source', 'excel_import');
    expect(error).toBeNull();
    const { data: equipment } = await service()
      .from('equipment_items')
      .select('asset_no, manager_memo')
      .eq('source', 'excel_import');
    expect(subs ?? []).toHaveLength(70);
    expect((subs ?? []).filter((row) => MEMO_SQL_PATTERN.test(row.manager_memo ?? ''))).toHaveLength(0);
    expect((equipment ?? []).filter((row) => MEMO_SQL_PATTERN.test(row.manager_memo ?? ''))).toHaveLength(0);
    expect((subs ?? []).filter((row) => SECRET_LIKE_PATTERN.test(row.manager_memo ?? ''))).toHaveLength(0);
    expect((equipment ?? []).filter((row) => SECRET_LIKE_PATTERN.test(row.manager_memo ?? ''))).toHaveLength(0);
    // 부분 마스킹 흔적 없음
    for (const row of [...(subs ?? []), ...(equipment ?? [])]) {
      expect(row.manager_memo ?? '').not.toMatch(/\*{3,}|•{3,}|\[MASKED\]|\[REDACTED\]/i);
    }
    // owner_account는 이메일만
    const owners = (subs ?? []).map((row) => row.owner_account).filter((value): value is string => value !== null);
    expect(owners.filter((value) => !EMAIL_PATTERN.test(value) || /\s|각자/.test(value))).toHaveLength(0);

    // 의심 칸이 있던 구독 행(리포트의 시트·행 → import_key)의 메모·주계정에 패턴 없음
    const stdout = dryRunStdout || runImport(['--dry-run']).stdout;
    const subscriptionSection = stdout.split('[비품]')[0];
    const flagged = [...subscriptionSection.matchAll(/^ {4}- (.+) · 행 (\d+) · 열 ([^·\n]+?)(?: \(열 전체\))?$/gm)].map(
      (match) => ({ sheet: match[1], row: match[2] })
    );
    expect(flagged.length).toBeGreaterThan(0);
    const byKey = new Map((subs ?? []).map((row) => [row.import_key, row]));
    let matched = 0;
    for (const item of flagged) {
      const row = byKey.get(`${item.sheet}:${item.row}`);
      if (!row) continue; // 멤버 행이면 헤드 행에 합쳐짐
      matched += 1;
      expect(SECRET_LIKE_PATTERN.test(row.manager_memo ?? ''), `${item.sheet}:${item.row} memo`).toBe(false);
      if (row.owner_account) expect(row.owner_account).toMatch(EMAIL_PATTERN);
    }
    expect(matched, '의심 칸이 있던 헤드 행을 찾음').toBeGreaterThan(0);
  });

  test('AC-50: 카드 9937 행 = 8(사본 시트 중복 없음) · 구독 70 · 비품 159', async () => {
    const { data: subs } = await service()
      .from('subscriptions')
      .select('payer_entity, card_last4')
      .eq('source', 'excel_import');
    const { count: equipmentCount } = await service()
      .from('equipment_items')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'excel_import');
    expect(subs ?? []).toHaveLength(70);
    expect((subs ?? []).filter((row) => row.card_last4 === '9937')).toHaveLength(8);
    expect(equipmentCount).toBe(159);
  });

  test('AC-52: 저장소에 xlsx·xls·csv·추출 JSON 0건 · .gitignore에 *.xlsx · 임시 파일은 os.tmpdir() 아래에서 삭제', async () => {
    const tracked = spawnSync('git', ['ls-files'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(tracked.status).toBe(0);
    expect(tracked.stdout.split('\n').filter((file) => /\.(xlsx|xls|csv)$/i.test(file))).toEqual([]);
    const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    expect(status.status).toBe(0);
    const dirty = status.stdout
      .split('\n')
      .filter((line) => /\.(xlsx|xls|csv)$/i.test(line) || /asset-ledger-import.*\.json$/i.test(line));
    expect(dirty, '작업 트리에 엑셀·추출물 없음').toEqual([]);
    const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
    expect(gitignore.split(/\r?\n/).map((line) => line.trim())).toContain('*.xlsx');
    const scriptSource = fs.readFileSync(path.join(process.cwd(), SCRIPT), 'utf8');
    expect(scriptSource).toContain('os.tmpdir()');
    expect(scriptSource).toMatch(/finally \{\s*fs\.rmSync\(tmpDir, \{ recursive: true, force: true \}\);/);
    expect(tmpImportDirs(), '남은 임시 폴더 없음').toEqual([]);
  });
});
