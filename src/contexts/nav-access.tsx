'use client';

import { createContext, use, useEffect, useState } from 'react';
import type { AuthProfile } from '@/features/auth/api/types';
import { canAccessOfficeSnacks } from '@/features/office-snacks/api/access';
import type { PermissionCheck } from '@/types';

interface NavAccessContextValue {
  profile: AuthProfile | null;
  patchProfile: (patch: Partial<AuthProfile>) => void;
}

const NavAccessContext = createContext<NavAccessContextValue | null>(null);

export function NavAccessProvider({
  profile,
  children
}: {
  profile: AuthProfile | null;
  children: React.ReactNode;
}) {
  const [liveProfile, setLiveProfile] = useState(profile);

  useEffect(() => {
    setLiveProfile(profile);
  }, [profile]);

  function patchProfile(patch: Partial<AuthProfile>) {
    setLiveProfile((current) => (current ? { ...current, ...patch } : current));
  }

  return (
    <NavAccessContext value={{ profile: liveProfile, patchProfile }}>{children}</NavAccessContext>
  );
}

export function useNavAccess() {
  return use(NavAccessContext)?.profile ?? null;
}

export function useNavProfilePatch() {
  return use(NavAccessContext)?.patchProfile ?? (() => {});
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
