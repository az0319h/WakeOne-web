import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  desktopSummary,
  gotoQuickRequest,
  noteChip,
  notesGroup,
  quickRequestMain,
  resetNotesToSeed,
  SEED_NOTE_LABEL,
  type QuickRequestNoteDto
} from './helpers';

// plan 87 — docs/plans/87_quick-request-goods-notes-address-picker-plan.md (특이사항 칩 UI · AC-06~10)
const SIDES = ['origin', 'destination'] as const;

async function createNoteApi(request: APIRequestContext, label: string) {
  const response = await request.post('/api/quick-request/notes', { data: { label } });
  expect(response.status(), `POST note ${label}`).toBe(201);
  const body = (await response.json()) as { data: { note: QuickRequestNoteDto } };
  return body.data.note;
}

function editToggle(page: Page) {
  return quickRequestMain(page).getByRole('button', { name: '편집', exact: true });
}

function editDoneToggle(page: Page) {
  return quickRequestMain(page).getByRole('button', { name: '편집 완료', exact: true });
}

test.describe('퀵 요청 특이사항 칩 관리 (plan 87 AC-06~10)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await resetNotesToSeed(page.request);
  });

  test.afterEach(async ({ page }) => {
    await resetNotesToSeed(page.request);
  });

  test('AC-06: seed 상태 — 출발·도착 group에 「동승 필요」 1개만 · 「주차 협조 필요」 0건', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    for (const side of SIDES) {
      const group = notesGroup(page, side);
      await expect(group).toBeVisible();
      await expect(group.getByRole('button')).toHaveCount(1);
      await expect(noteChip(page, side, SEED_NOTE_LABEL)).toHaveCount(1);
    }
    await expect(quickRequestMain(page).getByText('주차 협조 필요')).toHaveCount(0);
  });

  test('AC-07: 「+ 추가」 → 「E2E 칩 A」 저장 → toast · 새로고침 없이 두 group 반영', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    await quickRequestMain(page).getByTestId('quick-request-note-add').click();
    const dialog = page.getByRole('dialog', { name: '특이사항 추가' });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('quick-request-note-editor-input').fill('E2E 칩 A');
    await dialog.getByTestId('quick-request-note-editor-save').click();

    await expect(page.getByText('특이사항이 추가되었습니다.', { exact: true })).toBeVisible({
      timeout: 10_000
    });
    await expect(dialog).toBeHidden();
    for (const side of SIDES) {
      await expect(noteChip(page, side, 'E2E 칩 A')).toBeVisible();
    }
  });

  test('AC-08: 출발에서 「E2E 칩 A」 선택 → 수정 「E2E 칩 B」 → 두 group·요약 치환', async ({
    page
  }) => {
    const note = await createNoteApi(page.request, 'E2E 칩 A');
    await gotoQuickRequest(page);

    const originChip = noteChip(page, 'origin', 'E2E 칩 A');
    await originChip.click();
    await expect(originChip).toHaveAttribute('aria-pressed', 'true');
    await expect(desktopSummary(page)).toContainText('E2E 칩 A');

    await editToggle(page).click();
    await quickRequestMain(page).getByTestId(`quick-request-note-edit-${note.id}`).click();
    const dialog = page.getByRole('dialog', { name: '특이사항 수정' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByTestId('quick-request-note-editor-input');
    await expect(input).toHaveValue('E2E 칩 A');
    await input.fill('E2E 칩 B');
    await dialog.getByTestId('quick-request-note-editor-save').click();
    await expect(page.getByText('특이사항이 수정되었습니다.', { exact: true })).toBeVisible({
      timeout: 10_000
    });
    await expect(dialog).toBeHidden();
    await editDoneToggle(page).click();

    for (const side of SIDES) {
      await expect(noteChip(page, side, 'E2E 칩 B')).toBeVisible();
      await expect(noteChip(page, side, 'E2E 칩 A')).toHaveCount(0);
    }
    await expect(noteChip(page, 'origin', 'E2E 칩 B')).toHaveAttribute('aria-pressed', 'true');
    const summary = desktopSummary(page);
    await expect(summary).toContainText('E2E 칩 B');
    await expect(summary).not.toContainText('E2E 칩 A');
  });

  test('AC-09: 「E2E 칩 B」 삭제 → AlertModal 「특이사항 삭제」 · 확인 → group·요약 제거', async ({
    page
  }) => {
    const note = await createNoteApi(page.request, 'E2E 칩 B');
    await gotoQuickRequest(page);

    const originChip = noteChip(page, 'origin', 'E2E 칩 B');
    await originChip.click();
    await expect(originChip).toHaveAttribute('aria-pressed', 'true');
    await expect(desktopSummary(page)).toContainText('E2E 칩 B');

    await editToggle(page).click();
    await quickRequestMain(page).getByTestId(`quick-request-note-delete-${note.id}`).click();
    const modal = page.getByRole('dialog', { name: '특이사항 삭제' });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('E2E 칩 B');
    await modal.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.getByText('특이사항이 삭제되었습니다.', { exact: true })).toBeVisible({
      timeout: 10_000
    });
    await expect(modal).toBeHidden();
    await editDoneToggle(page).click();

    for (const side of SIDES) {
      await expect(noteChip(page, side, 'E2E 칩 B')).toHaveCount(0);
      await expect(noteChip(page, side, SEED_NOTE_LABEL)).toBeVisible();
    }
    await expect(desktopSummary(page)).not.toContainText('E2E 칩 B');
  });

  test('AC-10: 칩 10개 보유 → 「+ 추가」 시 최대 10개 안내', async ({ page }) => {
    for (let i = 1; i <= 9; i++) {
      await createNoteApi(page.request, `E2E 상한 ${i}`);
    }
    await gotoQuickRequest(page);
    await expect(notesGroup(page, 'origin').getByRole('button')).toHaveCount(10);
    await quickRequestMain(page).getByTestId('quick-request-note-add').click();
    await expect(
      page.getByText('특이사항은 최대 10개까지 등록할 수 있습니다.', { exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('dialog', { name: '특이사항 추가' })).toHaveCount(0);
  });
});
