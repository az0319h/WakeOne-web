import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * plan 106 grep AC — AC-40(짧은 시각 함수 1곳 · 퀵 feature date-fns 직접 import 0 · core-conventions 예외 1줄)
 * · AC-53(ui 변경 0 · window.confirm 0 · 86 AC-20 금지 패턴 0) · AC-52 보조(신규 action 0)
 * docs/plans/106_quick-mobile-restructure-plan.md
 */
const ROOT = process.cwd();

function walk(dir: string, filter: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

const SRC_FILES = walk(path.join(ROOT, 'src'), (file) => /\.(ts|tsx)$/.test(file));
const rel = (file: string) => path.relative(ROOT, file);

function changedFiles(): string[] {
  const tracked = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  const untracked = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  return [...tracked, ...untracked].map((line) => line.trim()).filter(Boolean);
}

test.describe('plan 106 grep · 정적 검사', () => {
  test('AC-40: formatChatBubbleTimeKo·formatChatListTimeKo 정의 1곳(src/lib/format-datetime.ts) · 퀵 feature date-fns 직접 import 0 · core-conventions 「퀵 대화 예외」 · 상세·이력 절대 시각 유지', () => {
    const definitions = SRC_FILES.filter((file) =>
      /export\s+function\s+(formatChatBubbleTimeKo|formatChatListTimeKo)\b/.test(fs.readFileSync(file, 'utf8'))
    ).map(rel);
    expect(definitions).toEqual(['src/lib/format-datetime.ts']);
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/format-datetime.ts'), 'utf8');
    expect(source).toMatch(/export function formatChatBubbleTimeKo/);
    expect(source).toMatch(/export function formatChatListTimeKo/);

    const quickDateFns = SRC_FILES.filter((file) => file.includes(`${path.sep}features${path.sep}quick-request${path.sep}`))
      // plan AC-40 grep 그대로 `from 'date-fns'`(포맷 함수) — Calendar 한국어 locale(`date-fns/locale`)은 plan 97부터 있던 것으로 대상 아님
      .filter((file) => /from ['"]date-fns['"]/.test(fs.readFileSync(file, 'utf8')))
      .map(rel);
    expect(quickDateFns, quickDateFns.join(', ')).toEqual([]);

    const rules = fs.readFileSync(path.join(ROOT, '.cursor/rules/core-conventions.mdc'), 'utf8');
    expect(rules).toContain('퀵 대화 예외');

    for (const file of [
      'src/features/quick-request/components/detail/quick-request-history.tsx',
      'src/features/quick-request/components/detail/quick-request-stepper.tsx',
      'src/features/quick-request/components/dashboard/quick-request-mobile-card.tsx'
    ]) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(text, `${file} 절대 시각`).toContain('formatAbsoluteDateTimeKo');
      expect(text, `${file} 짧은 시각 사용 0`).not.toMatch(/formatChat(Bubble|List)TimeKo/);
    }
  });

  test('AC-53: src/components/ui 변경 0 · window.confirm 0 · 신규·수정 퀵 파일 금지 패턴(#hex·kq-·bg-white·text-black·rounded-[·shadow-[) 0', () => {
    const uiDiff = execSync('git diff --stat HEAD -- src/components/ui', { cwd: ROOT, encoding: 'utf8' }).trim();
    const uiUntracked = execSync('git ls-files --others --exclude-standard -- src/components/ui', { cwd: ROOT, encoding: 'utf8' }).trim();
    expect(uiDiff, uiDiff).toBe('');
    expect(uiUntracked, uiUntracked).toBe('');

    const confirms = SRC_FILES.filter((file) => /window\.confirm\s*\(/.test(fs.readFileSync(file, 'utf8'))).map(rel);
    expect(confirms, confirms.join(', ')).toEqual([]);

    const quickChanged = changedFiles().filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) &&
        (file.startsWith('src/features/quick-request/') || file.startsWith('src/app/dashboard/quick/')) &&
        !file.includes('__tests__') &&
        fs.existsSync(path.join(ROOT, file))
    );
    expect(quickChanged.length, '신규·수정 퀵 파일').toBeGreaterThan(10);
    const offenders: string[] = [];
    for (const file of quickChanged) {
      fs.readFileSync(path.join(ROOT, file), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (
            /(?<![\w&])#[0-9a-fA-F]{3,8}\b/.test(line) ||
            /\bkq-/.test(line) ||
            /\bbg-white\b/.test(line) ||
            /\btext-black\b/.test(line) ||
            line.includes('rounded-[') ||
            line.includes('shadow-[')
          ) {
            offenders.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  test('AC-52 보조: 신규 activity action 0 — labels.ts 추가 줄에 quick_request.* 0', () => {
    const added = execSync('git diff HEAD -- src/features/activity-logs/labels.ts src/features/activity-logs/api/types.ts', {
      cwd: ROOT,
      encoding: 'utf8'
    })
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++') && line.includes('quick_request.'));
    expect(added, added.join('\n')).toEqual([]);
  });
});
