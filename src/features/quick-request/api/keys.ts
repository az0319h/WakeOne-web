export const quickRequestKeys = {
  all: ['quick-request'] as const,
  notes: () => [...quickRequestKeys.all, 'notes'] as const,
  recentAddresses: () => [...quickRequestKeys.all, 'recent-addresses'] as const
};
