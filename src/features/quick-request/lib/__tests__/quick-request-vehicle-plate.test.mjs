import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isVehiclePlate,
  normalizeVehiclePlate,
  QUICK_REQUEST_VEHICLE_PLATE_INVALID_MESSAGE,
  QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH,
  QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE,
  quickRequestVehiclePlateSchema
} from '../quick-request-vehicle-plate.ts';

/**
 * plan 94 D-9 · AC-17 — 실행: `node --test src/features/quick-request/lib/__tests__/`
 */

describe('normalizeVehiclePlate', () => {
  it('trim + 연속 공백 1칸', () => {
    assert.equal(normalizeVehiclePlate('  21마   6543 '), '21마 6543');
    assert.equal(normalizeVehiclePlate('서울\t강남\n가 1234'), '서울 강남 가 1234');
  });
});

describe('isVehiclePlate', () => {
  it('AC-17 통과 3종', () => {
    assert.equal(isVehiclePlate('21마 6543'), true);
    assert.equal(isVehiclePlate('서울 12가 3456'), true);
    assert.equal(isVehiclePlate('서울 강남 가 1234'), true);
  });

  it('공백 없는 변형 · 3자리 앞번호 · 1자리 지역 번호', () => {
    assert.equal(isVehiclePlate('21마6543'), true);
    assert.equal(isVehiclePlate('123가 4567'), true);
    assert.equal(isVehiclePlate('서울1가3456'), true);
    assert.equal(isVehiclePlate('경기 성남 나 9876'), true);
  });

  it('AC-17 거부 2종 + 빈 값·길이 초과', () => {
    assert.equal(isVehiclePlate('오토바이 8514'), false);
    assert.equal(isVehiclePlate('abc'), false);
    assert.equal(isVehiclePlate(''), false);
    assert.equal(isVehiclePlate('   '), false);
    assert.equal(isVehiclePlate('1마 6543'), false);
    assert.equal(isVehiclePlate('21마 65431'), false);
    assert.equal(isVehiclePlate(`${'서울 '.repeat(5)}가 1234`), false);
  });
});

describe('quickRequestVehiclePlateSchema', () => {
  it('정규화된 값을 돌려준다', () => {
    const result = quickRequestVehiclePlateSchema.safeParse('  21마   6543 ');
    assert.equal(result.success, true);
    assert.equal(result.data, '21마 6543');
  });

  it('빈 값 → required 문구 · 형식 오류 → invalid 문구 (AC-17 「API 400 같은 문구」)', () => {
    const empty = quickRequestVehiclePlateSchema.safeParse('   ');
    assert.equal(empty.success, false);
    assert.equal(empty.error.issues[0].message, QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE);

    for (const value of ['오토바이 8514', 'abc', 'a'.repeat(QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH + 1)]) {
      const invalid = quickRequestVehiclePlateSchema.safeParse(value);
      assert.equal(invalid.success, false, value);
      assert.equal(invalid.error.issues[0].message, QUICK_REQUEST_VEHICLE_PLATE_INVALID_MESSAGE, value);
    }

    const notString = quickRequestVehiclePlateSchema.safeParse(1234);
    assert.equal(notString.success, false);
    assert.equal(notString.error.issues[0].message, QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE);
  });
});
