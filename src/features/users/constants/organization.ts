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

export const RANK_BY_AFFILIATION: Record<Affiliation, readonly string[]> = {
  wake: [
    '경영진',
    '사업기획팀',
    '마케팅팀',
    '디자인팀',
    '구매물류팀',
    '인사팀',
    '회계팀',
    '총무'
  ],
  sans: ['익선', '신세계강남'],
  sans_foundry: ['공장장', '생산팀', '품질팀', '공무팀', '지원팀', '물류팀']
};

export function getAffiliationLabel(
  affiliation: Affiliation | null | undefined
): string | null {
  if (!affiliation) return null;
  return AFFILIATION_OPTIONS.find((option) => option.value === affiliation)?.label ?? null;
}

type OrganizationFieldValues = {
  affiliation?: Affiliation | null;
  rank?: string | null;
};

export function validateOrganizationFields(
  data: OrganizationFieldValues,
  ctx: z.RefinementCtx
): void {
  const { affiliation, rank } = data;

  if (rank == null || rank === '') return;

  if (!affiliation) {
    ctx.addIssue({
      code: 'custom',
      message: '부서/사업장을 설정하려면 소속을 먼저 선택해 주세요.',
      path: ['rank']
    });
    return;
  }

  const allowed = RANK_BY_AFFILIATION[affiliation];
  if (!allowed.includes(rank)) {
    ctx.addIssue({
      code: 'custom',
      message: '소속에 맞지 않는 부서/사업장입니다.',
      path: ['rank']
    });
  }
}
