export type UserFilters = {
  page?: number;
  limit?: number;
  systemRoles?: string;
  organizations?: string;
  departments?: string;
  orgRoles?: string;
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

export type User = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  system_role: 'admin' | 'user';
  organization: 'wake' | 'sans' | 'ansan' | null;
  department: string | null;
  org_role: 'owner' | 'manager' | 'member' | 'viewer' | null;
  invite_status: 'pending' | 'accepted' | 'expired' | null;
  created_at: string;
  updated_at: string;
};

export type UserMutationPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  system_role: 'admin' | 'user';
  organization: 'wake' | 'sans' | 'ansan';
  department: string;
  org_role: 'owner' | 'manager' | 'member' | 'viewer';
  invite_status: 'pending' | 'accepted' | 'expired';
};
