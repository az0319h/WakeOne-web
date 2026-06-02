export const SYSTEM_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' }
];

export const ORGANIZATION_OPTIONS = [
  { value: 'wake', label: 'WAKE' },
  { value: 'sans', label: 'SANS' },
  { value: 'ansan', label: 'ANSAN' }
];

export const DEPARTMENT_OPTIONS_BY_ORG: Record<string, { value: string; label: string }[]> = {
  wake: [
    { value: 'content', label: '콘텐츠팀' },
    { value: 'business-planning', label: '사업기획팀' },
    { value: 'marketing', label: '마케팅팀' },
    { value: 'design', label: '디자인팀' },
    { value: 'procurement-logistics', label: '구매물류팀' },
    { value: 'hr', label: '인사팀' },
    { value: 'accounting', label: '회계팀' }
  ],
  sans: [
    { value: 'ikseon-main', label: '익선(본점)' },
    { value: 'shinsegae-gangnam-sweetpark', label: '신세계강남 스위트파크' }
  ],
  ansan: [
    { value: 'production', label: '생산팀' },
    { value: 'quality', label: '품질팀' },
    { value: 'engineering', label: '공무팀' },
    { value: 'support', label: '지원팀' },
    { value: 'logistics', label: '물류팀' }
  ]
};

export const ORG_ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' }
];

export const INVITE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' }
];
