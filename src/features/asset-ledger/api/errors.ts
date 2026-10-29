/**
 * plan 103 — 구독·비품·요청 service가 던지는 「예상된 실패」. Route는 status·message를 그대로 응답하고
 * activity log에 같은 status로 기록한다. 그 밖의 Error는 500.
 * message는 고정 문구만 쓴다(사용자 입력값·메모·본문을 넣지 않는다 — 로그 metadata로 들어가므로).
 */
export class AssetLedgerError extends Error {
  readonly status: number;
  readonly field: string | null;

  constructor(status: number, message: string, field: string | null = null) {
    super(message);
    this.name = 'AssetLedgerError';
    this.status = status;
    this.field = field;
  }
}

export function isAssetLedgerError(error: unknown): error is AssetLedgerError {
  return error instanceof AssetLedgerError;
}

/** PostgREST/Postgres 오류 코드 (supabase-js `error.code`) */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
