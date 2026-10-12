import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { fetchBenefitsAdmin, fetchMyBenefits } from "./service";
import type { BenefitsAdminFilters } from "./types";

export const benefitKeys = {
  all: ["benefits"] as const,
  admin: (filters: BenefitsAdminFilters) => [...benefitKeys.all, "admin", filters] as const,
  mine: (month: string) => [...benefitKeys.all, "mine", month] as const,
};

export const benefitsAdminQueryOptions = (filters: BenefitsAdminFilters) =>
  queryOptions({
    queryKey: benefitKeys.admin(filters),
    queryFn: () => fetchBenefitsAdmin(filters),
    placeholderData: keepPreviousData,
  });

export const myBenefitsQueryOptions = (month: string) =>
  queryOptions({
    queryKey: benefitKeys.mine(month),
    queryFn: () => fetchMyBenefits(month),
    placeholderData: keepPreviousData,
  });
