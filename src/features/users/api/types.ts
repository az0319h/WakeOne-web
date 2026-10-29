import type {
  Affiliation,
  LeaderRole
} from '@/features/users/constants/organization';

export type UserFilters = {
  page?: number;
  limit?: number;
  systemRoles?: string;
  statuses?: string;
  search?: string;
  sort?: string;
  userId?: string;
  /** plan 95 — 동방특송 포함 (기본 false = 서버 제외). 사용자 관리·활동 로그·알림 「타인 보기」 콤보만 true */
  includeDongbang?: boolean;
};

export type UsersResponse = {
  success: boolean;
  time: string;
  message: string;
  total_users: number;
  offset: number;
  limit: number;
  users: User[];
};

export type ProfileStatus = 'active' | 'inactive' | 'pending_approval' | 'rejected';

export type User = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  birthday: string | null;
  system_role: 'admin' | 'user';
  invite_status: 'pending' | 'accepted';
  status: ProfileStatus;
  avatar_url: string | null;
  affiliation: Affiliation | null;
  rank: string | null;
  position_level: string | null;
  leader_role: LeaderRole | null;
  google_email: string | null;
  google_display_name: string | null;
  approval_requested_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

/** Dev-only pre-provision — same shape as approval (approveUserSchema). */
export type CreateUserPayload = ApproveUserPayload;

/** @deprecated Use CreateUserPayload. */
export type InvitePayload = {
  email: string;
};

export type UserUpdatePayload = {
  full_name?: string;
  phone?: string;
  avatar_url?: string | null;
  affiliation?: Affiliation | null;
  rank?: string | null;
  position_level?: string | null;
  leader_role?: LeaderRole | null;
  system_role?: 'admin' | 'user';
  birthday?: string | null;
};

export type ApproveUserPayload =
  | {
      email: string;
      full_name: string;
      phone: string;
      system_role: 'admin';
      birthday: null;
    }
  | {
      email: string;
      full_name: string;
      phone: string;
      affiliation: Affiliation;
      rank: string;
      position_level: string;
      leader_role?: LeaderRole | null;
      system_role: 'user';
      birthday: string | null;
    }
  /** plan 89 — 동방특송: 부서·직급 생략, 리더·생일 null (서버가 null 저장) */
  | {
      email: string;
      full_name: string;
      phone: string;
      affiliation: 'dongbang';
      leader_role: null;
      system_role: 'user';
      birthday: null;
    };

export type RejectUserPayload = {
  rejection_reason?: string | null;
};
