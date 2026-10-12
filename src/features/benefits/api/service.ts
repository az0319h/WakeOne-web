import { apiClientWithMessage } from "@/lib/api-client";
import type { BenefitsAdminFilters, BenefitsAdminResponse, MyBenefitsResponse } from "./types";

function buildQuery(path: string, filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function fetchBenefitsAdmin(filters: BenefitsAdminFilters) {
  return apiClientWithMessage<{ success: boolean; data: BenefitsAdminResponse }>(
    buildQuery("/benefits", {
      month: filters.month,
      affiliation: filters.affiliation,
      team: filters.team,
      name: filters.name,
    }),
  ).then((response) => response.data);
}

export function fetchMyBenefits(month: string, user?: string) {
  return apiClientWithMessage<{ success: boolean; data: MyBenefitsResponse }>(
    buildQuery("/my-benefits", {
      month,
      ...(user ? { user } : {}),
    }),
  ).then((response) => response.data);
}
