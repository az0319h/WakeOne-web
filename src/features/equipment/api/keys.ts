import type { EquipmentFilters, EquipmentPrefix } from './types';

export const equipmentKeys = {
  all: ['equipment'] as const,
  lists: () => [...equipmentKeys.all, 'list'] as const,
  list: (filters: EquipmentFilters) => [...equipmentKeys.lists(), filters] as const,
  details: () => [...equipmentKeys.all, 'detail'] as const,
  detail: (id: number) => [...equipmentKeys.details(), id] as const,
  nextNumber: (prefix: EquipmentPrefix) => [...equipmentKeys.all, 'next-number', prefix] as const
};
