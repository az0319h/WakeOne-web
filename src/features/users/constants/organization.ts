import type { z } from 'zod';

export const SELECT_NONE_VALUE = '__none__' as const;

export const SELECT_NONE_OPTION = {
  value: SELECT_NONE_VALUE,
  label: '선택 안 함'
} as const;

export const AFFILIATIONS = ['wake', 'sans', 'sans_foundry'] as const;

export type Affiliation = (typeof AFFILIATIONS)[number];

export const AFFILIATION_OPTIONS = [
  { value: 'wake' as const, label: '웨이크' },
  { value: 'sans' as const, label: '산스' },
  { value: 'sans_foundry' as const, label: '산스파운드리' }
] as const;

export const DEPARTMENT_BY_AFFILIATION: Record<Affiliation, readonly string[]> = {
  wake: [
    '콘텐츠팀',
    '사업기획팀',
    '마케팅팀',
    '디자인팀',
    '구매물류팀',
    '인사팀',
    '회계팀',
    '사업본부',
    '경영본부'
  ],
  sans: ['익선(본점)', '신세계강남 스위트파크', '본사'],
  sans_foundry: ['생산팀', '품질팀', '공무팀', '지원팀', '물류팀']
};

export const RANK_BY_AFFILIATION: Record<Affiliation, readonly string[]> = {
  wake: ['사원', '주임', '대리', '과장', '팀장', 'COO', 'CEO'],
  sans: ['CEO', '점장', '부점장', '선임매니저', '매니저', '쉐프'],
  sans_foundry: ['CEO', '공장장', '팀장', '차장', '오퍼레이터']
};

export const JOB_TITLE_BY_AFFILIATION: Record<Affiliation, readonly string[]> = {
  wake: ['팀장', 'CEO', 'COO'],
  sans: ['CEO', '점장', '부점장', '선임매니저', '매니저', '쉐프'],
  sans_foundry: ['CEO', '공장장', '팀장', '차장', '오퍼레이터']
};

export function getAffiliationLabel(affiliation: Affiliation | null | undefined): string | null {
  if (!affiliation) return null;
  return AFFILIATION_OPTIONS.find((option) => option.value === affiliation)?.label ?? null;
}

type OrganizationFieldValues = {
  affiliation?: Affiliation | null;
  department?: string | null;
  rank?: string | null;
  job_title?: string | null;
};

export function validateOrganizationFields(
  data: OrganizationFieldValues,
  ctx: z.RefinementCtx
): void {
  const { affiliation, department, rank, job_title } = data;

  const orgFields = [
    { value: department, allowed: affiliation ? DEPARTMENT_BY_AFFILIATION[affiliation] : null, path: 'department', label: '부서' },
    { value: rank, allowed: affiliation ? RANK_BY_AFFILIATION[affiliation] : null, path: 'rank', label: '직급' },
    { value: job_title, allowed: affiliation ? JOB_TITLE_BY_AFFILIATION[affiliation] : null, path: 'job_title', label: '직책' }
  ] as const;

  for (const field of orgFields) {
    if (field.value == null || field.value === '') continue;

    if (!affiliation) {
      ctx.addIssue({
        code: 'custom',
        message: `${field.label}을(를) 설정하려면 소속을 먼저 선택해 주세요.`,
        path: [field.path]
      });
      continue;
    }

    if (!field.allowed?.includes(field.value)) {
      ctx.addIssue({
        code: 'custom',
        message: `소속에 맞지 않는 ${field.label}입니다.`,
        path: [field.path]
      });
    }
  }
}
