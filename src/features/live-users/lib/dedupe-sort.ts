import type { LiveUserPresence } from '../api/types';

export function dedupeByUserId(users: LiveUserPresence[]): LiveUserPresence[] {
  const byUserId = new Map<string, LiveUserPresence>();

  for (const user of users) {
    if (user.user_id) {
      byUserId.set(user.user_id, user);
    }
  }

  return Array.from(byUserId.values());
}

export function sortByFullNameKo(users: LiveUserPresence[]): LiveUserPresence[] {
  return users.toSorted((a, b) =>
    (a.full_name || '').localeCompare(b.full_name || '', 'ko')
  );
}

export function dedupeAndSortUsers(users: LiveUserPresence[]): LiveUserPresence[] {
  return sortByFullNameKo(dedupeByUserId(users));
}

export function filterVisibleLiveUsers(users: LiveUserPresence[]): LiveUserPresence[] {
  return users.filter((user) => user.system_role !== 'admin');
}

export function dedupeSortAndFilterVisible(users: LiveUserPresence[]): LiveUserPresence[] {
  return filterVisibleLiveUsers(dedupeAndSortUsers(users));
}
