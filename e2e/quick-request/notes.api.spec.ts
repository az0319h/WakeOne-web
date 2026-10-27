import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAdminRequest, e2eBaseURL } from '../helpers/auth-request';
import {
  createActiveTestUser,
  createGuestRequestWithPassword
} from '../helpers/supabase-direct-auth';
import { expectActivityLogRow, requestIdOf } from './activity-log';
import { selectNoteLabelsForUser } from './db';
import { listNotesApi, resetNotesToSeed, SEED_NOTE_LABEL, type QuickRequestNoteDto } from './helpers';

// plan 87 — docs/plans/87_quick-request-goods-notes-address-picker-plan.md (칩 API · AC-10~14)
const NOTES_PATH = '/api/quick-request/notes';

async function postNote(request: APIRequestContext, label: unknown) {
  return request.post(NOTES_PATH, { data: { label } });
}

async function messageOf(response: { json(): Promise<unknown> }) {
  const body = (await response.json()) as { message?: string };
  return body.message;
}

test.describe('퀵 요청 특이사항 칩 API (plan 87)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test.beforeEach(async ({ request }) => {
    await resetNotesToSeed(request);
  });

  test.afterEach(async ({ request }) => {
    await resetNotesToSeed(request);
  });

  test('AC-10: 10개 보유 상태에서 11번째 POST → 409 · 최대 10개 message', async ({ request }) => {
    for (let i = 1; i <= 9; i++) {
      const response = await postNote(request, `E2E API 상한 ${i}`);
      expect(response.status()).toBe(201);
    }
    expect(await listNotesApi(request)).toHaveLength(10);

    const eleventh = await postNote(request, 'E2E API 상한 11');
    expect(eleventh.status()).toBe(409);
    expect(eleventh.headers()['x-request-id']).toBeTruthy();
    expect(await messageOf(eleventh)).toBe('특이사항은 최대 10개까지 등록할 수 있습니다.');
    expect(await listNotesApi(request)).toHaveLength(10);
  });

  test('AC-11: 빈 라벨 400 · 31자 400 · 중복 라벨 409', async ({ request }) => {
    const empty = await postNote(request, '   ');
    expect(empty.status()).toBe(400);
    expect(await messageOf(empty)).toBe('특이사항을 입력해 주세요.');

    const tooLong = await postNote(request, `E2E${'가'.repeat(28)}`);
    expect(tooLong.status()).toBe(400);
    expect(await messageOf(tooLong)).toBe('30자 이내로 입력해 주세요.');

    const duplicate = await postNote(request, SEED_NOTE_LABEL);
    expect(duplicate.status()).toBe(409);
    expect(await messageOf(duplicate)).toBe('이미 등록된 특이사항입니다.');

    for (const response of [empty, tooLong, duplicate]) {
      expect(response.headers()['x-request-id']).toBeTruthy();
    }
  });

  test('AC-12: 미인증 PATCH 401 · 다른 사용자 PATCH/DELETE 404 · 원본 불변', async ({
    request,
    playwright
  }) => {
    const [seed] = await listNotesApi(request);
    expect(seed.label).toBe(SEED_NOTE_LABEL);

    // test.use storageState가 상속되지 않도록 빈 storageState를 명시한다
    const anonymous = await playwright.request.newContext({
      baseURL: e2eBaseURL,
      storageState: { cookies: [], origins: [] }
    });
    const userB = await createActiveTestUser('e2e-qr-userb', { fullName: 'E2E 퀵 사용자B' });
    const userBRequest = await createGuestRequestWithPassword(playwright, userB.email, userB.password);
    try {
      const unauth = await anonymous.patch(`${NOTES_PATH}/${seed.id}`, {
        data: { label: 'E2E 탈취' }
      });
      expect(unauth.status()).toBe(401);
      expect(unauth.headers()['x-request-id']).toBeTruthy();

      const otherPatch = await userBRequest.patch(`${NOTES_PATH}/${seed.id}`, {
        data: { label: 'E2E 탈취' }
      });
      expect(otherPatch.status()).toBe(404);
      expect(otherPatch.headers()['x-request-id']).toBeTruthy();

      const otherDelete = await userBRequest.delete(`${NOTES_PATH}/${seed.id}`);
      expect(otherDelete.status()).toBe(404);
      expect(otherDelete.headers()['x-request-id']).toBeTruthy();

      const after = await listNotesApi(request);
      expect(after).toEqual([{ id: seed.id, label: SEED_NOTE_LABEL }]);
    } finally {
      await anonymous.dispose();
      await userBRequest.dispose();
    }
  });

  test('AC-13: POST 201 → PATCH 200 → DELETE 200 → 중복 POST 409 · x-request-id · activity log 4행', async ({
    request,
    playwright
  }) => {
    const created = await postNote(request, 'E2E 로그 칩');
    expect(created.status()).toBe(201);
    const createId = requestIdOf(created);
    const note = ((await created.json()) as { data: { note: QuickRequestNoteDto } }).data.note;

    const updated = await request.patch(`${NOTES_PATH}/${note.id}`, {
      data: { label: 'E2E 로그 칩 수정' }
    });
    expect(updated.status()).toBe(200);
    const updateId = requestIdOf(updated);
    const updateBody = (await updated.json()) as {
      data: { note: QuickRequestNoteDto; previousLabel: string };
    };
    expect(updateBody.data.previousLabel).toBe('E2E 로그 칩');
    expect(updateBody.data.note.label).toBe('E2E 로그 칩 수정');

    const deleted = await request.delete(`${NOTES_PATH}/${note.id}`);
    expect(deleted.status()).toBe(200);
    const deleteId = requestIdOf(deleted);

    const duplicate = await postNote(request, SEED_NOTE_LABEL);
    expect(duplicate.status()).toBe(409);
    const duplicateId = requestIdOf(duplicate);

    const admin = await createAdminRequest(playwright);
    try {
      const rows = [
        await expectActivityLogRow(admin, 'quick_request.note_create', createId, 201),
        await expectActivityLogRow(admin, 'quick_request.note_update', updateId, 200),
        await expectActivityLogRow(admin, 'quick_request.note_delete', deleteId, 200),
        await expectActivityLogRow(admin, 'quick_request.note_create', duplicateId, 409)
      ];
      for (const row of rows) {
        expect(row.target_type).toBe('quick_request_note');
      }
      expect(rows[3].metadata?.error_code).toBeTruthy();
    } finally {
      await admin.dispose();
    }
  });

  test('AC-14: 신규 profile → 「동승 필요」 seed 1행 · 전부 삭제 후 GET 빈 배열(re-seed 없음)', async ({
    playwright
  }) => {
    const user = await createActiveTestUser('e2e-qr-seed', { fullName: 'E2E 퀵 seed' });
    // ② SQL 85 seed trigger — 신규 user_id에 「동승 필요」 1행
    expect(await selectNoteLabelsForUser(user.userId)).toEqual([SEED_NOTE_LABEL]);

    const userRequest = await createGuestRequestWithPassword(playwright, user.email, user.password);
    try {
      const notes = await listNotesApi(userRequest);
      expect(notes.map((note) => note.label)).toEqual([SEED_NOTE_LABEL]);

      const deleted = await userRequest.delete(`${NOTES_PATH}/${notes[0].id}`);
      expect(deleted.status()).toBe(200);

      // ① 모두 삭제 → 빈 배열 (다시 조회해도 re-seed 없음)
      expect(await listNotesApi(userRequest)).toEqual([]);
      expect(await listNotesApi(userRequest)).toEqual([]);
      expect(await selectNoteLabelsForUser(user.userId)).toEqual([]);
    } finally {
      await userRequest.dispose();
    }
  });
});
