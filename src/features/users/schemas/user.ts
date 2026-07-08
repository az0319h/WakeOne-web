import * as z from 'zod';
import {
  AFFILIATIONS,
  SELECT_NONE_VALUE,
  validateOrganizationFields
} from '@/features/users/constants/organization';
import { refineBirthday } from '@/lib/birthday';

export const inviteUserSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.')
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

export const createUserSchema = z
  .object({
    email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
    affiliation: z.union([z.enum(AFFILIATIONS), z.literal('')]),
    department: z.string().min(1, '부서를 선택해 주세요.').max(100),
    rank: z.string().min(1, '직급을 선택해 주세요.').max(50),
    job_title: z.string().min(1, '직책을 선택해 주세요.').max(50),
    system_role: z.union([z.enum(['admin', 'user']), z.literal('')]),
    birthday: z.string().nullable()
  })
  .superRefine((data, ctx) => {
    if (!data.affiliation) {
      ctx.addIssue({
        code: 'custom',
        message: '소속을 선택해 주세요.',
        path: ['affiliation']
      });
    }

    if (!data.system_role) {
      ctx.addIssue({
        code: 'custom',
        message: '시스템 역할을 선택해 주세요.',
        path: ['system_role']
      });
    }

    if (!data.birthday) {
      ctx.addIssue({
        code: 'custom',
        message: '생일을 선택해 주세요.',
        path: ['birthday']
      });
    } else {
      refineBirthday(data.birthday, ctx);
    }

    if (data.affiliation) {
      validateOrganizationFields(
        {
          affiliation: data.affiliation,
          department: data.department,
          rank: data.rank,
          job_title: data.job_title
        },
        ctx
      );
    }
  });

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

const emptyToNull = (value: string | null | undefined) =>
  value == null || value === '' || value === SELECT_NONE_VALUE ? null : value;

export const userUpdateSchema = z
  .object({
    avatar_url: z.string().max(2048).optional(),
    affiliation: z
      .union([z.enum(AFFILIATIONS), z.literal(SELECT_NONE_VALUE)])
      .optional(),
    department: z
      .union([z.string().max(100), z.literal(SELECT_NONE_VALUE)])
      .optional(),
    rank: z
      .union([z.string().max(50), z.literal(SELECT_NONE_VALUE)])
      .optional(),
    job_title: z
      .union([z.string().max(50), z.literal(SELECT_NONE_VALUE)])
      .optional(),
    system_role: z.enum(['admin', 'user'], {
      message: '시스템 역할을 선택해 주세요.'
    }),
    birthday: z.string().nullable().optional()
  })
  .superRefine((data, ctx) => {
    refineBirthday(data.birthday, ctx);

    if (data.avatar_url?.trim()) {
      const urlResult = z
        .string()
        .url()
        .max(2048)
        .safeParse(data.avatar_url.trim());
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
        affiliation: emptyToNull(data.affiliation) as
          (typeof AFFILIATIONS)[number] | null,
        department: emptyToNull(data.department),
        rank: emptyToNull(data.rank),
        job_title: emptyToNull(data.job_title)
      },
      ctx
    );
  });

export type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;
