import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PUSH_GROUP_CATALOG,
  isNotificationTypeAllowedForDongbang,
  isPushGroupVisibleForDongbang,
  listPushGroupsForRole
} from '../push-groups.ts';

/**
 * plan 95 D-5 — 푸시 그룹 카탈로그 `dongbang_visible` · 실행: `node --test src/features/notifications/lib/__tests__/`
 * (Node 24 내장 러너 + 타입 스트리핑 · `.mjs`인 이유는 quick-request 테스트와 같다)
 */

describe('PUSH_GROUP_CATALOG dongbang_visible', () => {
  it('모든 그룹에 boolean 플래그가 있고 true는 profile·quick_request 2개뿐', () => {
    for (const group of PUSH_GROUP_CATALOG) {
      assert.equal(typeof group.dongbang_visible, 'boolean', `${group.key} dongbang_visible`);
    }
    assert.deepEqual(
      PUSH_GROUP_CATALOG.filter((group) => group.dongbang_visible).map((group) => group.key),
      ['profile', 'quick_request']
    );
  });
});

describe('listPushGroupsForRole', () => {
  it('기존 동작 유지 — user 8 · admin 9', () => {
    assert.equal(listPushGroupsForRole('user').length, 8);
    assert.equal(listPushGroupsForRole('admin').length, 9);
    assert.equal(listPushGroupsForRole('user', {}).length, 8);
    assert.equal(listPushGroupsForRole('user', { dongbang: false }).length, 8);
  });

  it('동방특송은 역할과 무관하게 profile·quick_request 2개만 (카탈로그 순서 유지)', () => {
    assert.deepEqual(
      listPushGroupsForRole('user', { dongbang: true }).map((group) => group.key),
      ['profile', 'quick_request']
    );
    assert.deepEqual(
      listPushGroupsForRole('admin', { dongbang: true }).map((group) => group.key),
      ['profile', 'quick_request']
    );
  });
});

describe('isPushGroupVisibleForDongbang', () => {
  it('profile·quick_request만 true · 나머지 7그룹과 null은 false', () => {
    assert.equal(isPushGroupVisibleForDongbang('profile'), true);
    assert.equal(isPushGroupVisibleForDongbang('quick_request'), true);
    for (const key of ['users', 'contract', 'wallet', 'announcement', 'support', 'benefit', 'workflow']) {
      assert.equal(isPushGroupVisibleForDongbang(key), false, key);
    }
    assert.equal(isPushGroupVisibleForDongbang(null), false);
  });
});

describe('isNotificationTypeAllowedForDongbang', () => {
  it('퀵 3종 + user.update는 허용', () => {
    for (const type of [
      'user.update',
      'quick_request.vendor_event',
      'quick_request.requester_event',
      'quick_request.chat_message'
    ]) {
      assert.equal(isNotificationTypeAllowedForDongbang(type), true, type);
    }
  });

  it('그 밖 type과 알 수 없는 type은 거부', () => {
    for (const type of [
      'announcement.published',
      'support.created',
      'workflow.approval_requested',
      'benefit.import_applicant',
      'wallet.balance_email',
      'contract.reminder_recipient',
      'user.approval_request_admin',
      'future.unknown_type'
    ]) {
      assert.equal(isNotificationTypeAllowedForDongbang(type), false, type);
    }
  });
});
