import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { gotoDashboard } from '../quick-workflow/helpers';
import { openDesktopPanel } from '../quick-info/helpers';
import { grepDir, readSource, SRC_ROOT } from './helpers';
import { AI_TEXT } from './100-helpers';

/**
 * plan 100 — 모드 무관 (OFF·ON 어느 서버에서도 같은 결과)
 * docs/plans/100_quick-chat-ai-reply-suggestions-plan.md — AC-11(ⓘ·처리방침) · AC-12(grep) + 색 grep 보조
 */
const AI_SERVER_FILE = 'src/features/quick-request/api/ai-suggest.server.ts';
const AI_FE_FILES = [
  'src/features/quick-request/components/chat/quick-chat-quick-replies.tsx',
  'src/features/quick-request/components/chat/quick-chat-ai-badge.tsx',
  'src/features/quick-request/components/chat/use-ai-suggestions.ts',
  'src/features/quick-request/components/chat/use-document-visible.ts'
];

function fileOf(hit: string): string {
  return hit.split(':')[0]!;
}

test.describe('plan 100 F. 안내 문구 · grep (AC-11 · AC-12)', () => {
  test('AC-11: user 퀵 ⓘ 「할 수 있는 일」에 「답장 추천: …외부 AI(Anthropic)…」 1줄', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      await gotoDashboard(page);
      const panel = await openDesktopPanel(page);
      await expect(panel.getByText(AI_TEXT.infoLine, { exact: true })).toHaveCount(1);
      await expect(panel.getByText(AI_TEXT.infoLine, { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AC-11: /privacy-policy 처리 위탁·국외 이전에 「Anthropic」·「답장 추천」', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await page.goto('/privacy-policy');
      await expect(page.getByRole('heading', { name: '개인정보처리방침', level: 1 })).toBeVisible();
      const item = page.getByRole('listitem').filter({ hasText: 'Anthropic, PBC' });
      await expect(item).toHaveCount(1);
      await expect(item).toContainText(/답장\s*문장\s*추천/);
      await expect(item.getByRole('link', { name: 'API 데이터 보존 정책' })).toHaveAttribute(
        'href',
        /^https:\/\/privacy\.claude\.com\//
      );
      await expect(page.getByText('시행일: 2026-10-28')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AC-12: 모델 ID claude-haiku-5-5는 ai-suggest.server.ts 1곳 · 날짜 접미사 0', () => {
    const modelHits = grepDir('src', 'claude-haiku-5-5');
    expect(modelHits.length).toBeGreaterThan(0);
    expect([...new Set(modelHits.map(fileOf))], modelHits.join('\n')).toEqual([AI_SERVER_FILE]);
    // 상수 정의는 1줄
    expect(modelHits.filter((hit) => /=\s*'claude-haiku-5-5'/.test(hit))).toHaveLength(1);
    expect(grepDir('src', 'claude-haiku-5-5-20')).toEqual([]);
    expect(grepDir('src', /claude-haiku-5-5-\d/)).toEqual([]);
  });

  test('AC-12: ANTHROPIC_API_KEY는 서버 파일만 · NEXT_PUBLIC_ANTHROPIC 0 · SDK import는 server-only 모듈만', () => {
    const keyHits = grepDir('src', 'ANTHROPIC_API_KEY');
    expect(keyHits.length).toBeGreaterThan(0);
    expect([...new Set(keyHits.map(fileOf))], keyHits.join('\n')).toEqual([AI_SERVER_FILE]);
    expect(readSource(AI_SERVER_FILE)).toMatch(/^import 'server-only';/m);

    expect(grepDir('src', 'NEXT_PUBLIC_ANTHROPIC')).toEqual([]);
    expect(readSource('next.config.ts')).not.toContain('NEXT_PUBLIC_ANTHROPIC');
    expect(readSource('env.example.txt')).not.toContain('NEXT_PUBLIC_ANTHROPIC');

    const sdkImports = grepDir('src', /from ['"]@anthropic-ai\/sdk['"]/);
    expect([...new Set(sdkImports.map(fileOf))], sdkImports.join('\n')).toEqual([AI_SERVER_FILE]);

    // ai-suggest.server를 import하는 파일은 client 컴포넌트가 아니다
    const importers = grepDir('src', /from ['"][^'"]*ai-suggest\.server['"]/);
    expect(importers.length).toBeGreaterThan(0);
    for (const hit of importers) {
      const source = fs.readFileSync(path.join(SRC_ROOT, fileOf(hit)), 'utf8');
      expect(/^['"]use client['"]/m.test(source), `${fileOf(hit)} 는 client 컴포넌트가 아니어야 한다`).toBe(false);
    }
  });

  test('보조(grep): 칩·배지·훅 파일 — #hex·rgb()/hsl()/oklch()·Tailwind 팔레트 색 0 · @tabler 직접 import 0 · window.confirm 0', () => {
    const palette =
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
    for (const file of AI_FE_FILES) {
      const lines = readSource(file).split(/\r?\n/);
      lines.forEach((line, index) => {
        const where = `${file}:${index + 1}: ${line.trim()}`;
        expect(/#[0-9a-fA-F]{3,8}\b/.test(line), where).toBe(false);
        expect(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/.test(line), where).toBe(false);
        expect(palette.test(line), where).toBe(false);
        expect(line.includes('@tabler'), where).toBe(false);
        expect(/window\.confirm|\bconfirm\(/.test(line), where).toBe(false);
      });
    }
  });
});
