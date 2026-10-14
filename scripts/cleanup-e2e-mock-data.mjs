/**
 * Playwright globalTeardown · verifier Step 7 — 원격 Supabase E2E 목 데이터 삭제
 * Usage: node scripts/cleanup-e2e-mock-data.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * RPC: public.cleanup_e2e_mock_data() (supabase/sql/82_e2e_cleanup_preserve_fixture_real_data.sql)
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

const TEST_DOCUMENT_PATTERN = /^(AC|E2E|PV|P28|P29|ATT|KBAR)/;

async function removeStorageObjects(bucket, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  for (let offset = 0; offset < uniquePaths.length; offset += 100) {
    const batch = uniquePaths.slice(offset, offset + 100);
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (error) {
      throw new Error(`${bucket} storage cleanup failed: ${error.message}`);
    }
  }
  return uniquePaths.length;
}

async function listStorageFiles(bucket, prefix = '') {
  const files = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' }
    });
    if (error) {
      throw new Error(`${bucket} storage list failed: ${error.message}`);
    }

    for (const entry of data ?? []) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        files.push(entryPath);
      } else {
        files.push(...(await listStorageFiles(bucket, entryPath)));
      }
    }

    if ((data ?? []).length < pageSize) {
      break;
    }
  }

  return files;
}

async function listReferencedStoragePaths(table) {
  const paths = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select('storage_path')
      .not('storage_path', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`${table} storage reference lookup failed: ${error.message}`);
    }

    paths.push(...(data ?? []).map(({ storage_path }) => storage_path));
    if ((data ?? []).length < pageSize) {
      break;
    }
  }

  return new Set(paths);
}

async function cleanupOrphanStorage(bucket, table) {
  const [files, referencedPaths] = await Promise.all([
    listStorageFiles(bucket),
    listReferencedStoragePaths(table)
  ]);
  const orphanPaths = files.filter((storagePath) => !referencedPaths.has(storagePath));
  return removeStorageObjects(bucket, orphanPaths);
}

async function countOrphanStorage(bucket, table) {
  const [files, referencedPaths] = await Promise.all([
    listStorageFiles(bucket),
    listReferencedStoragePaths(table)
  ]);
  return files.filter((storagePath) => !referencedPaths.has(storagePath)).length;
}

async function cleanupE2eStorage() {
  const { data: announcements, error: announcementsError } = await admin
    .from('announcements')
    .select('id')
    .ilike('title', 'E2E-ANN-%');
  if (announcementsError) {
    throw new Error(`E2E announcement lookup failed: ${announcementsError.message}`);
  }

  const announcementIds = (announcements ?? []).map(({ id }) => id);
  let announcementPaths = [];
  if (announcementIds.length > 0) {
    const { data, error } = await admin
      .from('announcement_attachments')
      .select('storage_path')
      .in('announcement_id', announcementIds);
    if (error) {
      throw new Error(`E2E announcement attachment lookup failed: ${error.message}`);
    }
    announcementPaths = (data ?? []).map(({ storage_path }) => storage_path);
  }

  const { data: contracts, error: contractsError } = await admin
    .from('contract_documents')
    .select('id, document_number, author_name, author_email, contract_target');
  if (contractsError) {
    throw new Error(`E2E contract lookup failed: ${contractsError.message}`);
  }

  const contractIds = (contracts ?? [])
    .filter(
      ({ document_number, author_name, author_email, contract_target }) =>
        TEST_DOCUMENT_PATTERN.test(document_number ?? '') ||
        author_name === 'E2E 작성자' ||
        author_email === 'e2e@test.local' ||
        contract_target === 'E2E 계약대상'
    )
    .map(({ id }) => id);
  let contractPaths = [];
  if (contractIds.length > 0) {
    const { data, error } = await admin
      .from('contract_attachments')
      .select('storage_path')
      .in('contract_id', contractIds);
    if (error) {
      throw new Error(`E2E contract attachment lookup failed: ${error.message}`);
    }
    contractPaths = (data ?? []).map(({ storage_path }) => storage_path);
  }

  return {
    announcement_objects: await removeStorageObjects(
      'announcement-attachments',
      announcementPaths
    ),
    contract_objects: await removeStorageObjects('contract-attachments', contractPaths),
    announcement_orphans: await cleanupOrphanStorage(
      'announcement-attachments',
      'announcement_attachments'
    ),
    contract_orphans: await cleanupOrphanStorage(
      'contract-attachments',
      'contract_attachments'
    )
  };
}

async function countAttContracts() {
  const { count, error } = await admin
    .from('contract_documents')
    .select('*', { count: 'exact', head: true })
    .like('document_number', 'ATT-%');

  if (error) {
    throw new Error(`ATT contract count failed: ${error.message}`);
  }

  return count ?? 0;
}

async function countE2eAuthorContracts() {
  const { count, error } = await admin
    .from('contract_documents')
    .select('*', { count: 'exact', head: true })
    .or(
      'author_name.eq.E2E 작성자,author_email.eq.e2e@test.local,contract_target.eq.E2E 계약대상'
    );

  if (error) {
    throw new Error(`E2E author contract count failed: ${error.message}`);
  }

  return count ?? 0;
}

async function verifyNoOrphanContracts() {
  const [attContracts, e2eAuthorContracts] = await Promise.all([
    countAttContracts(),
    countE2eAuthorContracts()
  ]);

  if (attContracts > 0 || e2eAuthorContracts > 0) {
    console.error('cleanup-e2e-mock-data: orphan contracts remain after RPC.', {
      att_contracts: attContracts,
      e2e_author_contracts: e2eAuthorContracts
    });
    process.exit(1);
  }
}

async function verifyNoOrphanStorage() {
  const [announcementOrphans, contractOrphans] = await Promise.all([
    countOrphanStorage('announcement-attachments', 'announcement_attachments'),
    countOrphanStorage('contract-attachments', 'contract_attachments')
  ]);
  const remaining = {
    announcement_orphans: announcementOrphans,
    contract_orphans: contractOrphans
  };

  console.log('cleanup-e2e-mock-data: storage remaining', remaining);
  if (announcementOrphans > 0 || contractOrphans > 0) {
    throw new Error(`storage orphans remain after cleanup: ${JSON.stringify(remaining)}`);
  }
}

const E2E_GOOGLE_TASKS_MOCK_EMAIL = 'e2e-mock@gmail.com';

async function cleanupGoogleTasksMockConnections() {
  const { error } = await admin
    .from('google_tasks_connections')
    .delete()
    .eq('google_email', E2E_GOOGLE_TASKS_MOCK_EMAIL);

  if (error) {
    throw new Error(`Google Tasks mock connection cleanup failed: ${error.message}`);
  }
}

async function resetFixtureProfiles() {
  const { data, error } = await admin.rpc('reset_e2e_fixture_profiles');
  if (error) {
    throw new Error(`fixture profile reset failed: ${error.message}`);
  }

  const remaining = data?.remaining ?? {};
  console.log('cleanup-e2e-mock-data: fixture profiles', remaining);
  if (Object.values(remaining).some((value) => Number(value) > 0)) {
    throw new Error(`fixture profile contamination remains: ${JSON.stringify(remaining)}`);
  }
}

async function main() {
  const beforeAtt = await countAttContracts();
  const beforeE2eAuthor = await countE2eAuthorContracts();
  console.log('cleanup-e2e-mock-data: before', {
    att_contracts: beforeAtt,
    e2e_author_contracts: beforeE2eAuthor
  });

  const storageDeleted = await cleanupE2eStorage();
  console.log('cleanup-e2e-mock-data: storage', storageDeleted);

  await cleanupGoogleTasksMockConnections();

  const { data, error } = await admin.rpc('cleanup_e2e_mock_data');

  if (error) {
    console.error('cleanup-e2e-mock-data: RPC failed:', error.message);
    console.error(
      'Apply supabase/sql/41_e2e_cleanup_att_orphan.sql to the remote project, then retry.'
    );
    process.exit(1);
  }

  console.log('cleanup-e2e-mock-data: result', JSON.stringify(data));

  const remaining = data?.remaining ?? {};
  const nonZeroRemaining = Object.fromEntries(
    Object.entries(remaining).filter(([, value]) => Number(value) > 0)
  );
  if (Object.keys(nonZeroRemaining).length > 0) {
    console.error('cleanup-e2e-mock-data: mock data still remains.', remaining);
    process.exit(1);
  }

  await resetFixtureProfiles();
  await verifyNoOrphanContracts();
  await verifyNoOrphanStorage();

  const afterAtt = await countAttContracts();
  const afterE2eAuthor = await countE2eAuthorContracts();
  console.log('cleanup-e2e-mock-data: after', {
    att_contracts: afterAtt,
    e2e_author_contracts: afterE2eAuthor
  });
}

main().catch((error) => {
  console.error('cleanup-e2e-mock-data: unexpected error', error);
  process.exit(1);
});
