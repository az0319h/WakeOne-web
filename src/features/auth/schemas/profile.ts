import * as z from 'zod';
import { refineBirthday } from '@/lib/birthday';
import { PHONE_REGEX } from '@/lib/phone';

export const profileSchema = z
  .object({
    phone: z.string(),
    birthday: z.string().nullable(),
    food_restrictions: z.string().max(200).optional()
  })
  .superRefine((data, ctx) => {
    const phone = data.phone.trim();
    if (phone && !PHONE_REGEX.test(phone)) {
      ctx.addIssue({
        code: 'custom',
        message: '입력값이 올바르지 않습니다.',
        path: ['phone']
      });
    }
    refineBirthday(data.birthday, ctx);
  });

export type ProfileFormValues = z.infer<typeof profileSchema>;
