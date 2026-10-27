import { execSync } from 'node:child_process';
import path from 'node:path';

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
}
