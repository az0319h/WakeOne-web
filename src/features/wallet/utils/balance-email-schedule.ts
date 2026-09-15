export function formatBalanceEmailTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Entry card · 한 줄 요약 */
export function formatBalanceEmailScheduleSummary(
  hour: number,
  minute: number,
  excludeWeekends: boolean
) {
  const time = formatBalanceEmailTime(hour, minute);
  return excludeWeekends ? `평일 ${time}` : `매일 ${time}`;
}

/** Sheet · 이메일 알림 토글 보조 문구 */
export function formatBalanceEmailScheduleDelivery(
  hour: number,
  minute: number,
  excludeWeekends: boolean
) {
  const time = formatBalanceEmailTime(hour, minute);
  return excludeWeekends
    ? `평일 ${time}에 발송 (토·일 제외)`
    : `매일 ${time}에 발송`;
}
