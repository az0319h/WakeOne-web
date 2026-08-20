import * as z from 'zod';
import { isInitialUserPassword } from '@/lib/auth/initial-password';
import { passwordFieldSchema } from '@/lib/password';

const INITIAL_PASSWORD_BLOCKED_MESSAGE =
  '12341234a 비밀번호는 사용할 수 없습니다. 비밀번호를 변경해 주세요';

export const forcePasswordChangeSchema = z
  .object({
    new_password: passwordFieldSchema,
    confirm_password: z.string().min(1, '비밀번호 확인을 입력해 주세요.')
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: '새 비밀번호가 일치하지 않습니다.',
    path: ['confirm_password']
  })
  .refine((data) => !isInitialUserPassword(data.new_password), {
    message: INITIAL_PASSWORD_BLOCKED_MESSAGE,
    path: ['new_password']
  });

export type ForcePasswordChangeFormValues = z.infer<typeof forcePasswordChangeSchema>;

export const forcePasswordChangeDefaultValues: ForcePasswordChangeFormValues = {
  new_password: '',
  confirm_password: ''
};
