import { mutationOptions } from '@tanstack/react-query';
import { forcePasswordChange } from './service';
import { changePassword } from './profile.client';
import type { ForcePasswordChangePayload } from './types';

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export const changePasswordMutation = mutationOptions({
  mutationFn: (payload: ChangePasswordPayload) => changePassword(payload)
});

export const forcePasswordChangeMutation = mutationOptions({
  mutationFn: (payload: ForcePasswordChangePayload) => forcePasswordChange(payload)
});
