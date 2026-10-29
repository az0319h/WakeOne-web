"use client";

import { createContext, use, useEffect, useState } from "react";
import type { AuthProfile } from "@/features/auth/api/types";
import type { PermissionCheck } from "@/types";

interface NavAccessContextValue {
  profile: AuthProfile | null;
  hasMyContracts: boolean;
  hasHrBenefitsNav: boolean;
  hasWorkflowAdminNav: boolean;
  /** plan 103 — 구독·비품 권한자(admin · 웨이크 인사팀 · 웨이크 회계팀) · 처리 대기 배지 */
  isAssetManager: boolean;
  patchProfile: (patch: Partial<AuthProfile>) => void;
}

const NavAccessContext = createContext<NavAccessContextValue | null>(null);

export function NavAccessProvider({
  profile,
  hasMyContracts = false,
  hasHrBenefitsNav = false,
  hasWorkflowAdminNav = false,
  isAssetManager = false,
  children,
}: {
  profile: AuthProfile | null;
  hasMyContracts?: boolean;
  hasHrBenefitsNav?: boolean;
  hasWorkflowAdminNav?: boolean;
  isAssetManager?: boolean;
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
    <NavAccessContext
      value={{
        profile: liveProfile,
        hasMyContracts,
        hasHrBenefitsNav,
        hasWorkflowAdminNav,
        isAssetManager,
        patchProfile,
      }}
    >
      {children}
    </NavAccessContext>
  );
}

export function useNavAccess() {
  return use(NavAccessContext)?.profile ?? null;
}

export function useNavAccessFlags() {
  const context = use(NavAccessContext);
  return {
    hasMyContracts: context?.hasMyContracts ?? false,
    hasHrBenefitsNav: context?.hasHrBenefitsNav ?? false,
    hasWorkflowAdminNav: context?.hasWorkflowAdminNav ?? false,
    isAssetManager: context?.isAssetManager ?? false,
  };
}

export function useNavProfilePatch() {
  return use(NavAccessContext)?.patchProfile ?? (() => {});
}

export function checkNavAccess(
  access: PermissionCheck | undefined,
  profile: AuthProfile | null,
  flags?: {
    hasMyContracts?: boolean;
    hasHrBenefitsNav?: boolean;
    hasWorkflowAdminNav?: boolean;
    isAssetManager?: boolean;
  },
): boolean {
  if (!access) {
    return true;
  }

  if (access.hasMyContracts !== undefined) {
    return (flags?.hasMyContracts ?? false) === access.hasMyContracts;
  }

  if (access.hasHrBenefitsNav !== undefined) {
    return (flags?.hasHrBenefitsNav ?? false) === access.hasHrBenefitsNav;
  }

  if (access.hasWorkflowAdminNav !== undefined) {
    return (
      (flags?.hasWorkflowAdminNav ?? false) === access.hasWorkflowAdminNav
    );
  }

  if (access.isAssetManager !== undefined) {
    return (flags?.isAssetManager ?? false) === access.isAssetManager;
  }

  if (access.systemRole !== undefined) {
    return profile?.system_role === access.systemRole;
  }

  return true;
}
