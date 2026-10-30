import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  QUICK_STATUS_SUMMARY_TEXT as TEXT,
  resolveQuickStatusSummary
} from '../quick-request-status-summary.ts';

/**
 * plan 106 D-15 · AC-43 — 상세 「지금 상태 한 문장」 문구표.
 * 실행: `node --test src/features/quick-request/lib/__tests__/`
 */

const NONE = { canAccept: false, canDispatch: false, canSetFinal: false, canApprove: false };

function input(status, permissions = {}, finalAmount = null) {
  return { status, finalAmount, permissions: { ...NONE, ...permissions } };
}

describe('resolveQuickStatusSummary (D-15 문구표)', () => {
  it('문구표 원문 그대로', () => {
    assert.equal(TEXT.requestedViewer, '동방특송이 요청을 확인하고 있습니다.');
    assert.equal(TEXT.requestedOperator, '새 요청입니다. 확인 후 접수해 주세요.');
    assert.equal(TEXT.dispatchingViewer, '동방특송이 배차하고 있습니다.');
    assert.equal(TEXT.dispatchingOperator, '배차가 끝나면 배차완료를 입력해 주세요.');
    assert.equal(
      TEXT.dispatchedNoFinalViewer,
      '배차가 완료되었습니다. 최종금액이 입력되면 승인할 수 있습니다.'
    );
    assert.equal(TEXT.dispatchedNoFinalOperator, '운송이 끝나면 최종금액을 입력해 주세요.');
    assert.equal(TEXT.dispatchedFinalViewer, '최종금액을 확인하고 승인해 주세요.');
    assert.equal(TEXT.dispatchedFinalOperator, '요청자의 승인을 기다리고 있습니다.');
    assert.equal(TEXT.approved, '승인이 끝난 요청입니다.');
    assert.equal(TEXT.cancelled, '취소된 요청입니다.');
  });

  it('requested — 접수 권한(동방·admin) / 요청자·참여자', () => {
    assert.equal(resolveQuickStatusSummary(input('requested', { canAccept: true })), TEXT.requestedOperator);
    assert.equal(resolveQuickStatusSummary(input('requested')), TEXT.requestedViewer);
  });

  it('dispatching — 배차 권한 / 그 밖', () => {
    assert.equal(resolveQuickStatusSummary(input('dispatching', { canDispatch: true })), TEXT.dispatchingOperator);
    assert.equal(resolveQuickStatusSummary(input('dispatching')), TEXT.dispatchingViewer);
  });

  it('dispatched · 최종금액 없음 — 최종금액 권한 / 요청자(승인 권한만)', () => {
    assert.equal(resolveQuickStatusSummary(input('dispatched', { canSetFinal: true })), TEXT.dispatchedNoFinalOperator);
    assert.equal(resolveQuickStatusSummary(input('dispatched', { canApprove: true })), TEXT.dispatchedNoFinalViewer);
    // admin이 요청자 본인 — 주 버튼 「최종금액 입력」과 맞춤
    assert.equal(
      resolveQuickStatusSummary(input('dispatched', { canSetFinal: true, canApprove: true })),
      TEXT.dispatchedNoFinalOperator
    );
    assert.equal(resolveQuickStatusSummary(input('dispatched')), TEXT.dispatchedNoFinalViewer);
  });

  it('dispatched · 최종금액 있음 — 승인 권한이면 왼쪽 열(admin 본인 건 포함) · 동방은 오른쪽 열', () => {
    assert.equal(resolveQuickStatusSummary(input('dispatched', { canApprove: true }, 20000)), TEXT.dispatchedFinalViewer);
    assert.equal(
      resolveQuickStatusSummary(input('dispatched', { canSetFinal: true, canApprove: true }, 20000)),
      TEXT.dispatchedFinalViewer
    );
    assert.equal(resolveQuickStatusSummary(input('dispatched', { canSetFinal: true }, 20000)), TEXT.dispatchedFinalOperator);
    assert.equal(resolveQuickStatusSummary(input('dispatched', {}, 0)), TEXT.dispatchedFinalViewer);
  });

  it('approved · cancelled — 권한 무관', () => {
    assert.equal(resolveQuickStatusSummary(input('approved', { canSetFinal: true })), TEXT.approved);
    assert.equal(resolveQuickStatusSummary(input('approved')), TEXT.approved);
    assert.equal(resolveQuickStatusSummary(input('cancelled', { canAccept: true })), TEXT.cancelled);
    assert.equal(resolveQuickStatusSummary(input('cancelled')), TEXT.cancelled);
  });
});
