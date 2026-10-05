import type {
  Affiliation,
  LeaderRole
} from '@/features/users/constants/organization';

export type SystemRole = 'admin' | 'user';

export type ProfileStatus = 'active' | 'inactive' | 'pending_approval' | 'rejected';

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
  position_level: string | null;
  leader_role: LeaderRole | null;
  google_email?: string | null;
  google_display_name?: string | null;
  approval_requested_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
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
  PENDING_APPROVAL: '관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.',
  REJECTED: '가입 요청이 거절되었습니다. 관리자에게 문의해 주세요.',
  UNKNOWN: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'
} as const;
