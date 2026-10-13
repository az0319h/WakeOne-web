"use client";

import { useEffect } from "react";
import { useQueryStates } from "nuqs";
import { parseAsBenefitsMonth } from "../lib/benefits-month-parser";
import { normalizeBenefitsMonth, resolveBenefitsViewMonth } from "../lib/benefits-view-month";

export function useMyBenefitsMonth() {
  const [{ month }, setParams] = useQueryStates(
    { month: parseAsBenefitsMonth },
    { shallow: true },
  );

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("month");
    if (!raw) {
      return;
    }
    const resolved = resolveBenefitsViewMonth(raw);
    if (raw !== resolved) {
      void setParams({ month: resolved });
    }
  }, [setParams]);

  const normalizedMonth = normalizeBenefitsMonth(month);

  function setMonth(next: string) {
    void setParams({ month: resolveBenefitsViewMonth(next) });
  }

  return { month: normalizedMonth, setMonth };
}
