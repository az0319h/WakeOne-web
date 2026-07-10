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
    '사원',
    '주임',
    '대리',
    '과장',
    '팀장',
    '파트장',
    '마케터',
    '디자이너',
    'HR',
    '포토그래퍼',
    '총무',
    'COO',
    'CEO'
  ],
  sans: [
    'CEO',
    '점장',
    '부점장',
    '선임매니저',
    '매니저',
    '쉐프',
    '매장운영',
    '파티쉐'
  ],
  sans_foundry: ['CEO', '공장장', '공장 총괄', '팀장', '차장', '오퍼레이터']
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
      message: '직급을 설정하려면 소속을 먼저 선택해 주세요.',
      path: ['rank']
    });
    return;
  }

  const allowed = RANK_BY_AFFILIATION[affiliation];
  if (!allowed.includes(rank)) {
    ctx.addIssue({
      code: 'custom',
      message: '소속에 맞지 않는 직급입니다.',
      path: ['rank']
    });
  }
}
