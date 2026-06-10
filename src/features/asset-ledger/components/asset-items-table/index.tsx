'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { assetItemsQueryOptions } from '../../api/queries';
import type { AssetItem } from '../../api/types';
import { createAssetItemColumns } from './columns';

const SORTABLE_COLUMN_IDS = [
  'asset_number',
  'asset_name',
  'status',
  'category',
  'created_at',
  'updated_at',
  'purchase_date',
  'purchase_amount'
] as const;

interface AssetItemsTableProps {
  currentUserId?: string;
  isAdmin: boolean;
  onEdit: (item: AssetItem) => void;
  onCreate: () => void;
}

export function AssetItemsTable({ currentUserId, isAdmin, onEdit, onCreate }: AssetItemsTableProps) {
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    search: parseAsString,
    status: parseAsString,
    category: parseAsString,
    sort: getSortingStateParser([...SORTABLE_COLUMN_IDS]).withDefault([])
  });

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.search && { search: params.search }),
    ...(params.status && { status: params.status as '사용중' | '미사용' | '분실' | 'all' }),
    ...(params.category && { category: params.category }),
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) })
  };

  const { data } = useSuspenseQuery(assetItemsQueryOptions(filters));

  const columns = useMemo(
    () =>
      createAssetItemColumns({
        currentUserId,
        isAdmin,
        onEdit,
        categoryOptions: data.categoryOptions
      }),
    [currentUserId, isAdmin, onEdit, data.categoryOptions]
  );

  const hasRows = data.items.length > 0;
  const pageCount = Math.max(1, Math.ceil(data.total / params.perPage));

  const { table } = useDataTable({
    data: data.items,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  });

  return (
    <>
      <DataTable table={table}>
        <DataTableToolbar table={table}>
          <Button size='sm' onClick={onCreate}>
            <Icons.add className='mr-2 h-4 w-4' />
            비품 등록
          </Button>
        </DataTableToolbar>
      </DataTable>
      {!hasRows ? (
        <div className='border-border bg-card/50 -mt-2 rounded-lg border border-dashed p-6 text-center'>
          <p className='text-sm font-medium'>등록된 비품이 없습니다.</p>
          <p className='text-muted-foreground mt-1 text-sm'>
            우측 상단의 비품 등록 버튼으로 첫 항목을 추가해 주세요.
          </p>
        </div>
      ) : null}
    </>
  );
}
