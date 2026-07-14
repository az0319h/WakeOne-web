/**
 * Flex HR 30명 일회성 사용자 등록 (SQL 문서 없음 · service role 직접 실행)
 * Usage: node scripts/import-flex-users.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
    'import-flex-users: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
  );
  process.exit(1);
}

const INITIAL_USER_PASSWORD = '12341234a';

/** @type {Array<{ full_name: string; email: string; affiliation: string; rank: string; birthday: string; phone?: string }>} */
const USERS = [
  {
    full_name: '김각기',
    email: 'gkkim@wakecorp.com',
    affiliation: 'sans_foundry',
    rank: '오퍼레이터',
    birthday: '1990-03-16',
    phone: '01020446693'
  },
  {
    full_name: '김경훈',
    email: 'kykhkim@gmail.com',
    affiliation: 'wake',
    rank: 'CEO',
    birthday: '1990-08-26',
    phone: '01082613027'
  },
  {
    full_name: '김다은',
    email: 'dekim2@wakecorp.com',
    affiliation: 'wake',
    rank: '파트장',
    birthday: '1990-01-13',
    phone: '01026919238'
  },
  {
    full_name: '김도형',
    email: 'dhkim@wakecorp.com',
    affiliation: 'sans',
    rank: '선임매니저',
    birthday: '1990-09-10',
    phone: '01094499715'
  },
  {
    full_name: '김동은',
    email: 'dekim@wakecorp.com',
    affiliation: 'wake',
    rank: '파트장',
    birthday: '1990-05-10',
    phone: '01072042036'
  },
  {
    full_name: '김민정',
    email: 'mjkim@wakecorp.com',
    affiliation: 'wake',
    rank: '파트장',
    birthday: '1990-10-31',
    phone: '01062819861'
  },
  {
    full_name: '김아영',
    email: 'aykim@wakecorp.com',
    affiliation: 'wake',
    rank: '팀장',
    birthday: '1990-09-02',
    phone: '01022151212'
  },
  {
    full_name: '김영문',
    email: 'ymkim@wakecorp.com',
    affiliation: 'sans_foundry',
    rank: '팀장',
    birthday: '1990-06-29',
    phone: '01025365271'
  },
  {
    full_name: '김은비',
    email: 'ebkim@wakecorp.com',
    affiliation: 'wake',
    rank: '사원',
    birthday: '1990-04-26',
    phone: '01085817548'
  },
  {
    full_name: '김태린',
    email: 'tlkim@wakecorp.com',
    affiliation: 'wake',
    rank: '사원',
    birthday: '1990-12-13',
    phone: '01027072327'
  },
  {
    full_name: '김현정',
    email: 'hjkim@wakecorp.com',
    affiliation: 'wake',
    rank: '마케터',
    birthday: '1990-10-14',
    phone: '01057870636'
  },
  {
    full_name: '맹갑열',
    email: 'gymaeng@wakecorp.com',
    affiliation: 'sans_foundry',
    rank: '팀장',
    birthday: '1990-09-23',
    phone: '01093481245'
  },
  {
    full_name: '김도연',
    email: 'momo@wakecorp.com',
    affiliation: 'sans',
    rank: '점장',
    birthday: '1990-12-19',
    phone: '01020120826'
  },
  {
    full_name: '문현진',
    email: 'hjmoon@wakecorp.com',
    affiliation: 'wake',
    rank: '파트장',
    birthday: '1990-02-28',
    phone: '01033872127'
  },
  {
    full_name: '박선재',
    email: 'sjpark@wakecorp.com',
    affiliation: 'wake',
    rank: '팀장',
    birthday: '1990-04-12',
    phone: '01037757451'
  },
  {
    full_name: '백수진',
    email: 'sjbaek@wakecorp.com',
    affiliation: 'sans',
    rank: '부점장',
    birthday: '1990-02-28',
    phone: '01031431677'
  },
  {
    full_name: '유동욱',
    email: 'dwyu@wakecorp.com',
    affiliation: 'sans_foundry',
    rank: '공장장',
    birthday: '1990-07-17',
    phone: '01047669103'
  },
  {
    full_name: '이나겸',
    email: 'nakyummi@wakecorp.com',
    affiliation: 'sans',
    rank: '파티쉐',
    birthday: '1990-08-22',
    phone: '01072169274'
  },
  {
    full_name: '이재강',
    email: 'jklee@wakecorp.com',
    affiliation: 'sans',
    rank: '매니저',
    birthday: '1990-06-19',
    phone: '01063660061'
  },
  {
    full_name: '이준상',
    email: 'jslee@wakecorp.com',
    affiliation: 'wake',
    rank: 'COO',
    birthday: '1990-10-19',
    phone: '01086681019'
  },
  {
    full_name: '이혜빈',
    email: 'hblee@wakecorp.com',
    affiliation: 'wake',
    rank: '파트장',
    birthday: '1990-06-27',
    phone: '01035209405'
  },
  {
    full_name: '정다솜',
    email: 'dsjeong@wakecorp.com',
    affiliation: 'sans',
    rank: '매니저',
    birthday: '1990-12-22',
    phone: '01023177231'
  },
  {
    full_name: '정연재',
    email: 'yjchung@wakecorp.com',
    affiliation: 'wake',
    rank: '파트장',
    birthday: '1990-05-08',
    phone: '01076046206'
  },
  {
    full_name: '정진수',
    email: 'jsjeong@wakecorp.com',
    affiliation: 'sans_foundry',
    rank: '팀장',
    birthday: '1990-03-05',
    phone: '01091241483'
  },
  {
    full_name: '정진용',
    email: 'jyjeong@wakecorp.com',
    affiliation: 'sans_foundry',
    rank: '팀장',
    birthday: '1990-04-06',
    phone: '01024649091'
  },
  {
    full_name: '조서하',
    email: 'shcho@wakecorp.com',
    affiliation: 'sans',
    rank: '점장',
    birthday: '1990-12-21',
    phone: '01044548862'
  },
  {
    full_name: '한승우',
    email: 'swhan@wakecorp.com',
    affiliation: 'sans_foundry',
    rank: '팀장',
    birthday: '1990-10-01',
    phone: '01036842531'
  },
  {
    full_name: '홍성빈',
    email: 'sbhong@wakecorp.com',
    affiliation: 'wake',
    rank: '포토그래퍼',
    birthday: '1990-11-14',
    phone: '01098860887'
  },
  {
    full_name: '홍성훈',
    email: 'shhong@wakecorp.com',
    affiliation: 'wake',
    rank: '총무',
    birthday: '1990-03-19',
    phone: '01071230261'
  },
  {
    full_name: '홍윤의',
    email: 'yuhong@wakecorp.com',
    affiliation: 'wake',
    rank: '파트장',
    birthday: '1990-04-20',
    phone: '01087652296'
  }
];

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function createFlexUser(user) {
  const email = normalizeEmail(user.email);

  const { data: existingProfile, error: existingError } = await admin
    .from('profiles')
    .select('user_id, email')
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
      const result = await createFlexUser(user);
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

  console.log('import-flex-users: summary', JSON.stringify(results));

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('import-flex-users: unexpected error', error);
  process.exit(1);
});
