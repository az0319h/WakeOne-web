import * as z from 'zod';

export const forgotPasswordVerifyFormSchema = z.object({
  token: z.string().regex(/^\d{6}$/, '6자리 인증번호를 입력해 주세요.')
});

export type ForgotPasswordVerifyFormValues = z.infer<typeof forgotPasswordVerifyFormSchema>;

export const forgotPasswordVerifyFormDefaultValues: ForgotPasswordVerifyFormValues = {
  token: ''
};
