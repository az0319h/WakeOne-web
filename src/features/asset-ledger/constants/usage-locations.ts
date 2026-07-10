/** Fixed usage locations (legacy profile departments + 미지정). */
export const USAGE_LOCATION_OPTIONS = [
  // wake
  '콘텐츠팀',
  '사업기획팀',
  '마케팅팀',
  '디자인팀',
  '구매물류팀',
  '인사팀',
  '회계팀',
  '사업본부',
  '경영본부',
  // sans
  '익선(본점)',
  '신세계강남 스위트파크',
  '본사',
  // sans_foundry
  '생산팀',
  '품질팀',
  '공무팀',
  '지원팀',
  '물류팀',
  '미지정'
] as const;

export type UsageLocationOption = (typeof USAGE_LOCATION_OPTIONS)[number];
