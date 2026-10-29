import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BIRTHDAY_TAB_ALL,
  buildTodayBirthdayHeadline,
  filterCelebrantsByTab,
  findCenterIndex,
  formatDaysOffsetLabel,
  getBirthdayConfettiStorageKey,
  getBirthdayDaysOffset,
  isStaleBirthdayConfettiStorageKey,
  shouldFireBirthdayConfetti,
  sortCelebrants,
  toBirthdayMonthDay
} from '../birthday-order.ts';
import { formatBirthdayMonthDay } from '../../../../lib/birthday-month-day.ts';

/**
 * plan 102 AC-19 — 실행: `node --test src/features/birthday-celebrants/lib/__tests__/birthday-order.test.mjs`
 * (Node 24 내장 러너 + 타입 스트리핑 · 고정 기준일 · 실DB·메일 호출 없음)
 */

function person(full_name, days_offset, extra = {}) {
  return {
    user_id: `u-${full_name}`,
    full_name,
    avatar_url: null,
    affiliation: null,
    month_day: '01-01',
    days_offset,
    ...extra
  };
}

describe('AC-19 ① 연말 → 연초 (다가오는 생일)', () => {
  it('기준 2026-12-30 · 01-02 → 3', () => {
    assert.equal(getBirthdayDaysOffset('01-02', '2026-12-30'), 3);
  });
});

describe('AC-19 ② 연초 → 지난 연말 (지난 생일)', () => {
  it('기준 2027-01-02 · 12-30 → -3', () => {
    assert.equal(getBirthdayDaysOffset('12-30', '2027-01-02'), -3);
  });
});

describe('AC-19 ③ 반년 경계', () => {
  it('기준 2026-10-29 · 04-29(다음 생일까지 182일) → 182', () => {
    assert.equal(getBirthdayDaysOffset('04-29', '2026-10-29'), 182);
  });

  it('기준 2026-10-29 · 04-30(다음까지 183일 → 지난 생일 2026-04-30부터 182일) → -182', () => {
    assert.equal(getBirthdayDaysOffset('04-30', '2026-10-29'), -182);
  });

  it('오늘 생일 → 0 · 하루 전 → -1 · 하루 뒤 → 1', () => {
    assert.equal(getBirthdayDaysOffset('10-29', '2026-10-29'), 0);
    assert.equal(getBirthdayDaysOffset('10-28', '2026-10-29'), -1);
    assert.equal(getBirthdayDaysOffset('10-30', '2026-10-29'), 1);
  });

  it('366일 구간(윤일 포함)에서 앞뒤 183일 동률이면 D-3 문구대로 -183', () => {
    // 2027-12-01 → 2028-06-01 = 183일(2028-02-29 포함) · 2027-06-01 → 2027-12-01 = 183일
    assert.equal(getBirthdayDaysOffset('06-01', '2027-12-01'), -183);
  });

  it('2026-10-29 기준 1년 365개 날짜 전부 [-182, 182] 범위', () => {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 31; day += 1) {
        const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const offset = getBirthdayDaysOffset(monthDay, '2026-10-29');
        if (offset === null) {
          continue;
        }
        assert.ok(offset >= -182 && offset <= 182, `${monthDay} → ${offset}`);
      }
    }
  });
});

describe('AC-19 ④ 2월 29일', () => {
  it('평년 기준 2027-02-28 · 02-29 → 0 (2월 28일을 당일로)', () => {
    assert.equal(getBirthdayDaysOffset('02-29', '2027-02-28'), 0);
  });

  it('윤년 기준 2028-02-28 · 02-29 → 1', () => {
    assert.equal(getBirthdayDaysOffset('02-29', '2028-02-28'), 1);
  });

  it('윤년 기준 2028-02-29 · 02-29 → 0', () => {
    assert.equal(getBirthdayDaysOffset('02-29', '2028-02-29'), 0);
  });

  it('평년 2027-03-01 · 02-29 → -1 (지난 2월 28일)', () => {
    assert.equal(getBirthdayDaysOffset('02-29', '2027-03-01'), -1);
  });

  it('잘못된 입력은 null', () => {
    assert.equal(getBirthdayDaysOffset('02-30', '2026-10-29'), null);
    assert.equal(getBirthdayDaysOffset('13-01', '2026-10-29'), null);
    assert.equal(getBirthdayDaysOffset('1990-10-31', '2026-10-29'), null);
    assert.equal(getBirthdayDaysOffset('10-31', '2026-02-30'), null);
  });
});

describe('AC-19 ⑤ 정렬', () => {
  it('days_offset 오름차순 · 같으면 full_name 가나다', () => {
    const sorted = sortCelebrants([
      person('하늘', 5),
      person('나리', 0),
      person('가람', 0),
      person('다온', -3),
      person('마루', 182),
      person('바다', -182)
    ]);
    assert.deepEqual(
      sorted.map((c) => c.full_name),
      ['바다', '다온', '가람', '나리', '하늘', '마루']
    );
  });

  it('원본 배열은 바꾸지 않는다', () => {
    const input = [person('나', 2), person('가', 1)];
    sortCelebrants(input);
    assert.deepEqual(
      input.map((c) => c.full_name),
      ['나', '가']
    );
  });
});

describe('AC-19 ⑥ 가운데 index', () => {
  it('days_offset ≥ 0 첫 항목', () => {
    assert.equal(findCenterIndex([person('a', -5), person('b', -1), person('c', 0), person('d', 3)]), 2);
    assert.equal(findCenterIndex([person('a', -5), person('b', 4), person('c', 9)]), 1);
  });

  it('전부 음수면 마지막', () => {
    assert.equal(findCenterIndex([person('a', -9), person('b', -4), person('c', -1)]), 2);
  });

  it('빈 배열 → -1', () => {
    assert.equal(findCenterIndex([]), -1);
  });
});

describe('AC-19 ⑦ 남은 날 칩 라벨', () => {
  it('0 / 2 / -5 → D-DAY / D-2 / 5일 전', () => {
    assert.equal(formatDaysOffsetLabel(0), 'D-DAY');
    assert.equal(formatDaysOffsetLabel(2), 'D-2');
    assert.equal(formatDaysOffsetLabel(-5), '5일 전');
  });
});

describe('AC-19 ⑧ 오늘 생일 헤더 문구', () => {
  it('1명', () => {
    assert.equal(
      buildTodayBirthdayHeadline([person('다온', -2), person('가람', 0), person('나리', 3)]),
      '오늘은 가람님의 생일이에요!'
    );
  });

  it('2명 → 첫 이름 외 1명', () => {
    const list = sortCelebrants([person('나리', 0), person('가람', 0), person('다온', 4)]);
    assert.equal(buildTodayBirthdayHeadline(list), '오늘은 가람님 외 1명의 생일이에요!');
  });

  it('오늘 생일 없음 → null', () => {
    assert.equal(buildTodayBirthdayHeadline([person('가람', 1)]), null);
  });
});

describe('AC-19 ⑨ 컨페티 저장 키 · 발사 조건 (AC-15 ①)', () => {
  it("getBirthdayConfettiStorageKey('2026-10-31')", () => {
    assert.equal(
      getBirthdayConfettiStorageKey('2026-10-31'),
      'wakeone:birthday-confetti:2026-10-31'
    );
  });

  it('다른 날짜 키만 정리 대상', () => {
    assert.equal(
      isStaleBirthdayConfettiStorageKey('wakeone:birthday-confetti:2026-10-30', '2026-10-31'),
      true
    );
    assert.equal(
      isStaleBirthdayConfettiStorageKey('wakeone:birthday-confetti:2026-10-31', '2026-10-31'),
      false
    );
    assert.equal(isStaleBirthdayConfettiStorageKey('wakeone:other', '2026-10-31'), false);
  });

  it('오늘 생일 없는 목록 → false · 있으면 true', () => {
    assert.equal(shouldFireBirthdayConfetti([person('a', -1), person('b', 3)]), false);
    assert.equal(shouldFireBirthdayConfetti([]), false);
    assert.equal(shouldFireBirthdayConfetti([person('a', -1), person('b', 0)]), true);
  });
});

describe('AC-19 ⑩ formatBirthdayMonthDay (MM-DD 확장 · 기존 YYYY-MM-DD 회귀)', () => {
  it("('10-31') · ('1990-10-31') → 둘 다 10월 31일", () => {
    assert.equal(formatBirthdayMonthDay('10-31'), '10월 31일');
    assert.equal(formatBirthdayMonthDay('1990-10-31'), '10월 31일');
  });

  it('02-29 · ISO datetime · 잘못된 값', () => {
    assert.equal(formatBirthdayMonthDay('02-29'), '2월 29일');
    assert.equal(formatBirthdayMonthDay('1990-07-20T00:00:00+00:00'), '7월 20일');
    assert.equal(formatBirthdayMonthDay('1990-02-30'), null);
    assert.equal(formatBirthdayMonthDay('02-30'), null);
    assert.equal(formatBirthdayMonthDay(''), null);
    assert.equal(formatBirthdayMonthDay(null), null);
    assert.equal(formatBirthdayMonthDay(undefined), null);
  });
});

describe('보조 — 연도 제거 · 탭 필터', () => {
  it('toBirthdayMonthDay: YYYY-MM-DD → MM-DD · 잘못된 값 null', () => {
    assert.equal(toBirthdayMonthDay('1992-02-29'), '02-29');
    assert.equal(toBirthdayMonthDay('1990-10-31'), '10-31');
    assert.equal(toBirthdayMonthDay('10-31'), '10-31');
    assert.equal(toBirthdayMonthDay('1991-02-29'), null);
    assert.equal(toBirthdayMonthDay(null), null);
  });

  it('filterCelebrantsByTab: 소속 없음(null)은 전체에만', () => {
    const list = [
      person('a', 0, { affiliation: 'sans' }),
      person('b', 1, { affiliation: null }),
      person('c', 2, { affiliation: 'wake' }),
      person('d', 3, { affiliation: 'sans_foundry' })
    ];
    assert.deepEqual(
      filterCelebrantsByTab(list, BIRTHDAY_TAB_ALL).map((c) => c.full_name),
      ['a', 'b', 'c', 'd']
    );
    assert.deepEqual(
      filterCelebrantsByTab(list, 'sans').map((c) => c.full_name),
      ['a']
    );
    assert.deepEqual(
      filterCelebrantsByTab(list, 'wake').map((c) => c.full_name),
      ['c']
    );
    assert.deepEqual(
      filterCelebrantsByTab(list, 'sans_foundry').map((c) => c.full_name),
      ['d']
    );
  });
});
