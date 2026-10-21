import { queryOptions } from '@tanstack/react-query';
import { quickRequestKeys } from './keys';
import { fetchQuickRequestNotes, fetchQuickRequestRecentAddresses } from './service';

export { quickRequestKeys };

export function quickRequestNotesQueryOptions() {
  return queryOptions({
    queryKey: quickRequestKeys.notes(),
    queryFn: () => fetchQuickRequestNotes()
  });
}

export function quickRequestRecentAddressesQueryOptions() {
  return queryOptions({
    queryKey: quickRequestKeys.recentAddresses(),
    queryFn: () => fetchQuickRequestRecentAddresses()
  });
}
