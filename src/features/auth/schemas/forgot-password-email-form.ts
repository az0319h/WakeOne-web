import * as z from 'zod';
import { DEFAULT_LOGIN_DOMAIN } from '@/features/auth/constants/login-domain-options';
import { buildSignInEmail } from '@/features/auth/schemas/sign-in-form';

const localPartSchema = z
  .string()
  .trim()
  .min(1, '이메일을 입력해 주세요.')
  .refine((value) => !value.includes('@'), '아이디에 @를 포함할 수 없습니다.');

const domainSchema = z
  .string()
  .trim()
  .min(1, '도메인을 선택하거나 입력해 주세요.')
  .refine((value) => !value.includes('@'), '도메인에 @를 포함할 수 없습니다.');

export const forgotPasswordEmailFormSchema = z
  .object({
    localPart: localPartSchema,
    domain: domainSchema
  })
  .superRefine((data, ctx) => {
    const local = data.localPart.trim();
    const domain = data.domain.trim();

    if (!local || !domain) {
      return;
    }

    const combinedEmail = buildSignInEmail(local, domain);
    const result = z
      .string()
      .email({ message: '올바른 이메일 주소를 입력해 주세요.' })
      .safeParse(combinedEmail);

    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        message: '올바른 이메일 주소를 입력해 주세요.',
        path: ['localPart']
      });
    }
  });

export type ForgotPasswordEmailFormValues = z.infer<typeof forgotPasswordEmailFormSchema>;

export const forgotPasswordEmailFormDefaultValues: ForgotPasswordEmailFormValues = {
  localPart: '',
  domain: DEFAULT_LOGIN_DOMAIN
};
