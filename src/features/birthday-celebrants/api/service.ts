import { apiClient } from '@/lib/api-client';
import type { BirthdayCelebrantsResponse } from './types';

type BirthdayCelebrantsApiResponse = {
  success: boolean;
  data: BirthdayCelebrantsResponse;
};

export async function fetchBirthdayCelebrantsUpcoming(): Promise<BirthdayCelebrantsResponse> {
  const response = await apiClient<BirthdayCelebrantsApiResponse>('/birthdays/this-month');
  return response.data;
}
