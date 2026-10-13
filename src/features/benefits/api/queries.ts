import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { fetchBenefitsAdmin, fetchMyBenefits } from "./service";
import type { BenefitsAdminFilters } from "./types";

export const benefitKeys = {
  all: ["benefits"] as const,
  admin: (filters: BenefitsAdminFilters) => [...benefitKeys.all, "admin", filters] as const,
  mine: (month: string, user?: string) =>
    [...benefitKeys.all, "mine", month, user ?? "self"] as const,
};

export const benefitsAdminQueryOptions = (filters: BenefitsAdminFilters) =>
  queryOptions({
    queryKey: benefitKeys.admin(filters),
    queryFn: () => fetchBenefitsAdmin(filters),
    placeholderData: keepPreviousData,
  });

export const myBenefitsQueryOptions = (month: string, user?: string) =>
  queryOptions({
    queryKey: benefitKeys.mine(month, user),
    queryFn: () => fetchMyBenefits(month, user),
    placeholderData: keepPreviousData,
  });
