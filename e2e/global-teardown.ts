import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalTeardown() {
  if (process.env.E2E_SKIP_CLEANUP === '1') {
    console.warn('E2E_SKIP_CLEANUP=1 — skipping remote mock data cleanup.');
    return;
  }

  const cleanupScript = path.join(
    process.cwd(),
    'scripts',
    'cleanup-e2e-mock-data.mjs'
  );

  try {
    execSync(`node "${cleanupScript}"`, {
      stdio: 'inherit',
      env: process.env
    });
  } catch (error) {
    throw new Error(
      'E2E mock data cleanup failed after test run. Fix scripts/cleanup-e2e-mock-data.mjs or apply supabase/sql/27_e2e_cleanup_rpc.sql.'
    );
  }
}
