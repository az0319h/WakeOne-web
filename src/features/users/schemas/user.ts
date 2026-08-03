import * as z from 'zod';
import {
  AFFILIATIONS,
  SELECT_NONE_VALUE,
  validateOrganizationFields
} from '@/features/users/constants/organization';
import { refineBirthday } from '@/lib/birthday';
import { PHONE_REGEX } from '@/lib/phone';

const requiredPhoneSchema = z
  .string()
  .min(1, '연락처를 입력해 주세요.')
  .regex(PHONE_REGEX, '연락처는 11자리 숫자만 입력할 수 있습니다.');

export const inviteUserSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.')
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

export const createUserSchema = z
  .object({
    email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
    full_name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100),
    affiliation: z.union([z.enum(AFFILIATIONS), z.literal('')]),
    rank: z.string().min(1, '부서/사업장을 선택해 주세요.').max(50),
    system_role: z.union([z.enum(['admin', 'user']), z.literal('')]),
    birthday: z.string().nullable(),
    phone: requiredPhoneSchema
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
          rank: data.rank
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
    full_name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100).optional(),
    avatar_url: z.string().max(2048).optional(),
    affiliation: z
      .union([z.enum(AFFILIATIONS), z.literal(SELECT_NONE_VALUE)])
      .optional(),
    rank: z
      .union([z.string().max(50), z.literal(SELECT_NONE_VALUE)])
      .optional(),
    system_role: z.enum(['admin', 'user'], {
      message: '시스템 역할을 선택해 주세요.'
    }),
    birthday: z.string().nullable().optional(),
    phone: requiredPhoneSchema
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
        rank: emptyToNull(data.rank)
      },
      ctx
    );
  });

export type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;
