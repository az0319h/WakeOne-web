/**
 * Plan 03 E2E 사전 준비: 테스트 계정 active + 비밀번호·ban 복구
 * Usage: node scripts/e2e-plan03-prep.cjs
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const env = {};
fs.readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const E2E_USER_ID = 'f908749c-601d-4f53-8921-6b503783dc8b';

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targets = [
    { email: env.E2E_ADMIN_EMAIL, password: env.E2E_ADMIN_PASSWORD },
  { email: env.E2E_USER_EMAIL, password: env.E2E_USER_PASSWORD, userId: E2E_USER_ID },
  { email: env.E2E_USER2_EMAIL, password: env.E2E_USER2_PASSWORD }
  ];

  for (const t of targets) {
    const user = users.users.find((u) => u.email === t.email);
    if (!user) {
      console.warn(`skip: ${t.email} not found`);
      continue;
    }
    const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
      password: t.password,
      ban_duration: 'none'
    });
    if (authErr) {
      console.error(`auth reset failed ${t.email}:`, authErr.message);
      process.exitCode = 1;
      continue;
    }
    const uid = t.userId ?? user.id;
    const { error: profileErr } = await admin
      .from('profiles')
      .update({ status: 'active', deactivated_at: null })
      .eq('user_id', uid);
    if (profileErr) {
      console.error(`profile reset failed ${t.email}:`, profileErr.message);
      process.exitCode = 1;
    } else {
      console.log(`ok: ${t.email}`);
    }
  }
}

main();
