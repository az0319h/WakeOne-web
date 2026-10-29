/**
 * plan 103 D-21 · AC-47~53 — 구독관리대장·비품대장 엑셀 → Dev DB 1회 이관.
 *
 * Usage:
 *   node scripts/asset-ledger-import/run.mjs --subscriptions "<구독 xlsx>" --equipment "<비품 xlsx>" [--dry-run]
 *
 * 규칙 (plan §엑셀 이관 스크립트 · 바꾸려면 plan 수정 이력 먼저):
 *  ① 원본은 저장소 **밖** 경로를 인자로만 받는다. 원본은 읽기만 한다(수정·이동·복사 금지).
 *     중간 산출물(JSON)은 os.tmpdir() 아래 임시 폴더에만 쓰고 끝나면 지운다. 저장소에 xlsx·csv·JSON을 만들지 않는다.
 *  ② 비밀번호·로그인 정보로 보이는 칸(SECRET_LIKE_PATTERN · 서버와 공용)은 **통째로** 버린다(부분 마스킹 금지).
 *     리포트에는 시트명·행·열 위치만 쓰고 값은 출력하지 않는다. 헤더가 비밀번호·아이디류인 열은 열 전체를 버린다.
 *  ③ 시트 이름에 「사본」이 든 시트는 건너뛴다.
 *  ④ Dev DB만: NEXT_PUBLIC_SUPABASE_URL 프로젝트 ref가 Dev(dgjtcx…)가 아니거나 WAKEONE_ENV≠development면
 *     **DB에 접근하기 전에** exit 1 「Dev DB에서만 실행할 수 있어요.」 (dry-run도 이름 매칭 조회를 하므로 같은 가드)
 *  ⑤ 재실행 안전: 구독 import_key(`{시트명}:{행번호}`) · 비품 asset_no unique → on conflict do nothing.
 *     이미 있는 행은 건드리지 않는다(앱에서 고친 값 보존). 이관 행은 source='excel_import'.
 *
 * 이메일·알림·activity log 없음(Route가 아님 — 리포트 건수와 source 표식으로 추적).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SECRET_LIKE_PATTERN } from '../../src/lib/secret-like-pattern.ts';

const DEV_PROJECT_REF_PREFIX = 'dgjtcx';
const DEV_ONLY_MESSAGE = 'Dev DB에서만 실행할 수 있어요.';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

// ---------------------------------------------------------------------------
// 인자 · 환경
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { dryRun: false, subscriptions: null, equipment: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--subscriptions') args.subscriptions = argv[++index] ?? null;
    else if (arg === '--equipment') args.equipment = argv[++index] ?? null;
    else {
      console.error(`asset-ledger-import: 알 수 없는 인자 ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

function projectRefOf(url) {
  try {
    return new URL(url).hostname.split('.')[0] ?? '';
  } catch {
    return '';
  }
}

/** 규칙 ④ — DB 접근 전에 판정 */
function assertDevEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const ref = projectRefOf(url);
  if (!ref.startsWith(DEV_PROJECT_REF_PREFIX) || process.env.WAKEONE_ENV !== 'development') {
    console.error(`asset-ledger-import: ${DEV_ONLY_MESSAGE}`);
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('asset-ledger-import: SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
    process.exit(1);
  }
}

/** 규칙 ① — 원본은 저장소 밖 .xlsx만 */
function assertSourcePath(label, filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  if (!resolved.toLowerCase().endsWith('.xlsx') || !fs.existsSync(resolved)) {
    console.error(`asset-ledger-import: ${label} 파일(.xlsx)을 찾을 수 없어요.`);
    process.exit(2);
  }
  const relative = path.relative(REPO_ROOT, resolved);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    console.error(`asset-ledger-import: ${label} 원본은 저장소 밖 경로여야 해요(저장소 안 엑셀 금지).`);
    process.exit(2);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// 엑셀 파싱 (Python stdlib · 임시 폴더)
// ---------------------------------------------------------------------------
function parseWorkbook(xlsxPath, tmpDir, name) {
  const outPath = path.join(tmpDir, `${name}.json`);
  const result = spawnSync('python3', ['-I', path.join(SCRIPT_DIR, 'parse_xlsx.py'), xlsxPath, outPath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(`parse_xlsx.py 실패 (${name}) — exit ${result.status}`);
  }
  return JSON.parse(fs.readFileSync(outPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// 공용 변환 도우미
// ---------------------------------------------------------------------------
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const SECRET_HEADER_PATTERN = /비밀번호|비번|password|passwd|^pw$|^id$|아이디|로그인|login/i;
const MEMO_MAX = 1000;
const TITLE_TOKENS = new Set(['대리', '과장', '차장', '부장', '사원', '주임', '팀장', '파트장', '님', '매니저', '실장', '선임', '선임매니저']);

const AFFILIATION_LABELS = { wake: '웨이크', sans: '산스', sans_foundry: '산스파운드리' };
const RANK_BY_AFFILIATION = {
  wake: ['경영진', '사업기획팀', '마케팅팀', '디자인팀', '구매물류팀', '인사팀', '회계팀', '총무'],
  sans: ['익선', '신세계강남'],
  sans_foundry: ['공장장', '생산팀', '품질팀', '공무팀', '지원팀', '물류팀']
};

function cellText(cell) {
  if (!cell) return '';
  if (cell.t === 'd') return cell.v;
  return String(cell.v ?? '').replace(/ /g, ' ').trim();
}

function isBlank(text) {
  return text === '' || text === '-' || text === '—';
}

function toDate(cell) {
  if (!cell) return { value: null };
  if (cell.t === 'd') return { value: cell.v };
  const text = cellText(cell);
  if (isBlank(text)) return { value: null };
  const match = DATE_PATTERN.exec(text.replace(/\./g, '-').replace(/\s/g, ''));
  if (match) {
    const [, year, month, day] = match;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso)) return { value: iso };
  }
  return { value: null, raw: text };
}

function truncate(text, max) {
  if (!text) return { value: null, truncated: false };
  return text.length <= max ? { value: text, truncated: false } : { value: `${text.slice(0, max - 1)}…`, truncated: true };
}

function buildMemo(lines) {
  const joined = lines.filter(Boolean).join('\n').trim();
  if (!joined) return null;
  // 합친 결과가 패턴에 걸리면(조각 경계 등) 메모 전체를 버린다 — 규칙 ②
  if (SECRET_LIKE_PATTERN.test(joined)) return { dropped: true };
  return joined.length <= MEMO_MAX ? joined : `${joined.slice(0, MEMO_MAX - 1)}…`;
}

function headerMap(row) {
  const map = new Map();
  for (const [column, cell] of Object.entries(row?.c ?? {})) {
    const label = cellText(cell).replace(/\s+/g, '');
    if (label) map.set(label, column);
  }
  return map;
}

function findColumn(headers, ...candidates) {
  for (const candidate of candidates) {
    for (const [label, column] of headers) {
      if (label === candidate || label.startsWith(candidate)) return column;
    }
  }
  return null;
}

/**
 * 시트 한 장의 데이터 행 → 비밀번호 의심 칸 제거본.
 * 반환 rows: [{ r, c: {col: cell} }] — 의심 칸·의심 열은 빠져 있다.
 */
function scrubSheet(sheet, headerRowIndex, secretLog) {
  const headerRow = sheet.rows[headerRowIndex];
  const secretColumns = new Set();
  for (const [column, cell] of Object.entries(headerRow?.c ?? {})) {
    if (SECRET_HEADER_PATTERN.test(cellText(cell).replace(/\s+/g, ''))) secretColumns.add(column);
  }
  const rows = [];
  for (const row of sheet.rows.slice(headerRowIndex + 1)) {
    const cells = {};
    for (const [column, cell] of Object.entries(row.c)) {
      if (secretColumns.has(column)) {
        secretLog.push({ sheet: sheet.name, row: row.r, column, reason: 'header' });
        continue;
      }
      if (cell.t === 's' && SECRET_LIKE_PATTERN.test(String(cell.v))) {
        secretLog.push({ sheet: sheet.name, row: row.r, column, reason: 'pattern' });
        continue;
      }
      cells[column] = cell;
    }
    rows.push({ r: row.r, c: cells });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 사람·팀 매칭 (active · 비동방 full_name 정확히 1명)
// ---------------------------------------------------------------------------
function buildPeopleIndex(profiles) {
  const byName = new Map();
  for (const profile of profiles) {
    const name = (profile.full_name ?? '').trim();
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push(profile.user_id);
    byName.set(name, list);
  }
  return {
    unique(name) {
      const list = byName.get(name.trim());
      return list && list.length === 1 ? list[0] : null;
    }
  };
}

const UNIQUE_RANK_AFFILIATION = (() => {
  const counts = new Map();
  for (const [affiliation, ranks] of Object.entries(RANK_BY_AFFILIATION)) {
    for (const rank of ranks) counts.set(rank, [...(counts.get(rank) ?? []), affiliation]);
  }
  return new Map([...counts].filter(([, list]) => list.length === 1).map(([rank, list]) => [rank, list[0]]));
})();

function matchTeamOrAffiliation(piece) {
  const compact = piece.replace(/\s+/g, ' ').trim();
  const allMatch = /^(웨이크|산스파운드리|산스)\s*(임직원|전\s?직원)$/.exec(compact);
  if (allMatch) {
    const affiliation = Object.entries(AFFILIATION_LABELS).find(([, label]) => label === allMatch[1])?.[0];
    if (affiliation) return { assignee_type: 'affiliation', affiliation };
  }
  const withoutStore = compact.replace(/\s*매장$/, '');
  for (const [affiliation, label] of Object.entries(AFFILIATION_LABELS)) {
    if (withoutStore.startsWith(`${label} `)) {
      const rank = withoutStore.slice(label.length + 1).trim();
      if (RANK_BY_AFFILIATION[affiliation].includes(rank)) return { assignee_type: 'team', affiliation, rank };
    }
  }
  const affiliation = UNIQUE_RANK_AFFILIATION.get(withoutStore);
  if (affiliation && withoutStore !== '경영진') return { assignee_type: 'team', affiliation, rank: withoutStore };
  return null;
}

function matchPiece(piece, people) {
  const cleaned = piece.replace(/^주계정\s*[:：]\s*/, '').trim();
  if (isBlank(cleaned)) return { assignees: [] };
  const teamOrAll = matchTeamOrAffiliation(cleaned);
  if (teamOrAll) return { assignees: [teamOrAll] };
  const exact = people.unique(cleaned);
  if (exact) return { assignees: [{ assignee_type: 'user', user_id: exact }] };
  const tokens = cleaned.split(/\s+/).filter((token) => token && !TITLE_TOKENS.has(token));
  if (tokens.length > 0 && !/[()（）]/.test(cleaned)) {
    const ids = tokens.map((token) => people.unique(token));
    if (ids.every(Boolean)) {
      return { assignees: ids.map((user_id) => ({ assignee_type: 'user', user_id })) };
    }
  }
  return { assignees: [], unmatched: cleaned };
}

function matchAssigneeCell(text, people) {
  const result = { assignees: [], unmatched: [] };
  if (isBlank(text)) return result;
  for (const piece of text.split(/[,\n/、·;]+/)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const matched = matchPiece(trimmed, people);
    result.assignees.push(...matched.assignees);
    if (matched.unmatched) result.unmatched.push(matched.unmatched);
  }
  return result;
}

function assigneeKey(assignee) {
  if (assignee.assignee_type === 'user') return `user:${assignee.user_id}`;
  if (assignee.assignee_type === 'team') return `team:${assignee.affiliation}:${assignee.rank}`;
  return `affiliation:${assignee.affiliation}`;
}

// ---------------------------------------------------------------------------
// 구독 변환
// ---------------------------------------------------------------------------
const CATEGORY_BY_LABEL = {
  '크리에이티브툴': 'creative',
  '소프트웨어': 'software',
  '협업툴': 'collaboration',
  '기타': 'etc'
};

function payerFromSheet(sheetName) {
  if (sheetName.includes('미확인')) return 'unknown';
  if (sheetName.includes('비욘드푸드')) return 'beyond_food';
  if (sheetName.includes('킨키')) return 'kinky';
  if (sheetName.includes('산스파운드리')) return 'sans_foundry';
  if (sheetName.includes('산스')) return 'sans';
  if (sheetName.includes('웨이크')) return 'wake';
  return 'unknown';
}

function cardFromSheet(sheetName) {
  const match = /(\d{4})/.exec(sheetName);
  return match ? match[1] : null;
}

function parseAmount(cell) {
  if (!cell) return { amount: null, currency: null, varies: false };
  if (cell.t === 'n') {
    const currency = /\$/.test(cell.f ?? '') ? 'USD' : 'KRW';
    return { amount: Number(cell.v), currency, varies: false };
  }
  const text = cellText(cell);
  if (isBlank(text)) return { amount: null, currency: null, varies: false };
  const numbers = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)/g)].map((match) => Number(match[1].replace(/,/g, '')));
  const currency = text.includes('$') ? 'USD' : 'KRW';
  const varies = /상이|대략|약\s*\d|~/.test(text);
  const ambiguous = numbers.length !== 1 || /만원|~|\//.test(text);
  if (ambiguous) {
    return { amount: null, currency: numbers.length > 0 ? currency : null, varies, raw: text };
  }
  return { amount: numbers[0], currency, varies, raw: varies ? text : undefined };
}

function parseBilling(cell) {
  if (!cell) return {};
  if (cell.t === 'd') return { billing_date: cell.v };
  const text = cellText(cell);
  if (isBlank(text)) return {};
  const day = /^(?:매월\s*)?(\d{1,2})\s*일$/.exec(text.replace(/\s+/g, ' '));
  if (day && Number(day[1]) >= 1 && Number(day[1]) <= 31) return { billing_day: Number(day[1]) };
  const date = toDate(cell);
  if (date.value) return { billing_date: date.value };
  return { raw: text };
}

function transformSubscriptions(workbook, people, report, secretLog) {
  const rows = [];
  for (const sheet of workbook.sheets) {
    if (sheet.name.includes('사본')) {
      report.skippedSheets.push(sheet.name);
      continue;
    }
    const headerIndex = sheet.rows.findIndex((row) => {
      const labels = Object.values(row.c).map((cell) => cellText(cell).replace(/\s+/g, ''));
      return labels.includes('구분') && labels.includes('구독명');
    });
    if (headerIndex < 0) {
      report.unknownSheets.push(sheet.name);
      continue;
    }
    const headers = headerMap(sheet.rows[headerIndex]);
    const col = {
      category: findColumn(headers, '구분'),
      name: findColumn(headers, '구독명'),
      plan: findColumn(headers, '플랜명', '플랜'),
      purpose: findColumn(headers, '사용목적'),
      owner: findColumn(headers, '주계정'),
      cycle: findColumn(headers, '결제유형'),
      amount: findColumn(headers, '결제금액'),
      billing: findColumn(headers, '결제일'),
      started: findColumn(headers, '구독시작일'),
      expires: findColumn(headers, '구독만료일', '만료일'),
      assignees: findColumn(headers, '구독대상자', '대상자'),
      memo: findColumn(headers, '비고')
    };
    const card = cardFromSheet(sheet.name);
    const payer = payerFromSheet(sheet.name);
    const dataRows = scrubSheet(sheet, headerIndex, secretLog);
    let sheetCount = 0;
    let current = null;

    for (const row of dataRows) {
      const get = (key) => (col[key] ? row.c[col[key]] : undefined);
      const nameText = cellText(get('name'));
      const hasAny = Object.keys(row.c).length > 0;
      if (!hasAny) continue;

      if (isBlank(nameText)) {
        // 멤버 행 — 바로 위 헤드 구독의 대상자 추가 (멤버 행 이메일은 버림)
        if (!current) continue;
        report.memberRows += 1;
        const matched = matchAssigneeCell(cellText(get('assignees')), people);
        current.assignees.push(...matched.assignees);
        for (const raw of matched.unmatched) current.memo.push(`대상자(원문): ${raw}`);
        const memberMemo = cellText(get('memo'));
        if (!isBlank(memberMemo)) current.memo.push(`비고(멤버 행): ${memberMemo}`);
        continue;
      }

      sheetCount += 1;
      const memo = [];
      const categoryText = cellText(get('category'));
      let category = CATEGORY_BY_LABEL[categoryText.replace(/\s+/g, '')];
      if (!category) {
        category = 'etc';
        if (!isBlank(categoryText)) {
          memo.push(`구분(원문): ${categoryText}`);
          report.categoryFallback += 1;
        }
      }

      const name = truncate(nameText, 80);
      const planText = cellText(get('plan'));
      const plan = truncate(isBlank(planText) ? '' : planText, 80);
      const purposeText = cellText(get('purpose'));
      const purpose = truncate(isBlank(purposeText) ? '' : purposeText, 200);
      if (name.truncated || plan.truncated || purpose.truncated) report.truncatedFields += 1;

      const ownerText = cellText(get('owner'));
      let ownerAccount = null;
      if (EMAIL_PATTERN.test(ownerText) && ownerText.length <= 120) ownerAccount = ownerText;
      else if (!isBlank(ownerText)) memo.push(`주계정: ${ownerText}`);

      const cycleText = cellText(get('cycle'));
      let billingCycle = null;
      if (cycleText.startsWith('월')) billingCycle = 'monthly';
      else if (cycleText.startsWith('연')) billingCycle = 'yearly';
      else if (!isBlank(cycleText)) memo.push(`결제유형(원문): ${cycleText}`);

      const amount = parseAmount(get('amount'));
      if (amount.raw) memo.push(`결제금액(원문): ${amount.raw}`);

      const billing = parseBilling(get('billing'));
      if (billing.raw) memo.push(`결제일(원문): ${billing.raw}`);

      const started = toDate(get('started'));
      if (started.raw) memo.push(`구독시작일(원문): ${started.raw}`);
      const expires = toDate(get('expires'));
      if (expires.raw) memo.push(`구독만료일(원문): ${expires.raw}`);

      const assigneeText = cellText(get('assignees'));
      const rowTexts = Object.values(row.c).map((cell) => cellText(cell));
      const canceled = rowTexts.some((text) => /구독\s*취소/.test(text));
      const matched = matchAssigneeCell(canceled ? assigneeText.replace(/\d{4}-\d{2}-\d{2}\s*구독\s*취소/, '') : assigneeText, people);
      for (const raw of matched.unmatched) memo.push(`대상자(원문): ${raw}`);
      if (canceled && /구독\s*취소/.test(assigneeText)) memo.push(`구독 취소 메모: ${assigneeText}`);

      const memoText = cellText(get('memo'));
      if (!isBlank(memoText)) {
        memo.push(memoText);
        if (memoText.includes('개인카드')) amount.personalCard = true;
      }

      current = {
        import_key: `${sheet.name}:${row.r}`,
        category,
        name: name.value,
        plan_name: plan.value,
        purpose: purpose.value,
        status: canceled ? 'canceled' : 'active',
        expires_on: expires.value,
        payer_entity: amount.personalCard ? 'personal_card' : payer,
        card_last4: card,
        billing_cycle: billingCycle,
        billing_day: billing.billing_day ?? null,
        billing_date: billing.billing_date ?? null,
        amount: amount.amount,
        currency: amount.amount === null && !amount.varies ? null : amount.currency,
        amount_varies: amount.varies,
        started_on: started.value,
        owner_account: ownerAccount,
        memo,
        assignees: [...matched.assignees]
      };
      rows.push(current);
    }
    report.sheets.push({ name: sheet.name, count: sheetCount });
  }

  // 대상자 중복 제거 · 메모 합치기
  for (const row of rows) {
    const seen = new Set();
    row.assignees = row.assignees.filter((assignee) => {
      const key = assigneeKey(assignee);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    for (const assignee of row.assignees) report.assigneeMatched[assignee.assignee_type] += 1;
    report.assigneeUnmatched += row.memo.filter((line) => line.startsWith('대상자(원문)')).length;
    const memo = buildMemo(row.memo);
    if (memo && typeof memo === 'object') {
      report.memoDropped += 1;
      row.manager_memo = null;
    } else {
      row.manager_memo = memo;
    }
    delete row.memo;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 비품 변환
// ---------------------------------------------------------------------------
const KIND_BY_PREFIX = {
  N: 'notebook',
  M: 'monitor',
  W: 'desktop',
  S: 'mouse',
  K: 'keyboard',
  T: 'tablet',
  R: 'store_device',
  F: 'store_device',
  TER: 'store_device',
  A: 'etc',
  P: 'etc'
};
const STATUS_BY_LABEL = { 사용중: 'in_use', 미사용: 'stored', 분실: 'lost' };
const LEDGER_BY_LABEL = { 웨이크: 'wake', 산스: 'sans', 산스파운드리: 'sans_foundry', 킨키: 'kinky', 비욘드푸드: 'beyond_food' };

function parseWon(cell) {
  if (!cell) return null;
  if (cell.t === 'n') return Math.round(Number(cell.v));
  const text = cellText(cell);
  if (isBlank(text)) return null;
  const numbers = [...text.matchAll(/(\d[\d,]*)/g)].map((match) => Number(match[1].replace(/,/g, '')));
  return numbers.length === 1 && Number.isFinite(numbers[0]) ? numbers[0] : null;
}

function ledgerCode(cell) {
  if (!cell) return null;
  if (cell.t === 'n') {
    const zeros = /^0+$/.exec(cell.f ?? '');
    const text = String(cell.v);
    return zeros ? text.padStart(zeros[0].length, '0') : text;
  }
  const text = cellText(cell);
  return isBlank(text) ? null : text.slice(0, 40);
}

function transformEquipment(workbook, people, report, secretLog) {
  const rows = [];
  const seen = new Set();
  for (const sheet of workbook.sheets) {
    if (sheet.name.includes('사본') || sheet.name === '라벨' || sheet.name === '목록값') {
      report.skippedSheets.push(sheet.name);
      continue;
    }
    const headerIndex = sheet.rows.findIndex((row) =>
      Object.values(row.c).some((cell) => cellText(cell).replace(/\s+/g, '') === '자산번호')
    );
    if (headerIndex < 0) {
      report.unknownSheets.push(sheet.name);
      continue;
    }
    const headers = headerMap(sheet.rows[headerIndex]);
    const col = {
      assetNo: findColumn(headers, '자산번호'),
      status: findColumn(headers, '상태'),
      model: findColumn(headers, '품명'),
      user: findColumn(headers, '실사용자'),
      place: findColumn(headers, '사용처'),
      ledger: findColumn(headers, '회계장부'),
      code: findColumn(headers, '장부코드'),
      amount: findColumn(headers, '구입금액'),
      date: findColumn(headers, '구입날짜'),
      vendor: findColumn(headers, '구입처'),
      memo: findColumn(headers, '비고')
    };
    const dataRows = scrubSheet(sheet, headerIndex, secretLog);
    let sheetCount = 0;

    for (const row of dataRows) {
      const get = (key) => (col[key] ? row.c[col[key]] : undefined);
      const rawNo = cellText(get('assetNo')).toUpperCase().replace(/\s+/g, '');
      const match = /^([A-Z]{1,3})-(\d+)$/.exec(rawNo);
      if (!match) continue;
      const prefix = match[1];
      const kind = KIND_BY_PREFIX[prefix];
      if (!kind) {
        report.unknownPrefix += 1;
        continue;
      }
      const assetNo = `${prefix}-${match[2].padStart(3, '0')}`;
      if (!/^\d{3,4}$/.test(assetNo.split('-')[1])) {
        report.unknownPrefix += 1;
        continue;
      }
      if (seen.has(assetNo)) {
        report.duplicateAssetNo += 1;
        continue;
      }
      seen.add(assetNo);
      sheetCount += 1;
      report.byPrefix[prefix] = (report.byPrefix[prefix] ?? 0) + 1;

      const memo = [];
      const statusText = cellText(get('status'));
      let status = STATUS_BY_LABEL[statusText];
      if (!status) {
        status = 'stored';
        if (!isBlank(statusText)) memo.push(`상태(원문): ${statusText}`);
      }
      report.byStatus[status] = (report.byStatus[status] ?? 0) + 1;

      const modelText = cellText(get('model'));
      const model = truncate(isBlank(modelText) ? '' : modelText, 120);

      const userText = cellText(get('user'));
      let assignee = null;
      if (!isBlank(userText)) {
        const matched = matchAssigneeCell(userText, people);
        const usable = matched.assignees.filter((item) => item.assignee_type !== 'affiliation');
        if (usable.length === 1 && matched.unmatched.length === 0) {
          assignee = usable[0];
          report.assigneeMatched[assignee.assignee_type] += 1;
        } else {
          memo.push(`실사용자(원문): ${userText}`);
          report.assigneeUnmatched += 1;
        }
      }

      const placeText = cellText(get('place'));
      if (!isBlank(placeText) && placeText !== '본사') memo.push(`사용처: ${placeText}`);

      const ledgerText = cellText(get('ledger'));
      const ledgerEntity = LEDGER_BY_LABEL[ledgerText] ?? null;
      if (!ledgerEntity && !isBlank(ledgerText)) memo.push(`회계장부(원문): ${ledgerText}`);

      const purchased = toDate(get('date'));
      if (purchased.raw) memo.push(`구입날짜(원문): ${purchased.raw}`);
      const vendorText = cellText(get('vendor'));
      const vendor = truncate(isBlank(vendorText) ? '' : vendorText, 80);

      const memoText = cellText(get('memo'));
      if (!isBlank(memoText)) memo.push(memoText);

      let managerMemo = buildMemo(memo);
      if (managerMemo && typeof managerMemo === 'object') {
        report.memoDropped += 1;
        managerMemo = null;
      }

      rows.push({
        asset_no: assetNo,
        kind,
        model_serial: model.value,
        status,
        assignee_type: assignee?.assignee_type ?? null,
        assignee_user_id: assignee?.assignee_type === 'user' ? assignee.user_id : null,
        assignee_affiliation: assignee?.assignee_type === 'team' ? assignee.affiliation : null,
        assignee_rank: assignee?.assignee_type === 'team' ? assignee.rank : null,
        ledger_entity: ledgerEntity,
        ledger_code: ledgerCode(get('code')),
        purchase_amount: parseWon(get('amount')),
        purchased_on: purchased.value,
        vendor: vendor.value,
        manager_memo: managerMemo
      });
    }
    report.sheets.push({ name: sheet.name, count: sheetCount });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// DB 쓰기 (규칙 ⑤ — on conflict do nothing)
// ---------------------------------------------------------------------------
async function insertSubscriptions(admin, rows) {
  let inserted = 0;
  let assigneeRows = 0;
  for (let offset = 0; offset < rows.length; offset += 50) {
    const batch = rows.slice(offset, offset + 50);
    const payload = batch.map(({ assignees: _assignees, ...row }) => ({ ...row, source: 'excel_import' }));
    const { data, error } = await admin
      .from('subscriptions')
      .upsert(payload, { onConflict: 'import_key', ignoreDuplicates: true })
      .select('id, import_key');
    if (error) throw new Error(`subscriptions insert failed: ${error.message}`);
    inserted += data?.length ?? 0;
    const idByKey = new Map((data ?? []).map((row) => [row.import_key, row.id]));
    const assignees = batch.flatMap((row) => {
      const id = idByKey.get(row.import_key);
      if (!id) return [];
      return row.assignees.map((assignee) => ({
        subscription_id: id,
        assignee_type: assignee.assignee_type,
        user_id: assignee.assignee_type === 'user' ? assignee.user_id : null,
        affiliation: assignee.assignee_type === 'user' ? null : assignee.affiliation,
        rank: assignee.assignee_type === 'team' ? assignee.rank : null
      }));
    });
    if (assignees.length > 0) {
      const { error: assigneeError } = await admin.from('subscription_assignees').insert(assignees);
      if (assigneeError) throw new Error(`subscription_assignees insert failed: ${assigneeError.message}`);
      assigneeRows += assignees.length;
    }
  }
  return { inserted, existing: rows.length - inserted, assigneeRows };
}

async function insertEquipment(admin, rows) {
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100).map((row) => ({ ...row, source: 'excel_import' }));
    const { data, error } = await admin
      .from('equipment_items')
      .upsert(batch, { onConflict: 'asset_no', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`equipment_items insert failed: ${error.message}`);
    inserted += data?.length ?? 0;
  }
  return { inserted, existing: rows.length - inserted };
}

// ---------------------------------------------------------------------------
// 리포트 (건수·위치만 · 값 출력 금지)
// ---------------------------------------------------------------------------
function newReport() {
  return {
    sheets: [],
    skippedSheets: [],
    unknownSheets: [],
    memberRows: 0,
    categoryFallback: 0,
    truncatedFields: 0,
    memoDropped: 0,
    assigneeMatched: { user: 0, team: 0, affiliation: 0 },
    assigneeUnmatched: 0,
    byPrefix: {},
    byStatus: {},
    unknownPrefix: 0,
    duplicateAssetNo: 0
  };
}

function printSecretLog(label, secretLog) {
  console.log(`  비밀번호·로그인 의심 칸 제외 ${secretLog.length}개 (값은 출력하지 않음)`);
  for (const item of secretLog) {
    console.log(`    - ${item.sheet} · 행 ${item.row} · 열 ${item.column}${item.reason === 'header' ? ' (열 전체)' : ''}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const subscriptionsPath = assertSourcePath('구독', args.subscriptions);
  const equipmentPath = assertSourcePath('비품', args.equipment);
  if (!subscriptionsPath && !equipmentPath) {
    console.error('asset-ledger-import: --subscriptions 또는 --equipment 경로가 필요합니다.');
    process.exit(2);
  }

  loadEnvFile(path.join(REPO_ROOT, '.env'));
  assertDevEnvironment();

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-ledger-import-'));
  try {
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('user_id, full_name')
      .eq('status', 'active')
      .or('affiliation.is.null,affiliation.neq.dongbang');
    if (error) throw new Error(`profiles lookup failed: ${error.message}`);
    const people = buildPeopleIndex(profiles ?? []);

    console.log(`asset-ledger-import ${args.dryRun ? '(dry-run · DB 변경 없음)' : '(실행 · Dev DB)'}`);

    let subscriptionRows = [];
    if (subscriptionsPath) {
      const report = newReport();
      const secretLog = [];
      subscriptionRows = transformSubscriptions(parseWorkbook(subscriptionsPath, tmpDir, 'subscriptions'), people, report, secretLog);
      console.log(`\n[구독] 이관 대상 ${subscriptionRows.length}건 (멤버 행 ${report.memberRows}행 → 대상자로 합침)`);
      for (const sheet of report.sheets) console.log(`  - ${sheet.name}: ${sheet.count}건`);
      for (const name of report.skippedSheets) console.log(`  - ${name}: 「사본」 시트 제외`);
      for (const name of report.unknownSheets) console.log(`  - ${name}: 헤더(구분·구독명) 없음 → 건너뜀`);
      console.log(
        `  대상자 매칭: 사람 ${report.assigneeMatched.user} · 팀 ${report.assigneeMatched.team} · 소속 전체 ${report.assigneeMatched.affiliation} · 미매칭(관리 메모로) ${report.assigneeUnmatched}`
      );
      console.log(`  구분 미분류 → 기타 ${report.categoryFallback}건 · 글자 수 초과로 자름 ${report.truncatedFields}건 · 메모 통째 제외 ${report.memoDropped}건`);
      printSecretLog('구독', secretLog);
    }

    let equipmentRows = [];
    if (equipmentPath) {
      const report = newReport();
      const secretLog = [];
      equipmentRows = transformEquipment(parseWorkbook(equipmentPath, tmpDir, 'equipment'), people, report, secretLog);
      const prefixSummary = Object.entries(report.byPrefix)
        .map(([prefix, count]) => `${prefix} ${count}`)
        .join(' · ');
      console.log(`\n[비품] 이관 대상 ${equipmentRows.length}대 (${prefixSummary})`);
      for (const sheet of report.sheets) console.log(`  - ${sheet.name}: ${sheet.count}대`);
      for (const name of report.skippedSheets) console.log(`  - ${name}: 제외 시트`);
      console.log(
        `  상태: 사용중 ${report.byStatus.in_use ?? 0} · 보관 ${report.byStatus.stored ?? 0} · 분실 ${report.byStatus.lost ?? 0}`
      );
      console.log(
        `  사용자 매칭: 사람 ${report.assigneeMatched.user} · 팀 ${report.assigneeMatched.team} · 미매칭(관리 메모로) ${report.assigneeUnmatched}`
      );
      console.log(`  접두사 불명 ${report.unknownPrefix} · 자산번호 중복 ${report.duplicateAssetNo} · 메모 통째 제외 ${report.memoDropped}건`);
      printSecretLog('비품', secretLog);
    }

    if (args.dryRun) {
      console.log('\ndry-run 완료 — DB 변경 0');
      return;
    }

    if (subscriptionRows.length > 0) {
      const result = await insertSubscriptions(admin, subscriptionRows);
      console.log(`\n[구독] 새로 추가 ${result.inserted} · 이미 있음 ${result.existing} · 대상자 행 ${result.assigneeRows}`);
    }
    if (equipmentRows.length > 0) {
      const result = await insertEquipment(admin, equipmentRows);
      console.log(`[비품] 새로 추가 ${result.inserted} · 이미 있음 ${result.existing}`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('asset-ledger-import: 실패 —', error instanceof Error ? error.message : error);
  process.exit(1);
});
