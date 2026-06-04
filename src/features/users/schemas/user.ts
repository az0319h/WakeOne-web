import * as z from 'zod';

export const inviteUserSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.')
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

export const userUpdateSchema = z.object({
  first_name: z.string().max(100),
  last_name: z.string().max(100),
  phone: z.string().max(50).nullable().optional(),
  system_role: z.enum(['admin', 'user'], {
    message: '시스템 역할을 선택해 주세요.'
  })
});

export type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;
