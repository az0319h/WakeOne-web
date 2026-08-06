import * as z from 'zod';
import { DEFAULT_LOGIN_DOMAIN } from '@/features/auth/constants/login-domain-options';

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

export const signInFormSchema = z
  .object({
    localPart: localPartSchema,
    domain: domainSchema,
    password: z.string().min(1, { message: '비밀번호를 입력해 주세요.' })
  })
  .superRefine((data, ctx) => {
    const local = data.localPart.trim();
    const domain = data.domain.trim();

    // 필드 단위 검증(local/domain/password)이 이미 실패한 경우 중복 메시지 방지
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

export type SignInFormValues = z.infer<typeof signInFormSchema>;

export function buildSignInEmail(localPart: string, domain: string): string {
  return `${localPart.trim()}@${domain.trim()}`;
}

export const signInFormDefaultValues: SignInFormValues = {
  localPart: '',
  domain: DEFAULT_LOGIN_DOMAIN,
  password: ''
};
