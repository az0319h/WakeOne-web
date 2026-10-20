export const TASKLIST_ORDER_STORAGE_KEY = 'wakeone-kanban-tasklist-order';

export function loadTasklistOrderFromStorage(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(TASKLIST_ORDER_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function saveTasklistOrderToStorage(order: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(TASKLIST_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Storage can throw in private mode.
  }
}

/** Keeps saved ids that still exist in the API; appends new API lists at the end. */
export function mergeTasklistOrder(saved: string[], apiIds: string[]): string[] {
  const merged: string[] = [];
  const apiSet = new Set(apiIds);

  for (const id of saved) {
    if (apiSet.has(id)) {
      merged.push(id);
    }
  }

  const mergedSet = new Set(merged);
  for (const id of apiIds) {
    if (!mergedSet.has(id)) {
      merged.push(id);
    }
  }

  return merged;
}
