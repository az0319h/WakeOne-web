export const ASSET_ITEM_STATUSES = ['사용중', '미사용', '분실'] as const;

/** 목록 category 필터: NULL/공백 행만 조회 */
export const ASSET_CATEGORY_NONE_SENTINEL = '__none__' as const;

/** 폼 부서 Select: 미지정(Radix Select는 빈 문자열 value 금지) */
export const ASSET_DEPARTMENT_NONE_SENTINEL = '__none__' as const;

export type AssetItemStatus = (typeof ASSET_ITEM_STATUSES)[number];

export type AssetItemSortField =
  | 'created_at'
  | 'updated_at'
  | 'asset_number'
  | 'asset_name'
  | 'status'
  | 'purchase_date'
  | 'purchase_amount';

export type AssetItemsFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: AssetItemStatus | 'all';
  category?: string;
  sort?: string;
};

export type AssetItem = {
  id: number;
  asset_number: string;
  asset_name: string;
  status: AssetItemStatus;
  model_number: string | null;
  actual_user_id: string | null;
  actual_user_name: string | null;
  actual_user_email: string | null;
  usage_location: string | null;
  category: string | null;
  accounting_ledger: string | null;
  ledger_code: string | null;
  purchase_amount: number | null;
  purchase_date: string | null;
  purchase_vendor: string | null;
  notes: string | null;
  created_by_id: string;
  created_by_name: string | null;
  created_by_email: string | null;
  updated_by_id: string;
  updated_by_name: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetItemsListResponse = {
  success: boolean;
  message: string;
  items: AssetItem[];
  total: number;
  page: number;
  limit: number;
  categoryOptions: string[];
};

export type AssetItemDetailResponse = {
  success: boolean;
  message: string;
  item: AssetItem;
};

export type AssetItemMutationPayload = {
  asset_number: string;
  asset_name: string;
  status: AssetItemStatus;
  model_number?: string | null;
  actual_user_id?: string | null;
  usage_location?: string | null;
  category?: string | null;
  accounting_ledger?: string | null;
  ledger_code?: string | null;
  purchase_amount?: number | null;
  purchase_date?: string | null;
  purchase_vendor?: string | null;
  notes?: string | null;
};

export type AssetItemCreatePayload = AssetItemMutationPayload;

export type AssetItemUpdatePayload = Partial<AssetItemMutationPayload>;

export type AssetSuggestNumberResponse = {
  success: boolean;
  message: string;
  suggested: string | null;
  prefix: string | null;
};
