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
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  system_role: 'admin' | 'user';
  invite_status: 'pending' | 'accepted';
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
};

export type InvitePayload = {
  email: string;
};

export type UserUpdatePayload = {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  system_role?: 'admin' | 'user';
};
