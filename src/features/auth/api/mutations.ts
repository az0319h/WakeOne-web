import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { userKeys } from '@/features/users/api/queries';
import { patchProfile, type PatchProfilePayload } from './profile.client';

export const patchProfileMutation = mutationOptions({
  mutationFn: (payload: PatchProfilePayload) => patchProfile(payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});
