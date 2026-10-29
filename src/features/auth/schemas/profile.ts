import * as z from 'zod';
import { refineBirthday } from '@/lib/birthday';
import { PHONE_REGEX } from '@/lib/phone';
import { PHONE_INPUT_ERROR } from '@/lib/phone-messages';

/** @deprecated Profile self-edit is disabled — Account is read-only. */
export const profileSchema = z
  .object({
    phone: z.string(),
    birthday: z.string().nullable()
  })
  .superRefine((data, ctx) => {
    const phone = data.phone.trim();
    if (phone && !PHONE_REGEX.test(phone)) {
      ctx.addIssue({
        code: 'custom',
        message: PHONE_INPUT_ERROR,
        path: ['phone']
      });
    }
    refineBirthday(data.birthday, ctx);
  });

export type ProfileFormValues = z.infer<typeof profileSchema>;
