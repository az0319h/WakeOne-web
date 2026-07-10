import { mutationOptions } from '@tanstack/react-query';
import { changePassword } from './profile.client';

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export const changePasswordMutation = mutationOptions({
  mutationFn: (payload: ChangePasswordPayload) => changePassword(payload)
});
