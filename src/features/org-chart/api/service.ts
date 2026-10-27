import { apiClient } from '@/lib/api-client';
import type { OrgAffiliation } from '@/features/users/constants/organization';
import type { OrgChartResponse } from './types';

export async function fetchOrgChart(
  affiliation: OrgAffiliation
): Promise<OrgChartResponse> {
  return apiClient<OrgChartResponse>(`/org-chart?affiliation=${affiliation}`);
}
