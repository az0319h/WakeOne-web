import type { Affiliation } from '@/features/users/constants/organization';

export type UserFilters = {
  page?: number;
  limit?: number;
  systemRoles?: string;
  search?: string;
  sort?: string;
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

export type ProfileStatus = 'active' | 'inactive';

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
  created_at: string;
  updated_at: string;
};

export type CreateUserPayload = {
  email: string;
  full_name: string;
  affiliation: Affiliation;
  rank: string;
  system_role: 'admin' | 'user';
  birthday: string;
};

/** @deprecated Use CreateUserPayload. */
export type InvitePayload = {
  email: string;
};

export type UserUpdatePayload = {
  full_name?: string;
  avatar_url?: string | null;
  affiliation?: Affiliation | null;
  rank?: string | null;
  system_role?: 'admin' | 'user';
  birthday?: string | null;
};
