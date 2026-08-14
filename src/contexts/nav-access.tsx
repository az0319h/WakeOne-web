'use client';

import { createContext, use, useEffect, useState } from 'react';
import type { AuthProfile } from '@/features/auth/api/types';
import type { PermissionCheck } from '@/types';

interface NavAccessContextValue {
  profile: AuthProfile | null;
  hasMyContracts: boolean;
  patchProfile: (patch: Partial<AuthProfile>) => void;
}

const NavAccessContext = createContext<NavAccessContextValue | null>(null);

export function NavAccessProvider({
  profile,
  hasMyContracts = false,
  children
}: {
  profile: AuthProfile | null;
  hasMyContracts?: boolean;
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
    <NavAccessContext value={{ profile: liveProfile, hasMyContracts, patchProfile }}>
      {children}
    </NavAccessContext>
  );
}

export function useNavAccess() {
  return use(NavAccessContext)?.profile ?? null;
}

export function useNavAccessFlags() {
  const context = use(NavAccessContext);
  return { hasMyContracts: context?.hasMyContracts ?? false };
}

export function useNavProfilePatch() {
  return use(NavAccessContext)?.patchProfile ?? (() => {});
}

export function checkNavAccess(
  access: PermissionCheck | undefined,
  profile: AuthProfile | null,
  flags?: { hasMyContracts?: boolean }
): boolean {
  if (!access) {
    return true;
  }

  if (access.hasMyContracts !== undefined) {
    return (flags?.hasMyContracts ?? false) === access.hasMyContracts;
  }

  if (access.systemRole !== undefined) {
    return profile?.system_role === access.systemRole;
  }

  return true;
}
