'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { formatAbsoluteDateKoOrPlaceholder } from '@/lib/format-date';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ContractDocument } from '../../api/types';
import { ContractRowAction } from './row-action';
import {
  CONTRACT_ATTACHMENT_STATUS_LABELS,
  CONTRACT_ATTACHMENT_STATUS_OPTIONS
} from './options';

interface CreateContractColumnsOptions {
  onView: (contract: ContractDocument) => void;
  onEdit: (contract: ContractDocument) => void;
}

function formatAmount(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(value);
}

export function getContractExternalDocumentUrl(contract: ContractDocument): string | null {
  if (contract.source_type === 'openclaw_gmail' && contract.source_document_url) {
    return contract.source_document_url;
  }

  return null;
}

function AttachmentStatusBadge({ contract }: { contract: ContractDocument }) {
  const label = CONTRACT_ATTACHMENT_STATUS_LABELS[contract.attachment_status];
  const className =
    contract.attachment_status === 'missing'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
      : contract.attachment_status === 'has_attachment'
        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
        : contract.attachment_status === 'no_attachment_required'
          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300';

  return (
    <Badge variant='outline' className={cn('w-fit', className)}>
      {label}
    </Badge>
  );
}

export function createContractColumns({
  onView,
  onEdit
}: CreateContractColumnsOptions): ColumnDef<ContractDocument>[] {
  return [
    {
      id: 'document_number',
      accessorKey: 'document_number',
      header: ({ column }: { column: Column<ContractDocument, unknown> }) => (
        <DataTableColumnHeader column={column} title='문서번호' />
      ),
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.document_number}</span>
      ),
      meta: {
        label: '검색',
        placeholder: '문서번호, 작성자, 계약대상 검색',
        variant: 'text',
        icon: Icons.search,
        queryKey: 'search'
      },
      enableColumnFilter: true
    },
    {
      id: 'approved_at',
      accessorKey: 'approved_at',
      header: ({ column }: { column: Column<ContractDocument, unknown> }) => (
        <DataTableColumnHeader column={column} title='문서승인일' />
      ),
      cell: ({ row }) => formatAbsoluteDateKoOrPlaceholder(row.original.approved_at)
    },
    {
      id: 'author_name',
      accessorKey: 'author_name',
      header: ({ column }: { column: Column<ContractDocument, unknown> }) => (
        <DataTableColumnHeader column={column} title='작성자' />
      ),
      cell: ({ row }) => (
        <div className='flex min-w-[120px] flex-col'>
          <span>{row.original.author_name}</span>
          {row.original.author_email ? (
            <span className='text-muted-foreground text-xs'>{row.original.author_email}</span>
          ) : null}
        </div>
      )
    },
    {
      id: 'contract_target',
      accessorKey: 'contract_target',
      header: ({ column }: { column: Column<ContractDocument, unknown> }) => (
        <DataTableColumnHeader column={column} title='계약대상' />
      ),
      cell: ({ row }) => <span className='block max-w-[220px] truncate'>{row.original.contract_target}</span>
    },
    {
      id: 'contract_summary',
      accessorKey: 'contract_summary',
      header: '계약 내용',
      cell: ({ row }) => (
        <span className='text-muted-foreground block max-w-[260px] truncate'>
          {row.original.contract_summary}
        </span>
      )
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: ({ column }: { column: Column<ContractDocument, unknown> }) => (
        <DataTableColumnHeader column={column} title='금액' />
      ),
      cell: ({ row }) => formatAmount(row.original.amount)
    },
    {
      id: 'attachment_status',
      accessorKey: 'attachment_status',
      header: '첨부파일 상태',
      cell: ({ row }) => <AttachmentStatusBadge contract={row.original} />,
      meta: {
        label: '첨부 상태',
        variant: 'select',
        options: CONTRACT_ATTACHMENT_STATUS_OPTIONS
      },
      enableColumnFilter: true
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ContractRowAction data={row.original} onView={onView} onEdit={onEdit} />
      )
    }
  ];
}
