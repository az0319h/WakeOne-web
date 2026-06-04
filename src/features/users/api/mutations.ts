import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { deleteUser, inviteUser, updateUser } from './service';
import { userKeys } from './queries';
import type { InvitePayload, UserUpdatePayload } from './types';

export const inviteUserMutation = mutationOptions({
  mutationFn: (data: InvitePayload) => inviteUser(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});

export const updateUserMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: UserUpdatePayload }) =>
    updateUser(id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});

export const deleteUserMutation = mutationOptions({
  mutationFn: (id: string) => deleteUser(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});

/** @deprecated Use inviteUserMutation */
export const createUserMutation = inviteUserMutation;
