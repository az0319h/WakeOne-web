import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createUser, deleteUser, inviteUser, reactivateUser, updateUser } from './service';
import { userKeys } from './queries';
import type { CreateUserPayload, InvitePayload, UserUpdatePayload } from './types';

function invalidateUsers() {
  getQueryClient().invalidateQueries({ queryKey: userKeys.all });
}

export const createUserMutation = mutationOptions({
  mutationFn: (data: CreateUserPayload) => createUser(data),
  onSettled: () => {
    invalidateUsers();
  }
});

/** @deprecated Use createUserMutation. */
export const inviteUserMutation = mutationOptions({
  mutationFn: (data: InvitePayload) => inviteUser(data),
  onSettled: () => {
    invalidateUsers();
  }
});

export const updateUserMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: UserUpdatePayload }) =>
    updateUser(id, values),
  onSettled: () => {
    invalidateUsers();
  }
});

export const deleteUserMutation = mutationOptions({
  mutationFn: (id: string) => deleteUser(id),
  onSettled: () => {
    invalidateUsers();
  }
});

export const reactivateUserMutation = mutationOptions({
  mutationFn: (id: string) => reactivateUser(id),
  onSettled: () => {
    invalidateUsers();
  }
});

