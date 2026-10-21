/** 아바타 이니셜 — 한글 3자 이상 이름은 뒤 2자(flex 동일), 그 외 앞 2자 */
export function getPersonInitials(name: string | null | undefined): string {
  const text = (name ?? '').trim();
  if (!text) return '?';
  if (/^[가-힣]{3,}$/.test(text)) return text.slice(-2);
  return text.slice(0, 2).toUpperCase();
}

/** 「웨이크 · 대리」 형식 소속 표기 (없으면 빈 문자열) */
export function formatAffiliation(member: {
  affiliation_label?: string | null;
  position_level?: string | null;
}): string {
  return [member.affiliation_label, member.position_level].filter(Boolean).join(' · ');
}
