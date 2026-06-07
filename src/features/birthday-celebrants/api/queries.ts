import { queryOptions } from '@tanstack/react-query';
import { fetchBirthdayCelebrantsThisMonth } from './service';

export const birthdayCelebrantsKeys = {
  all: ['birthday-celebrants'] as const,
  thisMonth: () => [...birthdayCelebrantsKeys.all, 'this-month'] as const
};

export const birthdayCelebrantsThisMonthQueryOptions = () =>
  queryOptions({
    queryKey: birthdayCelebrantsKeys.thisMonth(),
    queryFn: () => fetchBirthdayCelebrantsThisMonth()
  });
