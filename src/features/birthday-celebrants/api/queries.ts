import { queryOptions } from '@tanstack/react-query';
import { fetchBirthdayCelebrants } from './service';

export const birthdayCelebrantsKeys = {
  all: ['birthday-celebrants'] as const,
  list: () => [...birthdayCelebrantsKeys.all, 'list'] as const
};

export const birthdayCelebrantsQueryOptions = () =>
  queryOptions({
    queryKey: birthdayCelebrantsKeys.list(),
    queryFn: () => fetchBirthdayCelebrants()
  });
