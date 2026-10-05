import { apiClient } from '@/lib/api-client';
import type { Affiliation } from '@/features/users/constants/organization';
import type { OrgChartResponse } from './types';

export async function fetchOrgChart(
  affiliation: Affiliation
): Promise<OrgChartResponse> {
  return apiClient<OrgChartResponse>(`/org-chart?affiliation=${affiliation}`);
}
