"use client";

import { useEffect, useMemo, useState } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { OrgAffiliation } from "@/features/users/constants/organization";
import { parseAsBenefitsMonth } from "../lib/benefits-month-parser";
import { normalizeBenefitsMonth, resolveBenefitsViewMonth } from "../lib/benefits-view-month";
import type { BenefitsAdminFilters } from "../api/types";

const affiliationValues = ["wake", "sans", "sans_foundry"] as const;

const DEBOUNCE_MS = 500;

export function useBenefitsAdminFilters() {
  const [params, setParams] = useQueryStates(
    {
      affiliation: parseAsStringLiteral(affiliationValues).withDefault("wake"),
      month: parseAsBenefitsMonth,
      team: parseAsString,
      name: parseAsString,
    },
    { shallow: true },
  );

  const [nameInput, setNameInput] = useState(params.name ?? "");

  useEffect(() => {
    setNameInput(params.name ?? "");
  }, [params.name]);

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

  const debouncedSetName = useDebouncedCallback((value: string) => {
    const trimmed = value.trim();
    void setParams({ name: trimmed ? trimmed : null });
  }, DEBOUNCE_MS);

  const filters: BenefitsAdminFilters = useMemo(
    () => ({
      month: normalizeBenefitsMonth(params.month),
      affiliation: params.affiliation,
      ...(params.team?.trim() ? { team: params.team.trim() } : {}),
      ...(params.name?.trim() ? { name: params.name.trim() } : {}),
    }),
    [params.affiliation, params.month, params.name, params.team],
  );

  function setAffiliation(affiliation: OrgAffiliation) {
    setNameInput("");
    void setParams({ affiliation, team: null, name: null });
  }

  function setMonth(month: string) {
    void setParams({ month: resolveBenefitsViewMonth(month) });
  }

  function setTeam(team: string) {
    void setParams({ team: team === "all" ? null : team });
  }

  function onNameInputChange(value: string) {
    setNameInput(value);
    debouncedSetName(value);
  }

  const teamSelectValue =
    params.team && params.team.trim() ? params.team.trim() : "all";

  return {
    affiliation: params.affiliation,
    month: normalizeBenefitsMonth(params.month),
    teamSelectValue,
    nameInput,
    filters,
    setAffiliation,
    setMonth,
    setTeam,
    onNameInputChange,
  };
}
