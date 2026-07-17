import {
  createSearchParamsCache,
  createSerializer,
  parseAsInteger,
  parseAsString
} from 'nuqs/server';

export const searchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  name: parseAsString,
  gender: parseAsString,
  category: parseAsString,
  role: parseAsString,
  system_role: parseAsString,
  organization: parseAsString,
  department: parseAsString,
  org_role: parseAsString,
  sort: parseAsString,
  log_user: parseAsString,
  notif_user: parseAsString,
  action: parseAsString,
  search: parseAsString,
  status: parseAsString,
  from: parseAsString,
  to: parseAsString,
  attachment_status: parseAsString
  // advanced filter
  // filters: getFiltersStateParser().withDefault([]),
  // joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and')
};

export const searchParamsCache = createSearchParamsCache(searchParams);
export const serialize = createSerializer(searchParams);
