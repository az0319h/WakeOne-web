import { expect, test } from '@playwright/test';
import { grepDir, readSource } from './helpers';

/**
 * plan 98 AC-20 — grep 유형 (verifier CLI grep과 같은 기준을 Node fs로 판정)
 * - chat 컴포넌트: `window.confirm` · `rounded-[` · `bg-green-` · `backdrop-blur` · `next/image` · `@tabler/icons-react` 0
 * - prepare·DELETE Route: 모든 `return`이 로그 경유(`logger.respond` · `logQuickRequestAuthFailure` · `loaded.response`)
 * - url·download GET Route: `recordActivityLog`·`logger.respond` 없음 (Read → Out)
 * - 날짜·시각: feature별 포맷터 없음 · 상대 시각 없음
 */
const CHAT_DIR = 'src/features/quick-request/components/chat';
const ATTACH_ROUTES = 'src/app/api/quick-request/[requestNo]/messages/attachments';
const PREPARE_ROUTE = `${ATTACH_ROUTES}/prepare/route.ts`;
const DELETE_ROUTE = `${ATTACH_ROUTES}/[attachmentId]/route.ts`;
const URL_ROUTE = `${ATTACH_ROUTES}/[attachmentId]/url/route.ts`;
const DOWNLOAD_ROUTE = `${ATTACH_ROUTES}/[attachmentId]/download/route.ts`;

test.describe('plan 98 C. grep (AC-20)', () => {
  test('AC-20: chat 컴포넌트 — window.confirm · rounded-[ · bg-green- · backdrop-blur · next/image · @tabler 직접 import 0', () => {
    expect(grepDir(CHAT_DIR, /window\.confirm|[^a-zA-Z_.]confirm\(/)).toEqual([]);
    expect(grepDir(CHAT_DIR, 'rounded-[')).toEqual([]);
    expect(grepDir(CHAT_DIR, 'bg-green-')).toEqual([]);
    expect(grepDir(CHAT_DIR, 'backdrop-blur')).toEqual([]);
    expect(grepDir(CHAT_DIR, "from 'next/image'")).toEqual([]);
    expect(grepDir(CHAT_DIR, '@tabler/icons-react')).toEqual([]);
    expect(grepDir('src/features/quick-request/lib', 'window.confirm')).toEqual([]);
  });

  test('AC-20: prepare·DELETE Route — 모든 return이 recordActivityLog(jsonWithActivityLog) 경유', () => {
    for (const file of [PREPARE_ROUTE, DELETE_ROUTE]) {
      const source = readSource(file);
      const returns = source
        .split(/\r?\n/)
        .map((line, index) => ({ line: line.trim(), index: index + 1 }))
        .filter(({ line }) => /^return\b/.test(line));
      expect(returns.length, `${file} return 분기`).toBeGreaterThan(5);
      for (const { line, index } of returns) {
        expect(
          /logger\.respond\(|logQuickRequestAuthFailure\(|loaded\.response/.test(line),
          `${file}:${index} ${line}`
        ).toBe(true);
      }
      expect(source).toContain('createQuickRouteLogger');
      expect(source).not.toContain('NextResponse.json(');
    }
    // `createQuickRouteLogger.respond` → jsonWithActivityLog → recordActivityLog
    const utils = readSource('src/app/api/quick-request/_utils.ts');
    expect(utils).toMatch(/jsonWithActivityLog|recordActivityLog/);
  });

  test('AC-20: url·download GET Route — Read → 활동 로그 미기록', () => {
    for (const file of [URL_ROUTE, DOWNLOAD_ROUTE]) {
      const source = readSource(file);
      expect(source).not.toContain('recordActivityLog');
      expect(source).not.toContain('jsonWithActivityLog');
      expect(source).not.toContain('createQuickRouteLogger');
      expect(source).toContain('export async function GET');
      expect(source).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    }
  });

  test('AC-20: 로그 metadata에 파일명·storage_path·서명 URL 키 없음 (prepare·DELETE·messages Route)', () => {
    for (const file of [PREPARE_ROUTE, DELETE_ROUTE, 'src/app/api/quick-request/[requestNo]/messages/route.ts']) {
      const source = readSource(file);
      expect(source, `${file} file_name`).not.toMatch(/file_name\s*:/);
      expect(source, `${file} storage_path`).not.toMatch(/storage_path\s*:/);
      expect(source, `${file} uploadUrl`).not.toMatch(/upload_url\s*:|signed_url\s*:/);
    }
  });

  test('AC-20: 날짜·시각 — chat 컴포넌트는 @/lib/format-datetime 단일 포맷터 · 상대 시각 0', () => {
    expect(grepDir(CHAT_DIR, /toLocaleDateString|toLocaleTimeString|toLocaleString\(/)).toEqual([]);
    expect(grepDir(CHAT_DIR, /formatRelativeTimeKo|방금 전|분 전|시간 전|일 전/)).toEqual([]);
    expect(grepDir(CHAT_DIR, /function format[A-Za-z]*Date(Time)?\(/)).toEqual([]);
    expect(grepDir(CHAT_DIR, 'formatAbsoluteDateTimeKo').length).toBeGreaterThan(0);
  });
});
