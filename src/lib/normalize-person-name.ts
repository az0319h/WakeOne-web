/** 계약 독촉·지갑 매칭·내 계약서 author scope 공통 규칙: trim → 연속 공백 1칸 → lowercase */
export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
