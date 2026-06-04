import { apiClient, apiClientWithMessage } from '@/lib/api-client';
import type { InvitePayload, UserFilters, UserUpdatePayload, UsersResponse } from './types';

export async function getUsers(filters: UserFilters): Promise<UsersResponse> {
  const searchParams = new URLSearchParams();

  if (filters.page) searchParams.set('page', String(filters.page));
  if (filters.limit) searchParams.set('limit', String(filters.limit));
  if (filters.systemRoles) searchParams.set('systemRoles', filters.systemRoles);
  if (filters.search) searchParams.set('search', filters.search);
  if (filters.sort) searchParams.set('sort', filters.sort);

  const queryString = searchParams.toString();
  return apiClient<UsersResponse>(`/users${queryString ? `?${queryString}` : ''}`);
}

export async function inviteUser(data: InvitePayload) {
  return apiClientWithMessage<{ success: boolean; message: string }>('/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateUser(id: string, data: UserUpdatePayload) {
  return apiClientWithMessage<{ success: boolean; message: string }>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteUser(id: string) {
  return apiClient(`/users/${id}`, {
    method: 'DELETE'
  });
}
