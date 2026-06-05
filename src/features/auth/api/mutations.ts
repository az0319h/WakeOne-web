import { mutationOptions } from '@tanstack/react-query';
import { patchProfile, type PatchProfilePayload } from './profile.client';

export const patchProfileMutation = mutationOptions({
  mutationFn: (payload: PatchProfilePayload) => patchProfile(payload)
});
