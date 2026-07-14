/**
 * Slack 대조 후 누락 사용자 2명 일회성 등록
 * Usage: node scripts/invite-pending-users.mjs
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
    'invite-pending-users: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
  );
  process.exit(1);
}

const INITIAL_USER_PASSWORD = '12341234a';

/** @type {Array<{ full_name: string; email: string; affiliation: string; rank: string; birthday: string; phone?: string }>} */
const USERS = [
  {
    full_name: '김경훈',
    email: 'kykhkim@wakecorp.com',
    affiliation: 'wake',
    rank: 'CEO',
    birthday: '1990-08-26',
    phone: '01082613027'
  },
  {
    full_name: '김주원',
    email: 'jwkim@wakecorp.com',
    affiliation: 'wake',
    rank: '대리',
    birthday: '1990-01-01',
    phone: '01075724029'
  }
];

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function createUser(user) {
  const email = normalizeEmail(user.email);

  const { data: existingProfile, error: existingError } = await admin
    .from('profiles')
    .select('user_id, email, status')
    .ilike('email', email)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingProfile) {
    return { status: 'skipped', email, reason: 'already_exists' };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: INITIAL_USER_PASSWORD,
    email_confirm: true
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? 'auth create failed');
  }

  const userId = data.user.id;
  const profilePatch = {
    email,
    full_name: user.full_name,
    affiliation: user.affiliation,
    rank: user.rank,
    system_role: 'user',
    birthday: user.birthday,
    status: 'active',
    deactivated_at: null,
    password_set_at: new Date().toISOString(),
    ...(user.phone ? { phone: user.phone } : {})
  };

  const { error: profileError } = await admin
    .from('profiles')
    .update(profilePatch)
    .eq('user_id', userId);

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  return { status: 'created', email, userId };
}

async function main() {
  const results = { created: 0, skipped: 0, failed: [] };

  for (const user of USERS) {
    try {
      const result = await createUser(user);
      if (result.status === 'created') {
        results.created += 1;
        console.log(`[created] ${user.full_name} <${result.email}>`);
      } else {
        results.skipped += 1;
        console.log(`[skipped] ${user.full_name} <${result.email}> (${result.reason})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.failed.push({ full_name: user.full_name, email: user.email, message });
      console.error(`[failed] ${user.full_name} <${user.email}>: ${message}`);
    }
  }

  console.log('invite-pending-users: summary', JSON.stringify(results));

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('invite-pending-users: unexpected error', error);
  process.exit(1);
});
