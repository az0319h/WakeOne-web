/**
 * Playwright globalTeardown · verifier Step 7 — 원격 Supabase E2E 목 데이터 삭제
 * Usage: node scripts/cleanup-e2e-mock-data.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * RPC: public.cleanup_e2e_mock_data() (supabase/sql/36_e2e_cleanup_rpc_extend.sql)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'cleanup-e2e-mock-data: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data, error } = await admin.rpc('cleanup_e2e_mock_data');

  if (error) {
    console.error('cleanup-e2e-mock-data: RPC failed:', error.message);
    console.error(
      'Apply supabase/sql/36_e2e_cleanup_rpc_extend.sql to the remote project, then retry.'
    );
    process.exit(1);
  }

  console.log('cleanup-e2e-mock-data: result', JSON.stringify(data));

  const remaining = data?.remaining ?? {};
  if (
    (remaining.contracts ?? 0) > 0 ||
    (remaining.reminder_runs ?? 0) > 0 ||
    (remaining.users ?? 0) > 0 ||
    (remaining.activity_logs_e2e ?? 0) > 0
  ) {
    console.error('cleanup-e2e-mock-data: mock data still remains.', remaining);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('cleanup-e2e-mock-data: unexpected error', error);
  process.exit(1);
});
