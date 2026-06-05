import * as z from 'zod';
import {
  AFFILIATIONS,
  SELECT_NONE_VALUE,
  validateOrganizationFields
} from '@/features/users/constants/organization';

export const inviteUserSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.')
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

const emptyToNull = (value: string | null | undefined) =>
  value == null || value === '' || value === SELECT_NONE_VALUE ? null : value;

export const userUpdateSchema = z
  .object({
    avatar_url: z.string().max(2048).optional(),
    affiliation: z.union([z.enum(AFFILIATIONS), z.literal(SELECT_NONE_VALUE)]).optional(),
    department: z.union([z.string().max(100), z.literal(SELECT_NONE_VALUE)]).optional(),
    rank: z.union([z.string().max(50), z.literal(SELECT_NONE_VALUE)]).optional(),
    job_title: z.union([z.string().max(50), z.literal(SELECT_NONE_VALUE)]).optional(),
    system_role: z.enum(['admin', 'user'], {
      message: '시스템 역할을 선택해 주세요.'
    })
  })
  .superRefine((data, ctx) => {
    if (data.avatar_url?.trim()) {
      const urlResult = z.string().url().max(2048).safeParse(data.avatar_url.trim());
      if (!urlResult.success) {
        ctx.addIssue({
          code: 'custom',
          message: '올바른 URL을 입력해 주세요.',
          path: ['avatar_url']
        });
      }
    }

    validateOrganizationFields(
      {
        affiliation: emptyToNull(data.affiliation) as (typeof AFFILIATIONS)[number] | null,
        department: emptyToNull(data.department),
        rank: emptyToNull(data.rank),
        job_title: emptyToNull(data.job_title)
      },
      ctx
    );
  });

export type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;
