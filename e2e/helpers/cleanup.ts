import { execSync } from 'node:child_process';

/**
 * Playwright afterAll·수동 검증 직후 원격 E2E 목 데이터 정리.
 * globalTeardown과 동일 RPC — spec 단위 보완용.
 */
export function cleanupE2eMockData() {
  execSync('node scripts/cleanup-e2e-mock-data.mjs', {
    stdio: 'inherit',
    env: process.env
  });
}
