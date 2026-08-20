import type { Affiliation } from '@/features/users/constants/organization';

export type SystemRole = 'admin' | 'user';

export type ProfileStatus = 'active' | 'inactive';

export type AuthProfile = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  birthday: string | null;
  system_role: SystemRole;
  password_set_at: string | null;
  status: ProfileStatus;
  avatar_url: string | null;
  affiliation: Affiliation | null;
  rank: string | null;
};

export type SignInPayload = {
  email: string;
  password: string;
};

export type SignInResult =
  | { ok: true; mustChange: boolean }
  | { ok: false; message: string };

export type ForcePasswordChangePayload = {
  new_password: string;
  confirm_password: string;
};

export type ForcePasswordChangeResponse = {
  success: boolean;
  message?: string;
};

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  ACCOUNT_DISABLED: '비활성화된 계정입니다.',
  UNKNOWN: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'
} as const;
