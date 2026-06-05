import type { AuthProfile } from './types';

export type PatchProfilePayload = {
  first_name: string;
  last_name: string;
  phone: string | null;
  food_restrictions: string | null;
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

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export async function changePassword(payload: ChangePasswordPayload) {
  const res = await fetch('/api/profile/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = (await res.json()) as { success: boolean; message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? '비밀번호 변경에 실패했습니다.');
  }

  return data;
}
