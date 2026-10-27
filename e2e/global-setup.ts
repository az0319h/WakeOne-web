import { execSync } from 'node:child_process';
import path from 'node:path';
import { startOpenchatMockServer } from './helpers/openchat-mock';

/** plan 89 — 퀵 계열 run(또는 E2E_OPENCHAT_MOCK=1)이면 오픈채팅 webhook mock(127.0.0.1:4599)을 띄운다 */
function shouldStartOpenchatMock() {
  if (process.env.E2E_OPENCHAT_MOCK === '1') return true;
  return process.argv.some((arg) => {
    const normalized = arg.replace(/\\/g, '/');
    return (
      normalized.includes('e2e/quick-workflow') ||
      normalized.includes('e2e/quick-request') ||
      normalized.includes('e2e/quick-info')
    );
  });
}

export default async function globalSetup() {
  const prepScript = path.join(process.cwd(), 'scripts', 'e2e-plan03-prep.cjs');

  try {
    execSync(`node "${prepScript}"`, {
      stdio: 'inherit',
      env: process.env
    });
  } catch {
    throw new Error(
      'E2E account prep failed. Check E2E_* credentials in .env and scripts/e2e-plan03-prep.cjs.'
    );
  }

  if (!shouldStartOpenchatMock()) {
    return undefined;
  }

  const server = await startOpenchatMockServer();
  return async () => {
    await new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
  };
}
