import { mutationOptions } from '@tanstack/react-query';
import { requestPasswordReset, verifyPasswordResetOtp } from './service';
import type { ForgotPasswordRequestPayload, ForgotPasswordVerifyPayload } from './types';

export const requestPasswordResetMutation = mutationOptions({
  mutationFn: (payload: ForgotPasswordRequestPayload) => requestPasswordReset(payload)
});

export const verifyPasswordResetMutation = mutationOptions({
  mutationFn: (payload: ForgotPasswordVerifyPayload) => verifyPasswordResetOtp(payload)
});
