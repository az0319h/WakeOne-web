import { mutationOptions } from '@tanstack/react-query';
import { birthdayCelebrantsKeys } from '@/features/birthday-celebrants/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { userKeys } from '@/features/users/api/queries';
import { patchProfile, type PatchProfilePayload } from './profile.client';

export const patchProfileMutation = mutationOptions({
  mutationFn: (payload: PatchProfilePayload) => patchProfile(payload),
  onSettled: () => {
    const queryClient = getQueryClient();
    void queryClient.invalidateQueries({ queryKey: userKeys.all });
    void queryClient.invalidateQueries({ queryKey: birthdayCelebrantsKeys.all });
  }
});
