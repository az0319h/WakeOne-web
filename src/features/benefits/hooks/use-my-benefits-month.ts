"use client";

import { useEffect } from "react";
import { useQueryStates } from "nuqs";
import { parseAsBenefitsMonth } from "../lib/benefits-month-parser";
import { currentKstMonth, isValidBenefitsMonth, normalizeBenefitsMonth } from "../lib/kst-month";

export function useMyBenefitsMonth() {
  const [{ month }, setParams] = useQueryStates(
    { month: parseAsBenefitsMonth },
    { shallow: true },
  );

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("month");
    if (raw && !isValidBenefitsMonth(raw)) {
      void setParams({ month: currentKstMonth() });
    }
  }, [setParams]);

  const normalizedMonth = normalizeBenefitsMonth(month);

  function setMonth(next: string) {
    if (!isValidBenefitsMonth(next)) {
      return;
    }
    void setParams({ month: next });
  }

  return { month: normalizedMonth, setMonth };
}
