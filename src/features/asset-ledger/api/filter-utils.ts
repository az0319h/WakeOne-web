import {
  ASSET_DEFAULT_PER_PAGE,
  ASSET_PER_PAGE_OPTIONS,
  ASSET_SCOPES,
  type AssetScope
} from './types';

/**
 * plan 103 — 목록 query 공용 파서 (Route · FE service 직렬화 공용 · 순수 함수).
 * 상태(`status`): 없으면 기본 묶음 · `status=all`이면 상태 조건 없음(전체) · 쉼표/반복 키 모두 허용 · 모르는 값은 무시.
 */

export function readMulti(searchParams: URLSearchParams, key: string): string[] {
  const values = [...searchParams.getAll(key), ...searchParams.getAll(`${key}[]`)];
  return [
    ...new Set(
      values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ];
}

export function pickOne<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** `status` 파싱 — undefined = 기본 묶음 사용 · 'all' = 전체 상태 */
export function parseStatusParam<T extends string>(
  searchParams: URLSearchParams,
  allowed: readonly T[]
): T[] | undefined {
  const values = readMulti(searchParams, 'status');
  if (values.length === 0) return undefined;
  if (values.includes('all')) return [...allowed];
  const picked = values.filter((value): value is T => (allowed as readonly string[]).includes(value));
  return picked.length > 0 ? picked : undefined;
}

export function parsePage(searchParams: URLSearchParams): number {
  const page = Number(searchParams.get('page') ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parsePerPage(searchParams: URLSearchParams): number {
  const perPage = Number(searchParams.get('perPage') ?? searchParams.get('limit') ?? ASSET_DEFAULT_PER_PAGE);
  return (ASSET_PER_PAGE_OPTIONS as readonly number[]).includes(perPage) ? perPage : ASSET_DEFAULT_PER_PAGE;
}

export function parseScope(searchParams: URLSearchParams): AssetScope {
  return pickOne(searchParams.get('scope'), ASSET_SCOPES, 'all');
}

export function parseQuery(searchParams: URLSearchParams): string | undefined {
  const q = searchParams.get('q')?.trim();
  return q ? q.slice(0, 100) : undefined;
}

/** FE service용 — undefined·빈 값은 빼고 직렬화 */
export function toSearchParams(entries: Record<string, string | number | boolean | string[] | undefined | null>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
      continue;
    }
    params.set(key, value === true ? '1' : String(value));
  }
  return params;
}
