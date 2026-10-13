"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { WalletUserCombobox } from "@/features/wallet/components/wallet-user-combobox";
import type { MyBenefitsViewerProfile } from "../api/viewer-profile";
import { MyBenefitsDashboard } from "./my-benefits-dashboard";

interface MyBenefitsPageContentProps {
  isAdmin: boolean;
  viewerProfile: MyBenefitsViewerProfile;
}

export function MyBenefitsPageContent({ isAdmin, viewerProfile }: MyBenefitsPageContentProps) {
  const [{ benefits_user: benefitsUser }, setParams] = useQueryStates(
    { benefits_user: parseAsString.withDefault("self") },
    { shallow: true },
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">
      {isAdmin ? (
        <div className="flex justify-end">
          <WalletUserCombobox
            value={benefitsUser}
            onValueChange={(value) => void setParams({ benefits_user: value })}
          />
        </div>
      ) : null}
      <MyBenefitsDashboard
        isAdmin={isAdmin}
        benefitsUser={isAdmin ? benefitsUser : undefined}
        viewerProfile={viewerProfile}
      />
    </div>
  );
}
