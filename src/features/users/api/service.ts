import { apiClient } from '@/lib/api-client';
import type { UserFilters, UsersResponse, UserMutationPayload } from './types';

export async function getUsers(filters: UserFilters): Promise<UsersResponse> {
  const searchParams = new URLSearchParams();

  if (filters.page) searchParams.set('page', String(filters.page));
  if (filters.limit) searchParams.set('limit', String(filters.limit));
  if (filters.systemRoles) searchParams.set('systemRoles', filters.systemRoles);
  if (filters.organizations) searchParams.set('organizations', filters.organizations);
  if (filters.departments) searchParams.set('departments', filters.departments);
  if (filters.orgRoles) searchParams.set('orgRoles', filters.orgRoles);
  if (filters.search) searchParams.set('search', filters.search);
  if (filters.sort) searchParams.set('sort', filters.sort);

  const queryString = searchParams.toString();
  return apiClient<UsersResponse>(`/users${queryString ? `?${queryString}` : ''}`);
}

export async function createUser(data: UserMutationPayload) {
  return apiClient('/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateUser(id: string, data: UserMutationPayload) {
  return apiClient(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteUser(id: string) {
  return apiClient(`/users/${id}`, {
    method: 'DELETE'
  });
}
