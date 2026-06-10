import type { Option } from '@/types/data-table';
import { ASSET_ITEM_STATUSES } from '../../api/types';

export const CATEGORY_FILTER_NONE_VALUE = '__none__' as const;

export const ASSET_STATUS_OPTIONS: Option[] = ASSET_ITEM_STATUSES.map((status) => ({
  label: status,
  value: status
}));

export function buildCategoryFilterOptions(categories: string[]): Option[] {
  return [
    { label: '카테고리 없음', value: CATEGORY_FILTER_NONE_VALUE },
    ...categories.map((category) => ({
      label: category,
      value: category
    }))
  ];
}
