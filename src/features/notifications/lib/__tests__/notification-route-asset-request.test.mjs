import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { describe, it } from 'node:test';

/**
 * plan 103 AC-42 — `resolveNotificationRoute` 6 type (푸시 payload url 동일 함수).
 * notification-route.ts가 확장자 없는 상대 import(`../components/notification-helpers`)를 써서
 * Node ESM 해석이 실패하므로, 이 테스트 안에서만 `.ts`를 붙여 다시 찾는 resolve hook을 건다.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  }
});

const { resolveNotificationRoute, buildAssetRequestRoute } = await import('../notification-route.ts');
const { getNotificationActions } = await import('../../components/notification-helpers.ts');

const TYPES = [
  'asset_request.created',
  'asset_request.updated',
  'asset_request.canceled',
  'asset_request.status_changed',
  'asset_request.assigned',
  'asset_request.comment_created'
];

describe('resolveNotificationRoute — asset_request.* (plan 103)', () => {
  for (const type of TYPES) {
    it(`${type} · 비품 → /dashboard/equipment?view=requests&request={id}`, () => {
      assert.equal(
        resolveNotificationRoute({ type, metadata: { asset_request_id: 42, asset_target_type: 'equipment' } }),
        '/dashboard/equipment?view=requests&request=42'
      );
    });

    it(`${type} · 구독 → /dashboard/subscriptions?view=requests&request={id}`, () => {
      assert.equal(
        resolveNotificationRoute({ type, metadata: { asset_request_id: 7, asset_target_type: 'subscription' } }),
        '/dashboard/subscriptions?view=requests&request=7'
      );
    });

    it(`${type} · CTA 「요청 보기」`, () => {
      const actions = getNotificationActions({ type, metadata: {} });
      assert.equal(actions[0]?.id, 'view-asset-request');
      assert.equal(actions[0]?.label, '요청 보기');
    });
  }

  it('metadata가 없으면 기본 경로(비품 요청 화면)', () => {
    assert.equal(
      resolveNotificationRoute({ type: 'asset_request.created', metadata: {} }),
      '/dashboard/equipment?view=requests'
    );
  });

  it('buildAssetRequestRoute — id 없거나 잘못되면 요청 화면까지만', () => {
    assert.equal(buildAssetRequestRoute('subscription', undefined), '/dashboard/subscriptions?view=requests');
    assert.equal(buildAssetRequestRoute('equipment', -1), '/dashboard/equipment?view=requests');
    assert.equal(buildAssetRequestRoute('other', 3), null);
  });

  it('기존 support 경로는 그대로', () => {
    assert.equal(
      resolveNotificationRoute({ type: 'support.created', metadata: { support_request_id: 3 } }),
      '/dashboard/support?support=3'
    );
  });
});
