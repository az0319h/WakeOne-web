import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChatNotificationTitle,
  buildQuickRequestChangedLabels,
  buildQuickRequestUpdatedBody,
  clipChatNotificationBody,
  QUICK_NOTIFICATION_TITLE_MAX_LENGTH
} from '../quick-notification-copy.ts';

/**
 * plan 94 D-11 · D-13 · AC-20 · AC-21 · AC-23 — 실행: `node --test src/features/quick-request/lib/__tests__/`
 */

describe('buildChatNotificationTitle (D-13)', () => {
  it('`{이름} · {요청번호}`', () => {
    assert.equal(buildChatNotificationTitle('2026-07', '김동방'), '김동방 · 2026-07');
  });

  it('이름 20자 클립 · 전체 30자 이내 (U-7)', () => {
    const longName = '가'.repeat(40);
    const title = buildChatNotificationTitle('2026-07', longName);
    assert.equal(title, `${'가'.repeat(20)} · 2026-07`);
    assert.ok(title.length <= QUICK_NOTIFICATION_TITLE_MAX_LENGTH);

    const longNo = '2026-123456';
    const title2 = buildChatNotificationTitle(longNo, longName);
    assert.ok(title2.length <= QUICK_NOTIFICATION_TITLE_MAX_LENGTH);
    assert.ok(title2.endsWith(` · ${longNo}`));
  });

  it('옛 형식 `{번호} · {이름} 메시지`가 아니다 (AC-23)', () => {
    const title = buildChatNotificationTitle('2026-07', '이요청');
    assert.equal(title.includes('메시지'), false);
    assert.equal(title.startsWith('이요청'), true);
  });
});

describe('clipChatNotificationBody', () => {
  it('200자 초과 → 199자 + …', () => {
    const body = 'a'.repeat(250);
    const clipped = clipChatNotificationBody(body);
    assert.equal(clipped.length, 200);
    assert.ok(clipped.endsWith('…'));
    assert.equal(clipChatNotificationBody('  알겠습니다  '), '알겠습니다');
  });
});

describe('buildQuickRequestChangedLabels (D-11)', () => {
  const destinationBefore = {
    roadAddress: '서울 강남구 테헤란로 1',
    detailAddress: '1층',
    contactName: '김담당',
    contactPhone: '01012345678',
    schedule: { mode: 'asap' },
    notes: [],
    memo: ''
  };

  it('AC-20 — 도착 상세주소 + 차량 종류 → `도착지 상세주소, 차량 종류` (표시 순서)', () => {
    const labels = buildQuickRequestChangedLabels([
      { key: 'vehicleTypes', before: ['다마스'], after: ['라보'] },
      { key: 'destination', before: destinationBefore, after: { ...destinationBefore, detailAddress: '2층' } }
    ]);
    assert.deepEqual(labels, ['도착지 상세주소', '차량 종류']);
  });

  it('위치 하위 필드 여러 개 · 하위 비교 불가면 상위 라벨', () => {
    assert.deepEqual(
      buildQuickRequestChangedLabels([
        {
          key: 'origin',
          before: destinationBefore,
          after: { ...destinationBefore, roadAddress: '부산 해운대구 1', contactPhone: '01099998888' }
        }
      ]),
      ['출발지 주소', '출발지 담당 연락처']
    );
    assert.deepEqual(buildQuickRequestChangedLabels([{ key: 'destination', before: null, after: destinationBefore }]), [
      '도착지'
    ]);
  });

  it('단순 필드 라벨 · 자동차등록번호', () => {
    assert.deepEqual(
      buildQuickRequestChangedLabels([
        { key: 'driverPhone', before: '01011112222', after: '01033334444' },
        { key: 'dispatchVehicleInfo', before: '오토바이 8514', after: '21마 6543' },
        { key: 'stopovers', before: [], after: [destinationBefore] }
      ]),
      ['경유지', '자동차등록번호', '기사 연락처']
    );
  });
});

describe('buildQuickRequestUpdatedBody (D-11 · AC-21)', () => {
  it('라벨 2개', () => {
    assert.equal(
      buildQuickRequestUpdatedBody('김동방', ['도착지 상세주소', '차량 종류']),
      '김동방님이 요청 내용을 수정했습니다. (도착지 상세주소, 차량 종류)'
    );
  });

  it('AC-21 ③ — 4개 → 3개 + 외 1개 · 120자 이내', () => {
    const body = buildQuickRequestUpdatedBody('관리자', ['물품 크기', '차량 종류', '차량 대수', '운임']);
    assert.equal(body, '관리자님이 요청 내용을 수정했습니다. (물품 크기, 차량 종류, 차량 대수 외 1개)');
    assert.ok(body.length <= 120);
  });

  it('라벨 없음 → 괄호 없음', () => {
    assert.equal(buildQuickRequestUpdatedBody('관리자', []), '관리자님이 요청 내용을 수정했습니다.');
  });
});
