import { apiClient } from '@/lib/api-client';
import type { BirthdayCelebrantsResponse } from './types';

type BirthdayCelebrantsApiResponse = {
  success: boolean;
  data: BirthdayCelebrantsResponse;
};

/** plan 102 — `GET /api/birthdays` (회사 전체 생일 목록 · 정렬 완료) */
export async function fetchBirthdayCelebrants(): Promise<BirthdayCelebrantsResponse> {
  const response = await apiClient<BirthdayCelebrantsApiResponse>('/birthdays');
  return response.data;
}
