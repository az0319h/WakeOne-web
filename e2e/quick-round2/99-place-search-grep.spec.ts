import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { grepDir, readSource, SRC_ROOT } from './helpers';

/**
 * plan 99 — grep 유형 (verifier CLI grep과 같은 기준을 Node fs로 판정)
 * - AC-11: 키·외부 endpoint는 서버 파일(`*.server.ts`·Route)에만 · `NEXT_PUBLIC_KAKAO` 0 · env.example 키 이름 1줄
 *          + 서버 전용 모듈(`places.server`)을 client 컴포넌트가 import하지 않음
 * - AC-13(grep 부분): 장소 탭·Dialog 파일에 하드코딩 색(#hex·rgb/hsl/oklch 리터럴·Tailwind 팔레트 색) 0 · `@tabler` 직접 import 0
 */
const PLACE_TAB = 'src/features/quick-request/components/quick-request-place-search-tab.tsx';
const PICKER_DIALOG = 'src/features/quick-request/components/quick-request-address-picker-dialog.tsx';
const LOCATION_SECTION = 'src/features/quick-request/components/quick-request-location-section.tsx';

/** `*.server.ts` 또는 App Router Route Handler(`route.ts`) */
function isServerFile(hit: string): boolean {
  const file = hit.split(':')[0]!;
  return file.endsWith('.server.ts') || /(^|\/)route\.ts$/.test(file);
}

test.describe('plan 99 C. grep (AC-11 · AC-13)', () => {
  test('AC-11: KAKAO_REST_API_KEY · dapi.kakao.com → 서버 파일(*.server.ts·Route)에만', () => {
    const keyHits = grepDir('src', 'KAKAO_REST_API_KEY');
    expect(keyHits.length, 'KAKAO_REST_API_KEY 사용처').toBeGreaterThan(0);
    expect(keyHits.filter((hit) => !isServerFile(hit)), keyHits.join('\n')).toEqual([]);

    const endpointHits = grepDir('src', 'dapi.kakao.com');
    expect(endpointHits.length, 'dapi.kakao.com 사용처').toBeGreaterThan(0);
    expect(endpointHits.filter((hit) => !isServerFile(hit)), endpointHits.join('\n')).toEqual([]);

    // 서버 전용 모듈은 server-only로 막혀 있어야 한다
    expect(readSource('src/features/quick-request/api/places.server.ts')).toMatch(/^import 'server-only';/m);
  });

  test('AC-11: NEXT_PUBLIC_KAKAO 0건 (src · next.config · env.example) · env.example.txt에 KAKAO_REST_API_KEY 1줄', () => {
    expect(grepDir('src', 'NEXT_PUBLIC_KAKAO')).toEqual([]);
    expect(readSource('next.config.ts')).not.toContain('NEXT_PUBLIC_KAKAO');
    const envExample = readSource('env.example.txt');
    expect(envExample).not.toContain('NEXT_PUBLIC_KAKAO');
    const keyLines = envExample.split(/\r?\n/).filter((line) => /^\s*KAKAO_REST_API_KEY=/.test(line));
    expect(keyLines, 'env.example.txt 키 이름 줄').toHaveLength(1);
    expect(keyLines[0]!.trim(), '값 없음').toBe('KAKAO_REST_API_KEY=');
  });

  test("AC-11: places.server import는 서버 파일만 ('use client' 파일 0)", () => {
    const importers = grepDir('src', /from ['"][^'"]*places\.server['"]/);
    expect(importers.length).toBeGreaterThan(0);
    for (const hit of importers) {
      const file = hit.split(':')[0]!;
      const source = fs.readFileSync(path.join(SRC_ROOT, file), 'utf8');
      expect(/^['"]use client['"]/m.test(source), `${file} 는 client 컴포넌트가 아니어야 한다`).toBe(false);
    }
  });

  test('AC-13(grep): 장소 탭·Dialog·채움 파일 — #hex·rgb()/hsl()/oklch() 리터럴·Tailwind 팔레트 색 0 · @tabler 직접 import 0', () => {
    const palette =
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
    for (const file of [PLACE_TAB, PICKER_DIALOG, LOCATION_SECTION]) {
      const lines = readSource(file).split(/\r?\n/);
      const offenders = lines
        .map((line, index) => ({ line, index: index + 1 }))
        .filter(
          ({ line }) =>
            /#[0-9a-fA-F]{3,8}\b/.test(line) ||
            /\b(?:rgb|rgba|hsl|hsla|oklch)\(/.test(line) ||
            palette.test(line) ||
            /@tabler\/icons-react/.test(line)
        )
        .map(({ line, index }) => `${file}:${index}: ${line.trim()}`);
      expect(offenders, offenders.join('\n')).toEqual([]);
    }
  });
});
