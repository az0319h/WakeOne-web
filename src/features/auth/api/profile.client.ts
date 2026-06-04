import type { AuthProfile } from './types';

type PatchProfilePayload = {
  first_name: string;
  last_name: string;
  phone: string | null;
};

type PatchProfileResponse = {
  success: boolean;
  message: string;
  profile: AuthProfile;
};

export async function patchProfile(payload: PatchProfilePayload) {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = (await res.json()) as PatchProfileResponse & { message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? '프로필 저장에 실패했습니다.');
  }

  return data;
}
