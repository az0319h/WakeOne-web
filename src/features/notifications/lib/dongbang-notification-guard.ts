/**
 * plan 95 D-4 — `insertNotifications()` 동방특송 수신 가드 (순수 함수 · `node --test`).
 * 수신자가 동방특송이면 `isAllowedType`(= `isNotificationTypeAllowedForDongbang` · push-groups.ts)이 true인 행만 남기고
 * 나머지는 INSERT 전에 버린다. 동방이 아닌 수신자 행은 그대로 통과한다. 행 순서는 유지한다.
 *
 * 의존성을 인자로 받는 이유: Node 내장 러너는 `.ts` 안의 확장자 없는 상대 import(`./push-groups`)를 해석하지 못한다
 * (tsc `allowImportingTsExtensions` 없음). 호출부가 predicate를 넘기고, 테스트는 `../push-groups.ts`를 직접 import해 같은 함수를 넘긴다.
 */
export type DongbangGuardRow = {
  recipient_user_id: string;
  type: string;
};

export type DongbangGuardResult<T extends DongbangGuardRow> = {
  kept: T[];
  dropped: T[];
};

export function partitionNotificationRowsForDongbang<T extends DongbangGuardRow>(
  rows: readonly T[],
  dongbangRecipientIds: ReadonlySet<string>,
  isAllowedType: (type: string) => boolean
): DongbangGuardResult<T> {
  const kept: T[] = [];
  const dropped: T[] = [];

  for (const row of rows) {
    if (!dongbangRecipientIds.has(row.recipient_user_id)) {
      kept.push(row);
      continue;
    }
    if (isAllowedType(row.type)) {
      kept.push(row);
    } else {
      dropped.push(row);
    }
  }

  return { kept, dropped };
}

/** `console.warn` 1줄용 요약 — type별 drop 건수 (예: `announcement.published=3, support.created=1`) */
export function summarizeDroppedTypes(dropped: readonly DongbangGuardRow[]): string {
  const counts = new Map<string, number>();
  for (const row of dropped) {
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => `${type}=${count}`).join(', ');
}
