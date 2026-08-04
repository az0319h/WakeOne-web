import { queryOptions } from '@tanstack/react-query';
import { fetchBirthdayCelebrantsUpcoming } from './service';

export const birthdayCelebrantsKeys = {
  all: ['birthday-celebrants'] as const,
  upcoming: () => [...birthdayCelebrantsKeys.all, 'upcoming'] as const
};

export const birthdayCelebrantsUpcomingQueryOptions = () =>
  queryOptions({
    queryKey: birthdayCelebrantsKeys.upcoming(),
    queryFn: () => fetchBirthdayCelebrantsUpcoming()
  });
