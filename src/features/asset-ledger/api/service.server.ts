import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type {
  AssetItem,
  AssetItemCreatePayload,
  AssetItemsFilters,
  AssetItemSortField,
  AssetItemStatus,
  AssetItemUpdatePayload
} from './types';
import { USAGE_LOCATION_OPTIONS } from '@/features/asset-ledger/constants/usage-locations';
import { ASSET_CATEGORY_NONE_SENTINEL } from './types';

type ProfileLite = {
  email: string | null;
  full_name: string | null;
};

type AssetItemRow = {
  id: number;
  asset_number: string;
  asset_name: string;
  status: AssetItemStatus;
  model_number: string | null;
  actual_user_id: string | null;
  usage_location: string | null;
  category: string | null;
  accounting_ledger: string | null;
  ledger_code: string | null;
  purchase_amount: number | null;
  purchase_date: string | null;
  purchase_vendor: string | null;
  notes: string | null;
  created_by_id: string;
  updated_by_id: string;
  created_at: string;
  updated_at: string;
};

const ASSET_NAME_PREFIX_REGEX = /\(([^)]+)\)/;
const ASSET_NUMBER_SERIAL_REGEX = /^([A-Z0-9]{1,10})-(\d{3})$/;

function toNormalizedAssetPrefix(assetName: string): string | null {
  const matched = assetName.match(ASSET_NAME_PREFIX_REGEX)?.[1]?.trim().toUpperCase() ?? null;
  if (!matched) {
    return null;
  }

  if (!/^[A-Z0-9]{1,10}$/.test(matched)) {
    return null;
  }

  return matched;
}

function toDisplayName(fullName: string | null): string | null {
  const trimmed = fullName?.trim() ?? '';
  return trimmed || null;
}

function mapAssetItem(row: AssetItemRow, profilesByUserId: Map<string, ProfileLite>): AssetItem {
  const actualUser = row.actual_user_id ? profilesByUserId.get(row.actual_user_id) ?? null : null;
  const createdBy = profilesByUserId.get(row.created_by_id) ?? null;
  const updatedBy = profilesByUserId.get(row.updated_by_id) ?? null;

  return {
    id: row.id,
    asset_number: row.asset_number,
    asset_name: row.asset_name,
    status: row.status,
    model_number: row.model_number,
    actual_user_id: row.actual_user_id,
    actual_user_name: toDisplayName(actualUser?.full_name ?? null),
    actual_user_email: actualUser?.email ?? null,
    usage_location: row.usage_location,
    category: row.category,
    accounting_ledger: row.accounting_ledger,
    ledger_code: row.ledger_code,
    purchase_amount: row.purchase_amount,
    purchase_date: row.purchase_date,
    purchase_vendor: row.purchase_vendor,
    notes: row.notes,
    created_by_id: row.created_by_id,
    created_by_name: toDisplayName(createdBy?.full_name ?? null),
    created_by_email: createdBy?.email ?? null,
    updated_by_id: row.updated_by_id,
    updated_by_name: toDisplayName(updatedBy?.full_name ?? null),
    updated_by_email: updatedBy?.email ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function parseSort(sortRaw: string | undefined): { column: AssetItemSortField; ascending: boolean } {
  const fallback = { column: 'created_at' as AssetItemSortField, ascending: false };
  if (!sortRaw) {
    return fallback;
  }

  try {
    const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
    const first = sortItems[0];
    if (!first) {
      return fallback;
    }

    const allowedColumns: AssetItemSortField[] = [
      'created_at',
      'updated_at',
      'asset_number',
      'asset_name',
      'status',
      'purchase_date',
      'purchase_amount'
    ];

    if (!allowedColumns.includes(first.id as AssetItemSortField)) {
      return fallback;
    }

    return { column: first.id as AssetItemSortField, ascending: !first.desc };
  } catch {
    return fallback;
  }
}

function buildAssetItemsSelect() {
  return `
    id,
    asset_number,
    asset_name,
    status,
    model_number,
    actual_user_id,
    usage_location,
    category,
    accounting_ledger,
    ledger_code,
    purchase_amount,
    purchase_date,
    purchase_vendor,
    notes,
    created_by_id,
    updated_by_id,
    created_at,
    updated_at
  `;
}

function sortKorean(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, 'ko-KR'));
}

function collectDistinctTrimmed(values: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return sortKorean(Array.from(unique));
}

export async function listAssetLedgerUsageLocations(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('asset_items').select('usage_location');

  if (error) {
    throw new Error(error.message);
  }

  const fromAssets = collectDistinctTrimmed(
    (data ?? []).map((row) => row.usage_location as string | null)
  );
  const merged = new Set<string>([...USAGE_LOCATION_OPTIONS, ...fromAssets]);
  return sortKorean(Array.from(merged));
}

/** @deprecated Use listAssetLedgerUsageLocations */
export async function listAssetLedgerDepartments(): Promise<string[]> {
  return listAssetLedgerUsageLocations();
}

export async function listAssetCategoryOptions(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('asset_items').select('category');

  if (error) {
    throw new Error(error.message);
  }

  return collectDistinctTrimmed((data ?? []).map((row) => row.category as string | null));
}

export function validateUsageLocation(
  usageLocation: string | null | undefined,
  locations: string[]
): string | null {
  if (usageLocation == null || usageLocation === '') {
    return null;
  }

  const trimmed = usageLocation.trim();
  if (!locations.includes(trimmed)) {
    throw new Error('허용되지 않는 사용처입니다. 사용처 목록에서 선택해 주세요.');
  }

  return trimmed;
}

async function listProfilesByUserIds(userIds: string[]): Promise<Map<string, ProfileLite>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return new Map<string, ProfileLite>();
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name')
    .in('user_id', uniqueUserIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map<string, ProfileLite>(
    (data ?? []).map((profile) => [
      profile.user_id as string,
      {
        email: (profile.email as string | null) ?? null,
        full_name: (profile.full_name as string | null) ?? null
      }
    ])
  );
}

export async function listAssetItems(
  filters: AssetItemsFilters
): Promise<{ items: AssetItem[]; total: number; page: number; limit: number; categoryOptions: string[] }> {
  const supabase = await createClient();
  const page = Number(filters.page ?? 1);
  const limit = Number(filters.limit ?? 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const search = filters.search?.trim();
  const status = filters.status;
  const category = filters.category?.trim();
  const sort = parseSort(filters.sort);

  let query = supabase
    .from('asset_items')
    .select(buildAssetItemsSelect(), { count: 'exact' });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (category) {
    if (category === ASSET_CATEGORY_NONE_SENTINEL) {
      query = query.or('category.is.null,category.eq.');
    } else {
      query = query.eq('category', category);
    }
  }

  if (search) {
    const escaped = search.replaceAll(',', ' ');
    query = query.or(`asset_number.ilike.%${escaped}%,asset_name.ilike.%${escaped}%`);
  }

  const [{ data, error, count }, categoryOptions] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to),
    listAssetCategoryOptions()
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const rawRows = (data ?? []) as unknown as AssetItemRow[];
  const profilesByUserId = await listProfilesByUserIds(
    rawRows.flatMap((row) => [row.actual_user_id, row.created_by_id, row.updated_by_id]).filter(Boolean) as string[]
  );
  const rows = rawRows.map((row) => mapAssetItem(row, profilesByUserId));

  return {
    items: rows,
    total: count ?? 0,
    page,
    limit,
    categoryOptions
  };
}

export async function getAssetItemById(id: number): Promise<AssetItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('asset_items')
    .select(buildAssetItemsSelect())
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as AssetItemRow;
  const profilesByUserId = await listProfilesByUserIds(
    [row.actual_user_id, row.created_by_id, row.updated_by_id].filter(Boolean) as string[]
  );

  return mapAssetItem(row, profilesByUserId);
}

export async function createAssetItem(
  payload: AssetItemCreatePayload,
  actorUserId: string
): Promise<AssetItem> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_items')
    .insert({
      ...payload,
      created_by_id: actorUserId,
      updated_by_id: actorUserId
    })
    .select(buildAssetItemsSelect())
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as unknown as AssetItemRow;
  const profilesByUserId = await listProfilesByUserIds(
    [row.actual_user_id, row.created_by_id, row.updated_by_id].filter(Boolean) as string[]
  );

  return mapAssetItem(row, profilesByUserId);
}

export async function updateAssetItem(
  id: number,
  payload: AssetItemUpdatePayload,
  actorUserId: string
): Promise<AssetItem | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_items')
    .update({
      ...payload,
      updated_by_id: actorUserId
    })
    .eq('id', id)
    .select(buildAssetItemsSelect())
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as AssetItemRow;
  const profilesByUserId = await listProfilesByUserIds(
    [row.actual_user_id, row.created_by_id, row.updated_by_id].filter(Boolean) as string[]
  );

  return mapAssetItem(row, profilesByUserId);
}

export async function getAssetItemDeleteOwnership(
  id: number
): Promise<{ id: number; created_by_id: string; asset_number: string; asset_name: string } | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_items')
    .select('id, created_by_id, asset_number, asset_name')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: number; created_by_id: string; asset_number: string; asset_name: string } | null) ?? null;
}

export async function deleteAssetItem(id: number): Promise<{ id: number; asset_number: string; asset_name: string } | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_items')
    .delete()
    .eq('id', id)
    .select('id, asset_number, asset_name')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: number; asset_number: string; asset_name: string } | null) ?? null;
}

export async function suggestAssetNumber(assetName: string): Promise<{ suggested: string | null; prefix: string | null }> {
  const fallbackPrefix = toNormalizedAssetPrefix(assetName);
  const supabase = await createClient();
  let existingAssetNumbers: Array<{ asset_number: string | null }> = [];
  if (fallbackPrefix) {
    const { data, error } = await supabase
      .from('asset_items')
      .select('asset_number')
      .like('asset_number', `${fallbackPrefix}-%`)
      .limit(5000);

    if (error) {
      throw new Error(error.message);
    }

    existingAssetNumbers = (data ?? []) as Array<{ asset_number: string | null }>;
  }

  let rpcData: { suggested: string | null; prefix: string | null }[] | null = null;
  let rpcError: Error | null = null;
  try {
    const rpcResult = await supabase.rpc('suggest_asset_number', {
      p_asset_name: assetName
    });
    rpcData = (rpcResult.data as { suggested: string | null; prefix: string | null }[] | null) ?? null;
    if (rpcResult.error) {
      rpcError = new Error(rpcResult.error.message);
    }
  } catch (error) {
    rpcError = error instanceof Error ? error : new Error('자산번호 추천 RPC 호출에 실패했습니다.');
  }

  const result = rpcData?.[0] ?? null;
  if (result?.suggested && result.prefix) {
    return {
      suggested: result.suggested,
      prefix: result.prefix
    };
  }

  if (!fallbackPrefix) {
    if (rpcError) {
      throw rpcError;
    }
    return {
      suggested: null,
      prefix: null
    };
  }

  const serialByPrefix = existingAssetNumbers.reduce((maxSerial, row) => {
    const match = String(row.asset_number ?? '').toUpperCase().match(ASSET_NUMBER_SERIAL_REGEX);
    if (!match) {
      return maxSerial;
    }

    const [_, prefix, serialRaw] = match;
    if (prefix !== fallbackPrefix) {
      return maxSerial;
    }

    const serial = Number(serialRaw);
    return Number.isFinite(serial) ? Math.max(maxSerial, serial) : maxSerial;
  }, 0);

  return {
    suggested: `${fallbackPrefix}-${String(serialByPrefix + 1).padStart(3, '0')}`,
    prefix: fallbackPrefix
  };
}

export async function listAssetLedgerUsers(): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
  }>
> {
  const supabase = getServiceRoleClient();
  let query = supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .eq('status', 'active')
    .or('affiliation.eq.wake,system_role.eq.admin')
    .order('full_name', { ascending: true })
    .limit(100);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (
    data?.map((profile) => ({
      id: profile.user_id as string,
      name: (profile.full_name as string)?.trim() || (profile.email as string),
      email: profile.email as string
    })) ?? []
  );
}
