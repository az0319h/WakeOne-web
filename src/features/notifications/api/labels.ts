export const MONITORED_USER_UPDATE_FIELDS = [
  'full_name',
  'avatar_url',
  'affiliation',
  'rank',
  'system_role',
  'birthday'
] as const;

export type MonitoredUserUpdateField = (typeof MONITORED_USER_UPDATE_FIELDS)[number];

export const FIELD_LABELS: Record<MonitoredUserUpdateField, string> = {
  full_name: '이름',
  avatar_url: '아바타',
  affiliation: '소속',
  rank: '직급',
  system_role: '시스템 역할',
  birthday: '생일'
};

export const USER_UPDATE_NOTIFICATION_TITLE = '프로필 정보가 변경되었습니다';

export function formatUserUpdateBody(changedFields: string[]): string {
  const labels = changedFields
    .map((field) => FIELD_LABELS[field as MonitoredUserUpdateField] ?? field)
    .filter(Boolean);

  const joined = labels.join(', ');
  return `${joined}이(가) 관리자에 의해 변경되었습니다.`;
}

export function filterMonitoredFields(changedFields: string[]): MonitoredUserUpdateField[] {
  const monitored = new Set<string>(MONITORED_USER_UPDATE_FIELDS);
  return changedFields.filter((field): field is MonitoredUserUpdateField =>
    monitored.has(field)
  );
}
