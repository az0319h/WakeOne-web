import * as z from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /\d/;

const PASSWORD_POLICY_MESSAGE = '비밀번호는 8자 이상이며 문자와 숫자를 모두 포함해야 합니다.';

export function isValidPasswordPolicy(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    HAS_LETTER.test(password) &&
    HAS_DIGIT.test(password)
  );
}

export const passwordFieldSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
  .refine((value) => HAS_LETTER.test(value) && HAS_DIGIT.test(value), {
    message: PASSWORD_POLICY_MESSAGE
  });

export function refinePasswordPolicy(
  password: string,
  ctx: z.RefinementCtx,
  path: string = 'new_password'
) {
  if (isValidPasswordPolicy(password)) {
    return;
  }

  ctx.addIssue({
    code: 'custom',
    message: PASSWORD_POLICY_MESSAGE,
    path: [path]
  });
}
