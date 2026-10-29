import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChatBodyWithAttachmentSummary,
  classifyQuickChatAttachment,
  getQuickChatAttachmentExtension,
  parseQuickChatAttachmentId,
  QUICK_CHAT_ATTACHMENT_ACCEPT,
  QUICK_CHAT_ATTACHMENT_MAX_BYTES,
  QUICK_CHAT_ATTACHMENT_MAX_COUNT,
  QUICK_CHAT_ATTACHMENT_MESSAGES,
  quickChatAttachmentsPrepareSchema,
  summarizeAttachments
} from '../quick-request-attachment.ts';

/**
 * plan 98 D-1 · D-2 · D-9 · AC-04 · AC-05 · AC-18 — 실행: `node --test src/features/quick-request/schemas/__tests__/`
 */

describe('classifyQuickChatAttachment (D-1 확장자 1차 · MIME 보조 · 10MB)', () => {
  it('이미지·문서·압축 allowlist 통과 + kind 분류', () => {
    assert.deepEqual(classifyQuickChatAttachment({ name: 'photo.JPG', size: 10, mime: 'image/jpeg' }), {
      ok: true,
      kind: 'image',
      extension: 'jpg',
      mimeType: 'image/jpeg'
    });
    assert.equal(classifyQuickChatAttachment({ name: 'a.pdf', size: 10, mime: 'application/pdf' }).kind, 'file');
    assert.equal(classifyQuickChatAttachment({ name: 'a.zip', size: 10, mime: 'application/zip' }).ok, true);
    assert.equal(classifyQuickChatAttachment({ name: 'a.heic', size: 10, mime: '' }).kind, 'image');
  });

  it('hwp·docx를 브라우저가 octet-stream으로 보내도 통과 (확장자 1차)', () => {
    assert.equal(
      classifyQuickChatAttachment({ name: '견적서.hwp', size: 10, mime: 'application/octet-stream' }).ok,
      true
    );
    assert.equal(classifyQuickChatAttachment({ name: '견적서.docx', size: 10, mime: null }).ok, true);
  });

  it('실행 파일·확장자 없음·allowlist 밖 MIME → 「허용되지 않는 파일 형식입니다.」 (AC-04 · AC-05)', () => {
    for (const name of ['evil.exe', 'a.js', 'a.sh', 'a.bat', 'a.apk', 'noext', '.hidden', 'a.png.exe']) {
      const result = classifyQuickChatAttachment({ name, size: 10, mime: 'application/octet-stream' });
      assert.equal(result.ok, false, name);
      assert.equal(result.message, QUICK_CHAT_ATTACHMENT_MESSAGES.invalidType, name);
    }
    const spoofed = classifyQuickChatAttachment({ name: 'a.png', size: 10, mime: 'application/x-msdownload' });
    assert.equal(spoofed.ok, false);
    assert.equal(spoofed.message, QUICK_CHAT_ATTACHMENT_MESSAGES.invalidType);
  });

  it('10MB 초과·0바이트 → 「파일당 용량은 10MB 이하여야 합니다.」', () => {
    const big = classifyQuickChatAttachment({ name: 'a.png', size: 11 * 1024 * 1024, mime: 'image/png' });
    assert.equal(big.ok, false);
    assert.equal(big.message, QUICK_CHAT_ATTACHMENT_MESSAGES.fileTooLarge);
    assert.equal(classifyQuickChatAttachment({ name: 'a.png', size: QUICK_CHAT_ATTACHMENT_MAX_BYTES, mime: 'image/png' }).ok, true);
    assert.equal(classifyQuickChatAttachment({ name: 'a.png', size: 0, mime: 'image/png' }).ok, false);
  });

  it('확장자 추출은 경로·대문자·끝 점 처리', () => {
    assert.equal(getQuickChatAttachmentExtension('C:\\\\tmp\\\\A.PNG'), 'png');
    assert.equal(getQuickChatAttachmentExtension('dir/file.tar.gz'), 'gz');
    assert.equal(getQuickChatAttachmentExtension('file.'), '');
    assert.equal(getQuickChatAttachmentExtension('.env'), '');
  });

  it('accept 문자열에 확장자·image/*·pdf 포함', () => {
    assert.ok(QUICK_CHAT_ATTACHMENT_ACCEPT.includes('.hwp'));
    assert.ok(QUICK_CHAT_ATTACHMENT_ACCEPT.includes('image/*'));
    assert.ok(QUICK_CHAT_ATTACHMENT_ACCEPT.includes('application/pdf'));
    assert.ok(!QUICK_CHAT_ATTACHMENT_ACCEPT.includes('.exe'));
  });
});

describe('summarizeAttachments · buildChatBodyWithAttachmentSummary (D-9 · AC-02 · AC-18)', () => {
  it('사진 N장 · 파일 N개 · 둘 다', () => {
    assert.equal(summarizeAttachments(['image']), '사진 1장');
    assert.equal(summarizeAttachments(['file', 'file']), '파일 2개');
    assert.equal(summarizeAttachments(['image', 'image', 'file']), '사진 2장·파일 1개');
    assert.equal(summarizeAttachments([]), '');
  });

  it('본문 있음 → `{본문} (사진 2장·파일 1개)` · 본문 없음 → 요약만 · 첨부 없음 → 본문 그대로', () => {
    assert.equal(buildChatBodyWithAttachmentSummary('확인 부탁', ['image', 'image', 'file']), '확인 부탁 (사진 2장·파일 1개)');
    assert.equal(buildChatBodyWithAttachmentSummary('', ['image']), '사진 1장');
    assert.equal(buildChatBodyWithAttachmentSummary('  안녕  ', []), '안녕');
  });
});

describe('quickChatAttachmentsPrepareSchema (AC-05)', () => {
  it('31개 → tooMany 문구 · 0개·비객체 → 형식 오류', () => {
    const files = Array.from({ length: QUICK_CHAT_ATTACHMENT_MAX_COUNT + 1 }, (_, i) => ({ name: `a${i}.png`, size: 1 }));
    const tooMany = quickChatAttachmentsPrepareSchema.safeParse({ files });
    assert.equal(tooMany.success, false);
    assert.ok(tooMany.error.issues.some((issue) => issue.message === QUICK_CHAT_ATTACHMENT_MESSAGES.tooMany));
    assert.equal(quickChatAttachmentsPrepareSchema.safeParse({ files: [] }).success, false);
    assert.equal(quickChatAttachmentsPrepareSchema.safeParse({}).success, false);
  });

  it('유효 1개 통과 · mime 생략 가능', () => {
    const ok = quickChatAttachmentsPrepareSchema.safeParse({ files: [{ name: 'a.png', size: 10 }] });
    assert.equal(ok.success, true);
  });
});

describe('parseQuickChatAttachmentId', () => {
  it('양의 정수만', () => {
    assert.equal(parseQuickChatAttachmentId('12'), 12);
    assert.equal(parseQuickChatAttachmentId('0'), null);
    assert.equal(parseQuickChatAttachmentId('-1'), null);
    assert.equal(parseQuickChatAttachmentId('abc'), null);
  });
});
