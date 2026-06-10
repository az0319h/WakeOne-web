'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import type { AssetItem } from '../../api/types';
import { ASSET_STATUS_OPTIONS, buildCategoryFilterOptions } from './options';
import { AssetItemCellAction } from './cell-action';

interface CreateAssetItemColumnsOptions {
  currentUserId?: string;
  isAdmin: boolean;
  onEdit: (item: AssetItem) => void;
  categoryOptions: string[];
}

function formatDepartment(value: string | null): string {
  if (!value || value.trim() === '') {
    return '미지정';
  }

  return value;
}

function formatDisplayName(name: string | null, email: string | null): string {
  if (name) {
    return email ? `${name} (${email})` : name;
  }
  return email ?? '미지정';
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ko-KR');
}

function formatAmount(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('ko-KR').format(value);
}

export function createAssetItemColumns({
  currentUserId,
  isAdmin,
  onEdit,
  categoryOptions
}: CreateAssetItemColumnsOptions): ColumnDef<AssetItem>[] {
  return [
    {
      id: 'asset_number',
      accessorKey: 'asset_number',
      header: ({ column }: { column: Column<AssetItem, unknown> }) => (
        <DataTableColumnHeader column={column} title='자산번호' />
      ),
      cell: ({ row }) => <span className='font-medium'>{row.original.asset_number}</span>,
      meta: {
        label: '검색',
        placeholder: '자산번호 또는 자산명 검색',
        variant: 'text',
        icon: Icons.text,
        queryKey: 'search'
      },
      enableColumnFilter: true
    },
    {
      id: 'asset_name',
      accessorKey: 'asset_name',
      header: ({ column }: { column: Column<AssetItem, unknown> }) => (
        <DataTableColumnHeader column={column} title='자산명' />
      ),
      cell: ({ row }) => <span>{row.original.asset_name}</span>,
      meta: {
        label: '자산명',
        placeholder: '자산명 검색',
        variant: 'text',
        icon: Icons.text
      }
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }: { column: Column<AssetItem, unknown> }) => (
        <DataTableColumnHeader column={column} title='상태' />
      ),
      cell: ({ row }) => <Badge variant='outline'>{row.original.status}</Badge>,
      meta: {
        label: '상태',
        variant: 'select',
        options: ASSET_STATUS_OPTIONS
      },
      enableColumnFilter: true
    },
    {
      accessorKey: 'model_number',
      header: '품명(모델번호)',
      cell: ({ row }) => row.original.model_number ?? '-'
    },
    {
      id: 'actual_user',
      accessorFn: (row) => row.actual_user_name ?? row.actual_user_email ?? '',
      header: '실사용자',
      cell: ({ row }) => formatDisplayName(row.original.actual_user_name, row.original.actual_user_email)
    },
    {
      id: 'category',
      accessorKey: 'category',
      header: ({ column }: { column: Column<AssetItem, unknown> }) => (
        <DataTableColumnHeader column={column} title='카테고리' />
      ),
      cell: ({ row }) => row.original.category ?? '미지정',
      meta: {
        label: '카테고리',
        variant: 'select',
        options: buildCategoryFilterOptions(categoryOptions)
      },
      enableColumnFilter: true
    },
    {
      accessorKey: 'usage_location',
      header: '부서',
      cell: ({ row }) => formatDepartment(row.original.usage_location)
    },
    {
      accessorKey: 'accounting_ledger',
      header: '회계장부',
      cell: ({ row }) => row.original.accounting_ledger ?? '-'
    },
    {
      accessorKey: 'ledger_code',
      header: '장부코드',
      cell: ({ row }) => row.original.ledger_code ?? '-'
    },
    {
      accessorKey: 'purchase_amount',
      header: '구입금액(+vat)',
      cell: ({ row }) => formatAmount(row.original.purchase_amount)
    },
    {
      accessorKey: 'purchase_date',
      header: '구입날짜',
      cell: ({ row }) => formatDate(row.original.purchase_date)
    },
    {
      accessorKey: 'purchase_vendor',
      header: '구입처',
      cell: ({ row }) => row.original.purchase_vendor ?? '-'
    },
    {
      accessorKey: 'notes',
      header: '비고',
      cell: ({ row }) => row.original.notes ?? '-'
    },
    {
      id: 'created_by',
      accessorFn: (row) => row.created_by_name ?? row.created_by_email ?? '',
      header: '생성자',
      cell: ({ row }) => formatDisplayName(row.original.created_by_name, row.original.created_by_email)
    },
    {
      id: 'updated_by',
      accessorFn: (row) => row.updated_by_name ?? row.updated_by_email ?? '',
      header: '최종 수정자',
      cell: ({ row }) => formatDisplayName(row.original.updated_by_name, row.original.updated_by_email)
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <AssetItemCellAction
          data={row.original}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onEdit={onEdit}
        />
      )
    }
  ];
}
