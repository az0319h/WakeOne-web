import * as z from 'zod';

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, '현재 비밀번호를 입력해 주세요.'),
    new_password: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다.'),
    confirm_password: z.string().min(1, '비밀번호 확인을 입력해 주세요.')
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: '새 비밀번호가 일치하지 않습니다.',
    path: ['confirm_password']
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
