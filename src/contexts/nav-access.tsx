'use client';

import { createContext, use } from 'react';
import type { AuthProfile } from '@/features/auth/api/types';
import { canAccessOfficeSnacks } from '@/features/office-snacks/api/access';
import type { PermissionCheck } from '@/types';

const NavAccessContext = createContext<AuthProfile | null>(null);

export function NavAccessProvider({
  profile,
  children
}: {
  profile: AuthProfile | null;
  children: React.ReactNode;
}) {
  return <NavAccessContext value={profile}>{children}</NavAccessContext>;
}

export function useNavAccess() {
  return use(NavAccessContext);
}

export function checkNavAccess(
  access: PermissionCheck | undefined,
  profile: AuthProfile | null
): boolean {
  if (!access) {
    return true;
  }

  if (access.systemRole !== undefined) {
    return profile?.system_role === access.systemRole;
  }

  if (access.officeSnacks) {
    return profile ? canAccessOfficeSnacks(profile) : false;
  }

  return true;
}
