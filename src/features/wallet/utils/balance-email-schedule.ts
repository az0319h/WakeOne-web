export const DUPLICATE_BALANCE_EMAIL_SCHEDULE_MESSAGE =
  '알림 1과 알림 2는 같은 시각으로 설정할 수 없습니다.';

export function hasDuplicateBalanceEmailSchedule(input: {
  slot2_enabled: boolean;
  hour: number;
  minute: number;
  hour2: number;
  minute2: number;
}): boolean {
  return (
    input.slot2_enabled &&
    input.hour === input.hour2 &&
    input.minute === input.minute2
  );
}

export function formatBalanceEmailTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
export type BalanceEmailScheduleSlot2Options = {
  slot2Enabled: boolean;
  hour2: number;
  minute2: number;
};

function formatBalanceEmailScheduleTimes(
  slots: Array<{ hour: number; minute: number }>
) {
  const formatted = slots.map((slot) => formatBalanceEmailTime(slot.hour, slot.minute));

  if (formatted.length === 1) {
    return formatted[0];
  }

  return `${formatted.join(', ')} (KST)`;
}

function getActiveScheduleSlots(
  hour: number,
  minute: number,
  slot2?: BalanceEmailScheduleSlot2Options
) {
  const slots = [{ hour, minute }];

  if (slot2?.slot2Enabled) {
    slots.push({ hour: slot2.hour2, minute: slot2.minute2 });
  }

  return slots;
}

/** Entry card · 한 줄 요약 */
export function formatBalanceEmailScheduleSummary(
  hour: number,
  minute: number,
  excludeWeekends: boolean,
  slot2?: BalanceEmailScheduleSlot2Options
) {
  const slots = getActiveScheduleSlots(hour, minute, slot2);
  const times = formatBalanceEmailScheduleTimes(slots);

  if (slots.length === 1) {
    return excludeWeekends ? `평일 ${times}` : `매일 ${times}`;
  }

  return excludeWeekends ? `평일 ${times}` : times;
}

/** Sheet · 이메일 알림 토글 보조 문구 */
export function formatBalanceEmailScheduleDelivery(
  hour: number,
  minute: number,
  excludeWeekends: boolean,
  slot2?: BalanceEmailScheduleSlot2Options
) {
  const slots = getActiveScheduleSlots(hour, minute, slot2);
  const times = formatBalanceEmailScheduleTimes(slots);

  if (slots.length === 1) {
    return excludeWeekends
      ? `평일 ${times}에 발송 (토·일 제외)`
      : `매일 ${times}에 발송`;
  }

  return excludeWeekends
    ? `평일 ${times}에 발송 (토·일 제외)`
    : `${times}에 발송`;
}
