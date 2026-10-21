import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  apiAs,
  attachFile,
  COMMON_REQUIRED,
  composeForm,
  contextAs,
  createDoc,
  expectError,
  expectToast,
  field,
  FIELD_KEYS,
  fillText,
  gotoWorkflow,
  json,
  kstToday,
  marker,
  nameOf,
  openCompose,
  openDoc,
  openPicker,
  PNG_BYTES,
  postDocument,
  purchaseValues,
  putPolicy,
  readPolicy,
  REQ_PAYMENT,
  REQ_PURCHASE,
  requiredKeys,
  selectOption,
  uid,
  uploadAttachment,
  VIEWPORT_MOBILE,
  type Policy
} from './helpers';

/** plan 88 AC-07 ~ 12 · 33 · 34 · 36 · 37 · 40 · 44 — 작성 흐름 (user = 작성자) */

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1280, height: 900 } });

let admin: APIRequestContext;
let user: APIRequestContext;
let user2: APIRequestContext;
let originalPolicy: Policy;

test.beforeAll(async ({ playwright }) => {
  admin = await apiAs(playwright, 'admin');
  user = await apiAs(playwright, 'user');
  user2 = await apiAs(playwright, 'user2');
  originalPolicy = await readPolicy(admin);
  // AC-05 기본값과 동일: 1단계 user2, 2단계 hr, 참조 admin(승인 완료 시 알림)
  await putPolicy(admin, {
    steps: [[uid('user2')], [uid('hr')]],
    referrers: [{ user_id: uid('admin'), notification_setting: 'END' }],
    approval_step_edit_enabled: true
  });
});

test.afterAll(async () => {
  await putPolicy(admin, originalPolicy);
  await Promise.all([admin, user, user2].map((ctx) => ctx?.dispose()));
});

const ATTACHMENT_ROW = /^workflow-attachment-[0-9a-f]{8}-[0-9a-f]{4}-/;

async function waitUploads(page: Page, count: number) {
  await expect(composeForm(page).getByTestId(ATTACHMENT_ROW)).toHaveCount(count, { timeout: 60_000 });
  await expect(page.getByTestId('workflow-submit')).not.toHaveText('첨부 업로드 중…', { timeout: 60_000 });
}

/** 구매 요청 필수 10칸 + 비고 표식 + 첨부 1개 (업체명·계좌 비움) */
async function fillPurchase(page: Page, mark: string, options: { attach?: boolean } = {}) {
  await selectOption(page, 'request_type', REQ_PURCHASE);
  await selectOption(page, 'brand', '웨이크');
  await fillText(page, 'amount', '194840');
  await fillText(page, 'item_quantity', `E2E 품목 ${mark}`);
  await fillText(page, 'delivery_address', '서울 E2E 수령지');
  await fillText(page, 'recipient', 'E2E 수령인 010-0000-0000');
  await fillText(page, 'link_url', 'https://example.com/e2e');
  await fillText(page, 'purchase_reason', 'E2E 구매 사유');
  await fillText(page, 'note', mark);
  if (options.attach !== false) {
    await attachFile(page);
    await waitUploads(page, 1);
  }
}

async function submitAndGetCode(page: Page): Promise<{ id: string; code: string }> {
  const responsePromise = page.waitForResponse(
    (res) => res.url().endsWith('/api/workflow/documents') && res.request().method() === 'POST'
  );
  await page.getByTestId('workflow-submit').click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { document: { id: string; code: string } };
  return body.document;
}

test.describe('plan 88 작성 흐름', () => {
  test('AC-07: 양식 선택 → 지출결의서 작성 폼 (가이드·15칸 순서·prefill)', async ({ page }) => {
    await gotoWorkflow(page);
    const picker = await openPicker(page);
    await expect(picker.getByTestId('workflow-template-search')).toBeVisible();
    const option = picker.getByTestId('workflow-template-option-expense');
    await expect(option).toContainText('지출결의서');
    await expect(option).toContainText('📄');
    await option.click();

    const form = composeForm(page);
    await expect(form).toBeVisible();
    await expect(form.getByTestId('workflow-guide')).toContainText('✅ 공통 필수 값');

    for (const key of FIELD_KEYS) await expect(field(page, key)).toBeAttached();
    const inOrder = await form.evaluate((root, keys) => {
      const nodes = keys.map((key) => root.querySelector(`[data-testid="workflow-field-${key}"]`));
      return nodes.every(
        (node, index) =>
          node !== null &&
          (index === 0 || Boolean(nodes[index - 1]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))
      );
    }, [...FIELD_KEYS]);
    expect(inOrder, '15칸 순서').toBe(true);

    const userName = await nameOf(user, uid('user'));
    await expect(field(page, 'writer_name').getByRole('textbox')).toHaveValue(userName);
    await expect(field(page, 'written_date')).toContainText(kstToday());
  });

  test('AC-08 · AC-09 · AC-10 · AC-11: 조건부 필수 표시·오류·전송 차단', async ({ page }) => {
    await gotoWorkflow(page);
    await openCompose(page);
    const form = composeForm(page);

    // AC-08
    expect(await requiredKeys(page)).toEqual([...COMMON_REQUIRED]);
    await expect(form.getByTestId('workflow-attachment-required')).toHaveCount(0);

    // AC-09
    await selectOption(page, 'request_type', REQ_PAYMENT);
    expect((await requiredKeys(page)).sort()).toEqual(
      [...COMMON_REQUIRED, 'vendor_account_holder', 'bank_account'].sort()
    );
    await expect(form.getByTestId('workflow-attachment-required')).toBeVisible();
    for (const key of FIELD_KEYS) await expect(field(page, key)).toBeVisible();

    // AC-10 — 공통 6칸만 입력, 결재선은 기본값(승인자 지정됨)
    await expect(form.getByTestId(`workflow-actor-1-${uid('user2')}`)).toBeVisible();
    await selectOption(page, 'brand', '웨이크');
    await fillText(page, 'amount', '50000');
    await fillText(page, 'purchase_reason', 'E2E 사유');
    let posts = 0;
    page.on('request', (req) => {
      if (req.url().endsWith('/api/workflow/documents') && req.method() === 'POST') posts += 1;
    });
    await page.getByTestId('workflow-submit').click();
    await expect(form.getByTestId('workflow-field-error-vendor_account_holder')).toHaveText(
      '업체명 및 예금주 항목을 입력해 주세요.'
    );
    await expect(form.getByTestId('workflow-field-error-bank_account')).toHaveText(
      '계좌정보(은행명) 항목을 입력해 주세요.'
    );
    await expect(form.getByTestId('workflow-attachment-error')).toHaveText('첨부파일을 1개 이상 올려 주세요.');
    await expect(field(page, 'vendor_account_holder')).toBeInViewport();
    await page.waitForTimeout(500);
    expect(posts).toBe(0);

    // AC-11
    await selectOption(page, 'request_type', REQ_PURCHASE);
    expect((await requiredKeys(page)).sort()).toEqual(
      [...COMMON_REQUIRED, 'item_quantity', 'delivery_address', 'recipient', 'link_url'].sort()
    );
    await expect(form.getByTestId('workflow-field-error-vendor_account_holder')).toHaveCount(0);
    await expect(form.getByTestId('workflow-field-error-bank_account')).toHaveCount(0);
  });

  test('AC-12: 구매 요청 보내기 → toast·폼 닫힘·진행중 행 즉시 반영', async ({ page }) => {
    const mark = marker();
    await gotoWorkflow(page);
    await openCompose(page);
    await fillPurchase(page, mark);
    const doc = await submitAndGetCode(page);
    await expectToast(page, '문서를 보냈습니다.');
    await expect(composeForm(page)).toHaveCount(0);

    const row = page.getByTestId('workflow-group-in-progress').getByTestId(`workflow-row-${doc.code}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    expect(doc.code).toMatch(new RegExp(`^${kstToday().slice(0, 4)}-\\d{4,}$`));
    await expect(row).toContainText('진행중 1/2');
    await expect(row).toContainText(doc.code);
    await expect(row).toContainText('요청 유형: 구매 요청');
    await expect(row).toContainText('첨부파일 1건');
    await expect(row).not.toContainText('업체명 및 예금주');
    await expect(row).not.toContainText('계좌정보');
    await expect(row).not.toContainText(': ·');

    // 폼 초기화 — 다시 열면 입력값이 비어 있다
    await openCompose(page);
    await expect(field(page, 'amount').getByRole('textbox')).toHaveValue('');
    await expect(field(page, 'note').getByRole('textbox')).toHaveValue('');
  });

  test('AC-33: 임시저장 → 이어서 작성하기 복원 → 보내면 목록에서 사라짐, 삭제 AlertModal, 타인 0건', async ({ page }) => {
    const mark = marker();
    await gotoWorkflow(page);
    await openCompose(page);
    await fillPurchase(page, mark);
    await fillText(page, 'vendor_account_holder', 'E2E 임시 업체');

    const draftResponse = page.waitForResponse(
      (res) => res.url().endsWith('/api/workflow/drafts') && res.request().method() === 'POST'
    );
    await page.getByTestId('workflow-save-draft').click();
    const draftRes = await draftResponse;
    expect(draftRes.status()).toBe(201);
    const draftId = ((await draftRes.json()) as { draft: { id: string } }).draft.id;
    await expectToast(page, '임시저장했습니다.');

    await page.getByTestId('workflow-compose-close').click();
    await expect(composeForm(page)).toHaveCount(0);

    const picker = await openPicker(page);
    await expect(picker.getByTestId('workflow-draft-list')).toContainText('이어서 작성하기 1개');
    await picker.getByTestId(`workflow-draft-${draftId}`).click();
    await expect(field(page, 'note').getByRole('textbox')).toHaveValue(mark);
    await expect(field(page, 'vendor_account_holder').getByRole('textbox')).toHaveValue('E2E 임시 업체');
    await expect(composeForm(page).getByTestId(`workflow-actor-1-${uid('user2')}`)).toBeVisible();
    await expect(composeForm(page).getByTestId(ATTACHMENT_ROW)).toHaveCount(1);

    await submitAndGetCode(page);
    await expectToast(page, '문서를 보냈습니다.');
    await openPicker(page);
    await expect(page.getByTestId(`workflow-draft-${draftId}`)).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 삭제 — API로 만든 표식 임시저장을 AlertModal로 삭제
    const created = await user.post('/api/workflow/drafts', {
      data: {
        template_key: 'expense',
        payload: { values: purchaseValues(marker()), content_html: '', steps: [[uid('user2')]], referrers: [] },
        attachment_ids: []
      }
    });
    expect(created.status()).toBe(201);
    const deleteId = (await json<{ draft: { id: string } }>(created)).draft.id;
    await gotoWorkflow(page);
    await openPicker(page);
    await page.getByTestId(`workflow-draft-delete-${deleteId}`).click();
    const modal = page.getByRole('dialog', { name: '임시저장 삭제' });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: '삭제' }).click();
    await expectToast(page, '임시저장을 삭제했습니다.');
    await expect(page.getByTestId(`workflow-draft-${deleteId}`)).toHaveCount(0);

    const other = await user2.get('/api/workflow/drafts');
    expect(other.status()).toBe(200);
    expect((await json<{ drafts: unknown[] }>(other)).drafts).toHaveLength(0);
  });

  test('AC-34: 입력 중 닫기 → 「작성을 그만둘까요?」 → 계속 작성 시 입력 유지', async ({ page }) => {
    await gotoWorkflow(page);
    await openCompose(page);
    await fillText(page, 'amount', '12345');
    await page.getByTestId('workflow-compose-close').click();
    const modal = page.getByRole('dialog', { name: '작성을 그만둘까요?' });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('임시저장하지 않은 내용은 사라집니다.');
    await modal.getByRole('button', { name: '계속 작성' }).click();
    await expect(modal).toHaveCount(0);
    await expect(field(page, 'amount').getByRole('textbox')).toHaveValue('12,345');
  });

  test('AC-36: 복제하기 → 입력값·결재선·참조자 복사, 첨부 비움, 작성일 오늘 / user2는 메뉴 0건', async ({ page, browser }) => {
    const dupMark = marker();
    const doc = await createDoc(user, {
      mark: dupMark,
      steps: [[uid('user2')], [uid('hr')]],
      referrers: [{ user_id: uid('admin'), notification_setting: 'END' }],
      values: purchaseValues(dupMark, { written_date: '2026-01-02' })
    });
    const detail = await openDoc(page, doc.id);
    await detail.getByTestId('workflow-more-menu').click();
    await page.getByRole('menuitem', { name: '복제하기' }).click();
    await expect(composeForm(page)).toBeVisible();
    await expect(field(page, 'note').getByRole('textbox')).toHaveValue(doc.mark);
    await expect(field(page, 'amount').getByRole('textbox')).toHaveValue('194,840');
    await expect(field(page, 'written_date')).toContainText(kstToday());
    await expect(composeForm(page).getByTestId(`workflow-actor-1-${uid('user2')}`)).toBeVisible();
    await expect(composeForm(page).getByTestId(`workflow-actor-2-${uid('hr')}`)).toBeVisible();
    await expect(composeForm(page).getByTestId(`workflow-referrer-notify-${uid('admin')}`)).toBeVisible();
    await expect(composeForm(page).getByTestId(ATTACHMENT_ROW)).toHaveCount(0);

    const ctx = await contextAs(browser, 'user2');
    const page2 = await ctx.newPage();
    try {
      const detail2 = await openDoc(page2, doc.id);
      await detail2.getByTestId('workflow-more-menu').click();
      await expect(page2.getByRole('menuitem', { name: 'PDF 인쇄' })).toBeVisible();
      await expect(page2.getByRole('menuitem', { name: '복제하기' })).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test('AC-37: 참조문서 선택 → 상세 카드 → 클릭 이동, 외부 문서 참조 API 400', async ({ page }) => {
    const target = await createDoc(user, { steps: [[uid('user2')]] });
    const mark = marker();
    await gotoWorkflow(page);
    await openCompose(page);
    await fillPurchase(page, mark);
    await field(page, 'reference_documents').getByRole('button', { name: '참조문서' }).click();
    const picker = page.getByTestId('workflow-reference-picker');
    await expect(picker).toBeVisible();
    await picker.getByPlaceholder('문서번호·내용 검색…').fill(target.code);
    await picker.getByRole('checkbox').first().click();
    await picker.getByRole('button', { name: '선택 완료 (1)' }).click();
    await expect(field(page, 'reference_documents').getByTestId(`workflow-reference-card-${target.code}`)).toBeVisible();
    const doc = await submitAndGetCode(page);
    await expectToast(page, '문서를 보냈습니다.');

    const detail = await openDoc(page, doc.id);
    const card = detail.getByTestId(`workflow-reference-card-${target.code}`);
    // 카드 = 📄 · 양식명 · 문서번호 (별도 span, 화면에서는 gap으로 띄움)
    await expect(card).toContainText(new RegExp(`📄\\s*지출결의서\\s*${target.code}`));
    await card.click();
    await expect(page).toHaveURL(new RegExp(`doc=${target.id}`));
    await expect(page.getByTestId('workflow-detail').getByTestId('workflow-detail-code')).toHaveText(target.code);

    // 열람 불가 문서(user2 작성, 결재선 admin) 참조 → 400
    const outside = await createDoc(user2, { steps: [[uid('admin')]] });
    const att = await uploadAttachment(user);
    const res = await postDocument(user, {
      values: purchaseValues(marker(), { reference_documents: [outside.id] }),
      steps: [[uid('user2')]],
      attachmentIds: [att.id]
    });
    await expectError(res, 400, '참조할 수 없는 문서가 있습니다.');
  });

  test('AC-40: 첨부 20MB 초과·31번째 파일 차단 + API prepare 400', async ({ page }) => {
    await gotoWorkflow(page);
    await openCompose(page);
    const form = composeForm(page);
    const dropzoneInput = form.getByTestId('workflow-attachments-dropzone').locator('input[type=file]');

    await dropzoneInput.setInputFiles({
      name: 'too-big.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(20 * 1024 * 1024 + 1)
    });
    await expect(form.getByTestId('workflow-attachment-error')).toHaveText('파일당 20MB 이하만 올릴 수 있습니다.');
    await expect(form.getByText('too-big.bin')).toHaveCount(0);

    const files = Array.from({ length: 31 }, (_, index) => ({
      name: `e2e-wf-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: PNG_BYTES
    }));
    await dropzoneInput.setInputFiles(files);
    await expect(form.getByTestId('workflow-attachment-error')).toHaveText(
      '첨부파일은 최대 30개까지 올릴 수 있습니다.'
    );
    await waitUploads(page, 30);
    await expect(form.getByText('e2e-wf-31.png', { exact: true })).toHaveCount(0);

    const big = await user.post('/api/workflow/attachments/prepare', {
      data: { file_name: 'big.png', file_size: 20 * 1024 * 1024 + 1, content_type: 'image/png' }
    });
    await expectError(big, 400, '파일당 20MB 이하만 올릴 수 있습니다.');
    const many = await user.post('/api/workflow/attachments/prepare', {
      data: { file_name: 'x.png', file_size: 10, content_type: 'image/png', existing_count: 30 }
    });
    await expectError(many, 400, '첨부파일은 최대 30개까지 올릴 수 있습니다.');
  });

  test('AC-44: 375 작성 폼 전체 화면 · 결재선 접근 · 보내기 하단 고정', async ({ page }) => {
    await page.setViewportSize(VIEWPORT_MOBILE);
    const mark = marker();
    await gotoWorkflow(page);
    await openCompose(page);
    const dialogBox = await page.getByRole('dialog').filter({ has: composeForm(page) }).boundingBox();
    expect(dialogBox?.width).toBeCloseTo(VIEWPORT_MOBILE.width, 0);
    expect(dialogBox?.height).toBeGreaterThanOrEqual(VIEWPORT_MOBILE.height - 1);

    const submit = page.getByTestId('workflow-submit');
    const expectSubmitPinned = async () => {
      await expect(submit).toBeInViewport();
      const box = await submit.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORT_MOBILE.height);
    };
    await expectSubmitPinned();

    await fillPurchase(page, mark);
    const line = composeForm(page).getByTestId('workflow-approval-line');
    await line.getByTestId('workflow-step-add').scrollIntoViewIfNeeded();
    await expect(line.getByTestId('workflow-step-add')).toBeInViewport();
    await expect(line.getByTestId(`workflow-actor-1-${uid('user2')}`)).toBeVisible();
    await expectSubmitPinned();
    const scrollOk = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(scrollOk).toBe(true);

    await submitAndGetCode(page);
    await expectToast(page, '문서를 보냈습니다.');
  });
});
