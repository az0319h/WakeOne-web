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

// plan 87 — 퀵 요청 특이사항 칩 · 최근 주소 (fixture 계정 e2e 산출물)
const FIXTURE_EMAILS = [
  ...new Set(
    [
      process.env.E2E_ADMIN_EMAIL,
      process.env.E2E_USER_EMAIL,
      process.env.E2E_USER2_EMAIL,
      'wakeone.ops@gmail.com',
      '1234@naver.com',
      '4321@naver.com'
    ].filter(Boolean)
  )
];
const QUICK_REQUEST_SEED_NOTE_LABEL = '동승 필요';
const E2E_LABEL_PATTERN = 'E2E%';

async function countRows(table, build) {
  const { count, error } = await build(
    admin.from(table).select('*', { count: 'exact', head: true })
  );
  if (error) {
    throw new Error(`${table} count failed: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * fixture 계정 칩을 seed 상태(「동승 필요」 + e2e 접두 칩 0개)로 되돌리고
 * e2e가 남긴 최근 주소(담당자 `E2E…`)를 지운다. RPC 수정 없이 service role로 처리한다.
 */
async function cleanupQuickRequestFixtures() {
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('user_id, email')
    .in('email', FIXTURE_EMAILS);
  if (profileError) {
    throw new Error(`fixture profile lookup failed: ${profileError.message}`);
  }
  const fixtureIds = (profiles ?? []).map(({ user_id }) => user_id);
  if (fixtureIds.length === 0) {
    console.log('cleanup-e2e-mock-data: quick request', { fixture_users: 0 });
    return;
  }

  const { data: deletedNotes, error: notesError } = await admin
    .from('quick_request_notes')
    .delete()
    .in('user_id', fixtureIds)
    .like('label', E2E_LABEL_PATTERN)
    .select('id');
  if (notesError) {
    throw new Error(`quick_request_notes cleanup failed: ${notesError.message}`);
  }

  const { data: seeded, error: seedLookupError } = await admin
    .from('quick_request_notes')
    .select('user_id')
    .in('user_id', fixtureIds)
    .eq('label', QUICK_REQUEST_SEED_NOTE_LABEL);
  if (seedLookupError) {
    throw new Error(`quick_request_notes seed lookup failed: ${seedLookupError.message}`);
  }
  const seededIds = new Set((seeded ?? []).map(({ user_id }) => user_id));
  const missingSeed = fixtureIds.filter((id) => !seededIds.has(id));
  if (missingSeed.length > 0) {
    const { error } = await admin.from('quick_request_notes').upsert(
      missingSeed.map((user_id) => ({ user_id, label: QUICK_REQUEST_SEED_NOTE_LABEL })),
      { onConflict: 'user_id,label', ignoreDuplicates: true }
    );
    if (error) {
      throw new Error(`quick_request_notes seed restore failed: ${error.message}`);
    }
  }

  const { data: deletedRecent, error: recentError } = await admin
    .from('quick_request_recent_addresses')
    .delete()
    .in('user_id', fixtureIds)
    .like('contact_name', E2E_LABEL_PATTERN)
    .select('id');
  if (recentError) {
    throw new Error(`quick_request_recent_addresses cleanup failed: ${recentError.message}`);
  }

  // plan 100 — fixture 계정의 AI 답장 추천 일일 사용량(e2e·스모크 산출물 · 일회용 계정 분은 auth.users cascade)
  const { data: deletedAiUsage, error: aiUsageError } = await admin
    .from('quick_chat_ai_usage')
    .delete()
    .in('user_id', fixtureIds)
    .select('user_id');
  if (aiUsageError) {
    throw new Error(`quick_chat_ai_usage cleanup failed: ${aiUsageError.message}`);
  }

  const remaining = {
    fixture_ai_usage: await countRows('quick_chat_ai_usage', (q) => q.in('user_id', fixtureIds)),
    fixture_e2e_notes: await countRows('quick_request_notes', (q) =>
      q.in('user_id', fixtureIds).like('label', E2E_LABEL_PATTERN)
    ),
    fixture_missing_seed:
      fixtureIds.length -
      (await countRows('quick_request_notes', (q) =>
        q.in('user_id', fixtureIds).eq('label', QUICK_REQUEST_SEED_NOTE_LABEL)
      )),
    fixture_e2e_recent_addresses: await countRows('quick_request_recent_addresses', (q) =>
      q.in('user_id', fixtureIds).like('contact_name', E2E_LABEL_PATTERN)
    )
  };

  console.log('cleanup-e2e-mock-data: quick request', {
    fixture_users: fixtureIds.length,
    deleted_notes: deletedNotes?.length ?? 0,
    restored_seed: missingSeed.length,
    deleted_recent_addresses: deletedRecent?.length ?? 0,
    deleted_ai_usage: deletedAiUsage?.length ?? 0,
    remaining
  });
  if (Object.values(remaining).some((value) => Number(value) > 0)) {
    throw new Error(`quick request fixture data remains: ${JSON.stringify(remaining)}`);
  }
}

// plan 88 — 워크플로우 e2e 산출물: `E2E-WF-` 표식 문서·임시저장·첨부(Storage 포함) + e2e가 바꾼 관리자·기본 결재선 원복
const WORKFLOW_MARKER = 'E2E-WF-';
const WORKFLOW_BUCKET = 'workflow-attachments';
// plan 98 — 퀵 대화 첨부 (비공개 버킷 · `quick-chat/{request_id}/{uuid}.{ext}`)
const QUICK_CHAT_BUCKET = 'quick-chat-attachments';
const QUICK_CHAT_ATTACHMENTS_TABLE = 'quick_request_message_attachments';
const WORKFLOW_TEMPLATE_DEFAULTS = { expense: { approval_step_edit_enabled: true } };

async function workflowFixtureUserIds() {
  const ids = new Set();
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('user_id')
    .in('email', FIXTURE_EMAILS);
  if (error) {
    throw new Error(`workflow fixture lookup failed: ${error.message}`);
  }
  (profiles ?? []).forEach(({ user_id }) => ids.add(user_id));

  const { data: disposable, error: disposableError } = await admin.rpc('e2e_disposable_user_ids');
  if (disposableError) {
    throw new Error(`workflow disposable lookup failed: ${disposableError.message}`);
  }
  for (const row of disposable ?? []) {
    const id = typeof row === 'string' ? row : row?.e2e_disposable_user_ids ?? Object.values(row ?? {})[0];
    if (typeof id === 'string') ids.add(id);
  }
  return [...ids];
}

async function workflowStorageUnderUsers(userIds) {
  const files = [];
  for (const userId of userIds) {
    files.push(...(await listStorageFiles(WORKFLOW_BUCKET, `staged/${userId}`)));
  }
  return files;
}

async function cleanupWorkflowFixtures() {
  const userIds = await workflowFixtureUserIds();

  // 1) 표식 문서 + e2e 일회용 계정이 작성한 문서
  const docIds = new Set();
  const { data: markedDocs, error: markedError } = await admin
    .from('workflow_documents')
    .select('id')
    .ilike('search_text', `%${WORKFLOW_MARKER}%`);
  if (markedError) {
    throw new Error(`workflow marked documents lookup failed: ${markedError.message}`);
  }
  (markedDocs ?? []).forEach(({ id }) => docIds.add(id));

  const { data: stableProfiles, error: stableError } = await admin
    .from('profiles')
    .select('user_id')
    .in('email', FIXTURE_EMAILS);
  if (stableError) {
    throw new Error(`workflow fixture lookup failed: ${stableError.message}`);
  }
  const stableIds = new Set((stableProfiles ?? []).map(({ user_id }) => user_id));
  const disposableIds = userIds.filter((id) => !stableIds.has(id));
  if (disposableIds.length > 0) {
    const { data: disposableDocs, error } = await admin
      .from('workflow_documents')
      .select('id')
      .in('writer_id', disposableIds);
    if (error) {
      throw new Error(`workflow disposable documents lookup failed: ${error.message}`);
    }
    (disposableDocs ?? []).forEach(({ id }) => docIds.add(id));
  }

  const docIdList = [...docIds];
  let removedDocObjects = 0;
  for (let offset = 0; offset < docIdList.length; offset += 100) {
    const batch = docIdList.slice(offset, offset + 100);
    const { data: attachments, error } = await admin
      .from('workflow_attachments')
      .select('storage_path')
      .in('document_id', batch);
    if (error) {
      throw new Error(`workflow attachment lookup failed: ${error.message}`);
    }
    removedDocObjects += await removeStorageObjects(
      WORKFLOW_BUCKET,
      (attachments ?? []).map(({ storage_path }) => storage_path)
    );

    const { error: notificationError } = await admin
      .from('notifications')
      .delete()
      .like('type', 'workflow.%')
      .in('metadata->>workflow_document_id', batch);
    if (notificationError) {
      throw new Error(`workflow notification cleanup failed: ${notificationError.message}`);
    }

    const { error: deleteError } = await admin.from('workflow_documents').delete().in('id', batch);
    if (deleteError) {
      throw new Error(`workflow document cleanup failed: ${deleteError.message}`);
    }
  }

  // 2) fixture·일회용 계정의 표식 임시저장 + 붙지 않은 staged 첨부
  let deletedDrafts = 0;
  let deletedStaged = 0;
  if (userIds.length > 0) {
    const { data: drafts, error: draftError } = await admin
      .from('workflow_drafts')
      .select('id, payload')
      .in('writer_id', userIds);
    if (draftError) {
      throw new Error(`workflow drafts lookup failed: ${draftError.message}`);
    }
    const markedDraftIds = (drafts ?? [])
      .filter(({ payload }) => JSON.stringify(payload ?? {}).includes(WORKFLOW_MARKER))
      .map(({ id }) => id);
    if (markedDraftIds.length > 0) {
      const { data: draftAttachments } = await admin
        .from('workflow_attachments')
        .select('storage_path')
        .in('draft_id', markedDraftIds);
      await removeStorageObjects(
        WORKFLOW_BUCKET,
        (draftAttachments ?? []).map(({ storage_path }) => storage_path)
      );
      const { error } = await admin.from('workflow_drafts').delete().in('id', markedDraftIds);
      if (error) {
        throw new Error(`workflow drafts cleanup failed: ${error.message}`);
      }
      deletedDrafts = markedDraftIds.length;
    }

    const { data: staged, error: stagedError } = await admin
      .from('workflow_attachments')
      .select('id, storage_path')
      .in('owner_user_id', userIds)
      .eq('status', 'staged')
      .is('draft_id', null);
    if (stagedError) {
      throw new Error(`workflow staged lookup failed: ${stagedError.message}`);
    }
    if ((staged ?? []).length > 0) {
      await removeStorageObjects(WORKFLOW_BUCKET, staged.map(({ storage_path }) => storage_path));
      const { error } = await admin
        .from('workflow_attachments')
        .delete()
        .in('id', staged.map(({ id }) => id));
      if (error) {
        throw new Error(`workflow staged cleanup failed: ${error.message}`);
      }
      deletedStaged = staged.length;
    }

    // DB 행이 없는 업로드 잔여 객체 (prepare 후 complete 전 실패 등)
    const { data: referenced } = await admin
      .from('workflow_attachments')
      .select('storage_path')
      .in('owner_user_id', userIds);
    const referencedPaths = new Set((referenced ?? []).map(({ storage_path }) => storage_path));
    const orphanFiles = (await workflowStorageUnderUsers(userIds)).filter(
      (storagePath) => !referencedPaths.has(storagePath)
    );
    await removeStorageObjects(WORKFLOW_BUCKET, orphanFiles);

    // 3) e2e가 지정한 워크플로우 관리자 · 기본 결재선 원복 (seed 초기값 = 비어 있음)
    const { error: adminsError } = await admin.from('workflow_admins').delete().in('user_id', userIds);
    if (adminsError) {
      throw new Error(`workflow admins cleanup failed: ${adminsError.message}`);
    }
    const { error: approversError } = await admin
      .from('workflow_template_default_approvers')
      .delete()
      .in('user_id', userIds);
    if (approversError) {
      throw new Error(`workflow default approvers cleanup failed: ${approversError.message}`);
    }
    const { error: referrersError } = await admin
      .from('workflow_template_default_referrers')
      .delete()
      .in('user_id', userIds);
    if (referrersError) {
      throw new Error(`workflow default referrers cleanup failed: ${referrersError.message}`);
    }
  }

  for (const [templateKey, defaults] of Object.entries(WORKFLOW_TEMPLATE_DEFAULTS)) {
    const { error } = await admin
      .from('workflow_templates')
      .update(defaults)
      .eq('template_key', templateKey);
    if (error) {
      throw new Error(`workflow template reset failed: ${error.message}`);
    }
  }

  const remaining = {
    marked_documents: await countRows('workflow_documents', (q) =>
      q.ilike('search_text', `%${WORKFLOW_MARKER}%`)
    ),
    fixture_admins: userIds.length
      ? await countRows('workflow_admins', (q) => q.in('user_id', userIds))
      : 0,
    fixture_default_approvers: userIds.length
      ? await countRows('workflow_template_default_approvers', (q) => q.in('user_id', userIds))
      : 0,
    fixture_default_referrers: userIds.length
      ? await countRows('workflow_template_default_referrers', (q) => q.in('user_id', userIds))
      : 0
  };

  console.log('cleanup-e2e-mock-data: workflow', {
    deleted_documents: docIdList.length,
    removed_document_objects: removedDocObjects,
    deleted_drafts: deletedDrafts,
    deleted_staged: deletedStaged,
    remaining
  });
  if (Object.values(remaining).some((value) => Number(value) > 0)) {
    throw new Error(`workflow e2e data remains: ${JSON.stringify(remaining)}`);
  }
}

// plan 89·92 — 퀵 업무 흐름 e2e 산출물 (quick_requests · 알림 · 연도 카운터)
// `quick_requests.requester_user_id`가 on delete restrict라 cleanup_e2e_mock_data RPC(일회용 사용자 삭제) 전에 지운다.
// 대상: 일회용 계정이 요청한 건 전부 + fixture 계정이 요청한 건 중 출발 담당자 `E2E…` 표식 건
async function quickWorkflowTargetRows(userIds, fixtureIds) {
  const rows = new Map();
  const collect = (data) => (data ?? []).forEach((row) => rows.set(row.id, row));

  for (let offset = 0; offset < userIds.length; offset += 100) {
    const batch = userIds.slice(offset, offset + 100);
    const { data, error } = await admin
      .from('quick_requests')
      .select('id, request_no, request_year, requester_user_id')
      .in('requester_user_id', batch);
    if (error) {
      throw new Error(`quick_requests disposable lookup failed: ${error.message}`);
    }
    collect(data);
  }
  if (fixtureIds.length > 0) {
    const { data, error } = await admin
      .from('quick_requests')
      .select('id, request_no, request_year, requester_user_id')
      .in('requester_user_id', fixtureIds)
      .like('origin->>contactName', E2E_LABEL_PATTERN);
    if (error) {
      throw new Error(`quick_requests fixture lookup failed: ${error.message}`);
    }
    collect(data);
  }
  return [...rows.values()];
}

/** plan 98 — 대상 건 폴더(`quick-chat/{request_id}/`)의 Storage 객체 목록 (list는 폴더 1단계 · 100건씩) */
async function listQuickChatStorageObjects(requestIds) {
  const paths = [];
  for (const requestId of requestIds) {
    const folder = `quick-chat/${requestId}`;
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from(QUICK_CHAT_BUCKET).list(folder, { limit: 100, offset });
      if (error) {
        throw new Error(`${QUICK_CHAT_BUCKET} storage list failed: ${error.message}`);
      }
      const files = (data ?? []).filter((item) => item.id);
      paths.push(...files.map((item) => `${folder}/${item.name}`));
      if ((data ?? []).length < 100) break;
      offset += 100;
    }
  }
  return paths;
}

async function countQuickChatStorageObjects(requestIds) {
  return (await listQuickChatStorageObjects(requestIds.slice(0, 100))).length;
}

/**
 * plan 98 — 퀵 대화 첨부 정리 (AC-22 `remaining 0`):
 *  a) 대상 건(`requestIds`)의 첨부 행(pending 포함) — storage_path 수집 후 삭제
 *  b) 일회용 계정(`uploaderIds`)이 올린 첨부 — 건 표식과 무관(94 D-12로 실데이터 건에도 올릴 수 있음)
 *  c) a)·b) 객체 + 대상 건 폴더의 고아 객체(행 없이 남은 업로드) Storage remove
 */
async function cleanupQuickChatAttachments(requestIds, uploaderIds) {
  const storagePaths = new Set();
  let deletedRows = 0;

  const deleteBy = async (column, values) => {
    for (let offset = 0; offset < values.length; offset += 100) {
      const batch = values.slice(offset, offset + 100);
      const { data, error } = await admin
        .from(QUICK_CHAT_ATTACHMENTS_TABLE)
        .delete()
        .in(column, batch)
        .select('storage_path');
      if (error) {
        throw new Error(`${QUICK_CHAT_ATTACHMENTS_TABLE} cleanup (${column}) failed: ${error.message}`);
      }
      (data ?? []).forEach(({ storage_path }) => storagePaths.add(storage_path));
      deletedRows += data?.length ?? 0;
    }
  };

  await deleteBy('quick_request_id', requestIds);
  await deleteBy('uploader_user_id', uploaderIds);
  (await listQuickChatStorageObjects(requestIds)).forEach((storagePath) => storagePaths.add(storagePath));

  const paths = [...storagePaths];
  await removeStorageObjects(QUICK_CHAT_BUCKET, paths);
  return { rows: deletedRows, objects: paths.length };
}

async function cleanupQuickWorkflowFixtures() {
  const userIds = await workflowFixtureUserIds();
  const { data: stableProfiles, error: stableError } = await admin
    .from('profiles')
    .select('user_id')
    .in('email', FIXTURE_EMAILS);
  if (stableError) {
    throw new Error(`quick workflow fixture lookup failed: ${stableError.message}`);
  }
  const fixtureIds = (stableProfiles ?? []).map(({ user_id }) => user_id);
  const fixtureSet = new Set(fixtureIds);
  const disposableIds = userIds.filter((id) => !fixtureSet.has(id));

  const targets = await quickWorkflowTargetRows(disposableIds, fixtureIds);
  const requestNos = targets.map(({ request_no }) => request_no);
  const years = [...new Set(targets.map(({ request_year }) => request_year))];

  // 0) plan 98 — 퀵 대화 첨부: 대상 건의 첨부 행·Storage 객체(pending 포함) + 일회용 계정이 올린 첨부(건 표식 무관) + 대상 건 폴더 고아 객체.
  //    quick_requests 삭제 전에 지운다(행은 cascade되지만 Storage 객체는 남기 때문).
  const quickChatAttachments = await cleanupQuickChatAttachments(
    targets.map(({ id }) => id),
    disposableIds
  );

  // 1) 알림 (metadata.quick_request_no)
  let deletedNotifications = 0;
  for (let offset = 0; offset < requestNos.length; offset += 100) {
    const batch = requestNos.slice(offset, offset + 100);
    const { data, error } = await admin
      .from('notifications')
      .delete()
      .like('type', 'quick_request.%')
      .in('metadata->>quick_request_no', batch)
      .select('id');
    if (error) {
      throw new Error(`quick request notification cleanup failed: ${error.message}`);
    }
    deletedNotifications += data?.length ?? 0;
  }

  // 2) quick_requests
  const ids = targets.map(({ id }) => id);
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { error } = await admin.from('quick_requests').delete().in('id', ids.slice(offset, offset + 100));
    if (error) {
      throw new Error(`quick_requests cleanup failed: ${error.message}`);
    }
  }

  // 3) 최근 주소 — 일회용 계정 분 (fixture `E2E…`분은 cleanupQuickRequestFixtures가 처리)
  let deletedRecent = 0;
  for (let offset = 0; offset < disposableIds.length; offset += 100) {
    const { data, error } = await admin
      .from('quick_request_recent_addresses')
      .delete()
      .in('user_id', disposableIds.slice(offset, offset + 100))
      .select('id');
    if (error) {
      throw new Error(`quick_request_recent_addresses disposable cleanup failed: ${error.message}`);
    }
    deletedRecent += data?.length ?? 0;
  }

  // 3b) plan 94 D-12 — 승인·취소 건도 대화가 열리면서 일회용 계정(동방·동방2·구매물류)이 E2E 표식이 없는 실데이터 건에
  //     메시지·읽음 위치를 남길 수 있다(cascade 대상 아님). 일회용 계정 자체가 E2E 산출물이므로 그 계정이 쓴 메시지·읽음·
  //     그 계정이 행위자인 퀵 알림을 건 표식과 무관하게 지운다.
  let deletedDisposableMessages = 0;
  let deletedDisposableReads = 0;
  let deletedDisposableActorNotifications = 0;
  for (let offset = 0; offset < disposableIds.length; offset += 100) {
    const batch = disposableIds.slice(offset, offset + 100);
    const { data: readRows, error: readError } = await admin
      .from('quick_request_message_reads')
      .delete()
      .in('user_id', batch)
      .select('user_id');
    if (readError) {
      throw new Error(`quick_request_message_reads disposable cleanup failed: ${readError.message}`);
    }
    deletedDisposableReads += readRows?.length ?? 0;
    const { data: messageRows, error: messageError } = await admin
      .from('quick_request_messages')
      .delete()
      .in('author_user_id', batch)
      .select('id');
    if (messageError) {
      throw new Error(`quick_request_messages disposable cleanup failed: ${messageError.message}`);
    }
    deletedDisposableMessages += messageRows?.length ?? 0;
    const { data: notificationRows, error: notificationError } = await admin
      .from('notifications')
      .delete()
      .like('type', 'quick_request.%')
      .in('metadata->>actor_user_id', batch)
      .select('id');
    if (notificationError) {
      throw new Error(`quick request disposable-actor notification cleanup failed: ${notificationError.message}`);
    }
    deletedDisposableActorNotifications += notificationRows?.length ?? 0;
  }

  // 3c) plan 101 — 참여자(`quick_request_participants`): E2E 건의 행은 quick_requests on delete cascade로 지워진다.
  //     일회용 계정이 실데이터 건에 초대됐거나(user_id cascade) 초대한 경우(invited_by on delete restrict → RPC 사용자 삭제 실패)를
  //     막기 위해 일회용 계정이 user_id·invited_by인 행을 건 표식과 무관하게 지운다.
  let deletedDisposableParticipants = 0;
  for (let offset = 0; offset < disposableIds.length; offset += 100) {
    const batch = disposableIds.slice(offset, offset + 100);
    for (const column of ['user_id', 'invited_by']) {
      const { data, error } = await admin
        .from('quick_request_participants')
        .delete()
        .in(column, batch)
        .select('id');
      if (error) {
        throw new Error(`quick_request_participants disposable cleanup (${column}) failed: ${error.message}`);
      }
      deletedDisposableParticipants += data?.length ?? 0;
    }
  }

  // 4) 연도 카운터 — 해당 연도에 요청이 0건이면 행 삭제(다음 번호 01부터)
  const resetCounters = [];
  for (const year of years) {
    const remainingInYear = await countRows('quick_requests', (q) => q.eq('request_year', year));
    if (remainingInYear === 0) {
      const { error } = await admin.from('quick_request_counters').delete().eq('year', year);
      if (error) {
        throw new Error(`quick_request_counters reset failed: ${error.message}`);
      }
      resetCounters.push(year);
    }
  }

  const remainingTargets = await quickWorkflowTargetRows(disposableIds, fixtureIds);
  // plan 93 — 대화·읽음 위치는 quick_requests on delete cascade로 지워진다. 잔존 0 확인 (일회용 작성자 분은 3b가 건 표식과 무관하게 삭제)
  const idsForChatCheck = ids.slice(0, 100);
  const remaining = {
    quick_requests: remainingTargets.length,
    quick_chat_attachment_rows: idsForChatCheck.length
      ? await countRows(QUICK_CHAT_ATTACHMENTS_TABLE, (q) => q.in('quick_request_id', idsForChatCheck))
      : 0,
    disposable_uploader_attachments: disposableIds.length
      ? await countRows(QUICK_CHAT_ATTACHMENTS_TABLE, (q) => q.in('uploader_user_id', disposableIds.slice(0, 100)))
      : 0,
    quick_chat_storage_objects: await countQuickChatStorageObjects(ids),
    quick_notifications: requestNos.length
      ? await countRows('notifications', (q) =>
          q.like('type', 'quick_request.%').in('metadata->>quick_request_no', requestNos.slice(0, 100))
        )
      : 0,
    quick_request_messages: idsForChatCheck.length
      ? await countRows('quick_request_messages', (q) => q.in('quick_request_id', idsForChatCheck))
      : 0,
    quick_request_message_reads: idsForChatCheck.length
      ? await countRows('quick_request_message_reads', (q) => q.in('quick_request_id', idsForChatCheck))
      : 0,
    disposable_author_messages: disposableIds.length
      ? await countRows('quick_request_messages', (q) => q.in('author_user_id', disposableIds.slice(0, 100)))
      : 0,
    disposable_reads: disposableIds.length
      ? await countRows('quick_request_message_reads', (q) => q.in('user_id', disposableIds.slice(0, 100)))
      : 0,
    quick_request_participants: idsForChatCheck.length
      ? await countRows('quick_request_participants', (q) => q.in('quick_request_id', idsForChatCheck))
      : 0,
    disposable_participants: disposableIds.length
      ? (await countRows('quick_request_participants', (q) => q.in('user_id', disposableIds.slice(0, 100)))) +
        (await countRows('quick_request_participants', (q) => q.in('invited_by', disposableIds.slice(0, 100))))
      : 0
  };

  console.log('cleanup-e2e-mock-data: quick workflow', {
    deleted_quick_requests: ids.length,
    deleted_quick_chat_attachment_rows: quickChatAttachments.rows,
    deleted_quick_chat_storage_objects: quickChatAttachments.objects,
    deleted_notifications: deletedNotifications,
    deleted_disposable_recent_addresses: deletedRecent,
    deleted_disposable_messages: deletedDisposableMessages,
    deleted_disposable_reads: deletedDisposableReads,
    deleted_disposable_actor_notifications: deletedDisposableActorNotifications,
    deleted_disposable_participants: deletedDisposableParticipants,
    reset_counter_years: resetCounters,
    remaining
  });
  if (Object.values(remaining).some((value) => Number(value) > 0)) {
    throw new Error(`quick workflow e2e data remains: ${JSON.stringify(remaining)}`);
  }
}

// ---------------------------------------------------------------------------
// plan 103 — 구독·비품 e2e 산출물 (AC-53)
// 삭제 대상 = 대장 행 중 source='e2e' 또는 (source='manual' AND 이름 ILIKE 'E2E%')
//   · 구독 이름 = name · 비품 이름 = model_serial (자산번호는 실제 형식이라 표식으로 쓰지 않는다)
// + 그 행의 요청(먼저 · 댓글은 cascade) · 관련 알림(metadata.asset_request_id) + E2E(일회용) 계정이 만든 요청·댓글.
// **source='excel_import' 행과 거기 달린 요청은 절대 삭제하지 않는다.** 이관 행 건수는 전후 비교로 검증한다.
// asset_requests.requester_user_id · asset_request_comments.author_user_id · equipment_items.assignee_user_id는
// auth.users FK(on delete restrict)라 cleanup_e2e_mock_data RPC(일회용 사용자 삭제) 전에 정리한다.
// ---------------------------------------------------------------------------
async function selectIds(table, build) {
  const { data, error } = await build(admin.from(table).select('id'));
  if (error) {
    throw new Error(`${table} lookup failed: ${error.message}`);
  }
  return (data ?? []).map(({ id }) => id);
}

async function deleteByIds(table, ids) {
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { error } = await admin.from(table).delete().in('id', ids.slice(offset, offset + 100));
    if (error) {
      throw new Error(`${table} cleanup failed: ${error.message}`);
    }
  }
}

async function assetLedgerTargetRows() {
  const subscriptionIds = [
    ...new Set([
      ...(await selectIds('subscriptions', (q) => q.eq('source', 'e2e'))),
      ...(await selectIds('subscriptions', (q) => q.eq('source', 'manual').ilike('name', E2E_LABEL_PATTERN)))
    ])
  ];
  const equipmentIds = [
    ...new Set([
      ...(await selectIds('equipment_items', (q) => q.eq('source', 'e2e'))),
      ...(await selectIds('equipment_items', (q) =>
        q.eq('source', 'manual').ilike('model_serial', E2E_LABEL_PATTERN)
      ))
    ])
  ];
  return { subscriptionIds, equipmentIds };
}

async function excelImportLedgerIds() {
  return {
    subscriptions: await selectIds('subscriptions', (q) => q.eq('source', 'excel_import')),
    equipment: await selectIds('equipment_items', (q) => q.eq('source', 'excel_import'))
  };
}

async function cleanupAssetLedgerFixtures() {
  const userIds = await workflowFixtureUserIds();
  const { data: stableProfiles, error: stableError } = await admin
    .from('profiles')
    .select('user_id')
    .in('email', FIXTURE_EMAILS);
  if (stableError) {
    throw new Error(`asset ledger fixture lookup failed: ${stableError.message}`);
  }
  const stableIds = new Set((stableProfiles ?? []).map(({ user_id }) => user_id));
  const disposableIds = userIds.filter((id) => !stableIds.has(id));

  const excelBefore = await countRows('subscriptions', (q) => q.eq('source', 'excel_import'));
  const excelEquipmentBefore = await countRows('equipment_items', (q) => q.eq('source', 'excel_import'));
  const excel = await excelImportLedgerIds();
  const excelSubscriptionSet = new Set(excel.subscriptions);
  const excelEquipmentSet = new Set(excel.equipment);

  const { subscriptionIds, equipmentIds } = await assetLedgerTargetRows();

  // 1) 대상 요청: E2E 대장 행의 요청 + 일회용 계정이 만든 요청(이관 행에 달린 것은 제외)
  const requestIds = new Set();
  for (let offset = 0; offset < subscriptionIds.length; offset += 100) {
    (await selectIds('asset_requests', (q) => q.in('subscription_id', subscriptionIds.slice(offset, offset + 100)))).forEach((id) => requestIds.add(id));
  }
  for (let offset = 0; offset < equipmentIds.length; offset += 100) {
    (await selectIds('asset_requests', (q) => q.in('equipment_id', equipmentIds.slice(offset, offset + 100)))).forEach((id) => requestIds.add(id));
  }
  for (let offset = 0; offset < disposableIds.length; offset += 100) {
    const { data, error } = await admin
      .from('asset_requests')
      .select('id, subscription_id, equipment_id')
      .in('requester_user_id', disposableIds.slice(offset, offset + 100));
    if (error) {
      throw new Error(`asset_requests disposable lookup failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      const onExcelRow =
        (row.subscription_id && excelSubscriptionSet.has(row.subscription_id)) ||
        (row.equipment_id && excelEquipmentSet.has(row.equipment_id));
      if (!onExcelRow) requestIds.add(row.id);
    }
  }
  const targetRequestIds = [...requestIds];

  // 2) 알림 (metadata.asset_request_id)
  let deletedNotifications = 0;
  const requestIdTexts = targetRequestIds.map(String);
  for (let offset = 0; offset < requestIdTexts.length; offset += 100) {
    const { data, error } = await admin
      .from('notifications')
      .delete()
      .like('type', 'asset_request.%')
      .in('metadata->>asset_request_id', requestIdTexts.slice(offset, offset + 100))
      .select('id');
    if (error) {
      throw new Error(`asset_request notifications cleanup failed: ${error.message}`);
    }
    deletedNotifications += data?.length ?? 0;
  }

  // 3) 일회용 계정이 남긴 댓글(다른 요청에 단 것 포함) → 요청 → 대장 행 (대상자는 cascade)
  for (let offset = 0; offset < disposableIds.length; offset += 100) {
    const { error } = await admin
      .from('asset_request_comments')
      .delete()
      .in('author_user_id', disposableIds.slice(offset, offset + 100));
    if (error) {
      throw new Error(`asset_request_comments disposable cleanup failed: ${error.message}`);
    }
  }
  await deleteByIds('asset_requests', targetRequestIds);
  await deleteByIds('subscriptions', subscriptionIds);
  await deleteByIds('equipment_items', equipmentIds);

  // 4) 검증 — E2E 표식 행 0 · 일회용 계정 참조 0 · 이관 건수 불변
  const after = await assetLedgerTargetRows();
  const disposableSlice = disposableIds.slice(0, 100);
  const remaining = {
    asset_ledger_subscriptions: after.subscriptionIds.length,
    asset_ledger_equipment: after.equipmentIds.length,
    asset_requests: targetRequestIds.length
      ? await countRows('asset_requests', (q) => q.in('id', targetRequestIds.slice(0, 100)))
      : 0,
    asset_requests_by_disposable: disposableSlice.length
      ? await countRows('asset_requests', (q) => q.in('requester_user_id', disposableSlice))
      : 0,
    asset_request_comments_by_disposable: disposableSlice.length
      ? await countRows('asset_request_comments', (q) => q.in('author_user_id', disposableSlice))
      : 0,
    equipment_assigned_to_disposable: disposableSlice.length
      ? await countRows('equipment_items', (q) => q.in('assignee_user_id', disposableSlice))
      : 0,
    asset_request_notifications: requestIdTexts.length
      ? await countRows('notifications', (q) =>
          q.like('type', 'asset_request.%').in('metadata->>asset_request_id', requestIdTexts.slice(0, 100))
        )
      : 0
  };
  const excelAfter = await countRows('subscriptions', (q) => q.eq('source', 'excel_import'));
  const excelEquipmentAfter = await countRows('equipment_items', (q) => q.eq('source', 'excel_import'));

  console.log('cleanup-e2e-mock-data: asset ledger (plan 103)', {
    deleted_subscriptions: subscriptionIds.length,
    deleted_equipment: equipmentIds.length,
    deleted_requests: targetRequestIds.length,
    deleted_notifications: deletedNotifications,
    excel_import_subscriptions: `${excelBefore} → ${excelAfter}`,
    excel_import_equipment: `${excelEquipmentBefore} → ${excelEquipmentAfter}`,
    remaining
  });

  if (excelAfter !== excelBefore || excelEquipmentAfter !== excelEquipmentBefore) {
    throw new Error('asset ledger excel_import rows changed during cleanup — must never happen');
  }
  if (Object.values(remaining).some((value) => Number(value) > 0)) {
    throw new Error(`asset ledger e2e data remains: ${JSON.stringify(remaining)}`);
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
  await cleanupQuickWorkflowFixtures();
  await cleanupQuickRequestFixtures();
  await cleanupWorkflowFixtures();
  await cleanupAssetLedgerFixtures();

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
