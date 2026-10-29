import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASSET_REQUEST_NOTIFICATION_TYPE_BY_EVENT,
  buildAssetRequestNotificationCopy,
  formatCommentPreview
} from '../notification-copy.ts';

/** plan 103 §알림 — 제목·본문·metadata allowlist (본문·금액·메모 금지) */

const ALLOWED_KEYS = new Set([
  'kind',
  'asset_request_id',
  'asset_target_type',
  'request_type',
  'previous_status',
  'new_status',
  'comment_id',
  'is_reply'
]);

const base = {
  targetType: 'equipment',
  requestId: 42,
  requestType: 'repair',
  requestTypeLabel: '고장·수리',
  targetLabel: 'N-012 · MacBook Air 13',
  requesterName: '직원 A'
};

describe('buildAssetRequestNotificationCopy', () => {
  it('6 type 매핑', () => {
    assert.deepEqual(Object.values(ASSET_REQUEST_NOTIFICATION_TYPE_BY_EVENT), [
      'asset_request.created',
      'asset_request.updated',
      'asset_request.canceled',
      'asset_request.status_changed',
      'asset_request.assigned',
      'asset_request.comment_created'
    ]);
  });

  it('AC-39 created metadata ⊆ {kind, asset_request_id, asset_target_type, request_type}', () => {
    const copy = buildAssetRequestNotificationCopy({ ...base, event: 'created' });
    assert.equal(copy.type, 'asset_request.created');
    assert.equal(copy.title, '새 비품 요청');
    assert.equal(copy.body, '직원 A · N-012 · MacBook Air 13 · 고장·수리');
    assert.deepEqual(Object.keys(copy.metadata).sort(), [
      'asset_request_id',
      'asset_target_type',
      'kind',
      'request_type'
    ]);
  });

  it('구독이면 「구독」', () => {
    const copy = buildAssetRequestNotificationCopy({
      ...base,
      targetType: 'subscription',
      requestType: 'cancel',
      requestTypeLabel: '해지',
      event: 'canceled'
    });
    assert.equal(copy.title, '구독 요청이 취소됐어요');
    assert.equal(copy.metadata.asset_target_type, 'subscription');
  });

  it('status_changed — previous/new_status · 반려 안내', () => {
    const started = buildAssetRequestNotificationCopy({
      ...base,
      event: 'status_changed',
      previousStatus: 'pending',
      newStatus: 'in_progress'
    });
    assert.equal(started.title, '요청이 처리중으로 바뀌었어요');
    assert.equal(started.metadata.new_status, 'in_progress');
    assert.equal(started.metadata.previous_status, 'pending');

    const rejected = buildAssetRequestNotificationCopy({
      ...base,
      event: 'status_changed',
      previousStatus: 'pending',
      newStatus: 'rejected'
    });
    assert.ok(rejected.body.endsWith('사유를 확인해 주세요'));
  });

  it('comment_created — 본문 미리보기 80자 · metadata에 본문 없음', () => {
    const longBody = '가'.repeat(120);
    const copy = buildAssetRequestNotificationCopy({
      ...base,
      event: 'comment_created',
      commentId: 7,
      isReply: true,
      commentBody: longBody
    });
    assert.equal(copy.title, '새 댓글 · N-012 · MacBook Air 13');
    assert.equal(copy.body, `${'가'.repeat(80)}…`);
    assert.equal(copy.metadata.comment_id, 7);
    assert.equal(copy.metadata.is_reply, true);
    for (const value of Object.values(copy.metadata)) {
      assert.notEqual(value, longBody);
    }
  });

  it('모든 이벤트 metadata 키는 allowlist 안', () => {
    for (const event of Object.keys(ASSET_REQUEST_NOTIFICATION_TYPE_BY_EVENT)) {
      const copy = buildAssetRequestNotificationCopy({
        ...base,
        event,
        previousStatus: 'pending',
        newStatus: 'in_progress',
        commentId: 1,
        isReply: false,
        commentBody: '비밀 본문'
      });
      for (const key of Object.keys(copy.metadata)) {
        assert.ok(ALLOWED_KEYS.has(key), `${event} metadata key ${key}`);
      }
    }
  });

  it('formatCommentPreview — 공백 정리', () => {
    assert.equal(formatCommentPreview('  a\n\n b  '), 'a b');
  });
});
