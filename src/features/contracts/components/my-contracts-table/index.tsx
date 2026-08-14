'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { DateRange } from 'react-day-picker';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Icons } from '@/components/icons';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { myContractsQueryOptions } from '../../api/queries';
import type { ContractDocument, ContractFilters } from '../../api/types';
import {
  createMyContractColumns,
  getContractExternalDocumentUrl
} from './columns';

const SORTABLE_COLUMN_IDS = [
  'approved_at',
  'document_number',
  'author_name',
  'contract_target',
  'amount',
  'updated_at'
] as const;

interface MyContractsTableProps {
  onView: (contract: ContractDocument) => void;
}

interface MyContractsTableBodyProps {
  columns: ReturnType<typeof createMyContractColumns>;
  filters: ContractFilters;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function MyContractDateRangeFilter() {
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    from: parseAsString,
    to: parseAsString
  });

  const selected = useMemo<DateRange>(
    () => ({
      from: parseDateParam(params.from),
      to: parseDateParam(params.to)
    }),
    [params.from, params.to]
  );

  const hasValue = Boolean(selected.from || selected.to);
  const label = hasValue
    ? `${selected.from ? formatAbsoluteDateKo(selected.from) : '시작일'} - ${
        selected.to ? formatAbsoluteDateKo(selected.to) : '종료일'
      }`
    : '전체';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='border-dashed'>
          {hasValue ? <Icons.xCircle className='h-4 w-4' /> : <Icons.calendar className='h-4 w-4' />}
          <span>문서승인일</span>
          <Separator orientation='vertical' className='mx-0.5 data-[orientation=vertical]:h-4' />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          initialFocus
          mode='range'
          selected={selected}
          onSelect={(range) => {
            void setParams({
              page: 1,
              from: range?.from ? toDateInputValue(range.from) : null,
              to: range?.to ? toDateInputValue(range.to) : null
            });
          }}
        />
        {hasValue ? (
          <div className='border-t p-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='w-full'
              onClick={() => {
                void setParams({ page: 1, from: null, to: null });
              }}
            >
              날짜 필터 초기화
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MyContractsTableBody({ columns, filters }: MyContractsTableBodyProps) {
  const { data } = useSuspenseQuery(myContractsQueryOptions(filters));
  const limit = filters.limit ?? 10;
  const pageCount = Math.max(1, Math.ceil(data.total / limit));

  const { table } = useDataTable({
    data: data.items,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] },
      sorting: [{ id: 'approved_at', desc: true }]
    }
  });

  const handleRowClick = useCallback((contract: ContractDocument) => {
    const externalUrl = getContractExternalDocumentUrl(contract);
    if (!externalUrl) {
      return;
    }

    window.open(externalUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const isRowClickable = useCallback(
    (contract: ContractDocument) => Boolean(getContractExternalDocumentUrl(contract)),
    []
  );

  return (
    <DataTable
      table={table}
      onRowClick={handleRowClick}
      isRowClickable={isRowClickable}
    />
  );
}

export function MyContractsTable({ onView }: MyContractsTableProps) {
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    from: parseAsString,
    to: parseAsString,
    search: parseAsString,
    attachment_status: parseAsString,
    sort: getSortingStateParser([...SORTABLE_COLUMN_IDS]).withDefault([])
  });

  const filters: ContractFilters = {
    page: params.page,
    limit: params.perPage,
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
    ...(params.search && { search: params.search }),
    ...(params.attachment_status && {
      attachment_status: params.attachment_status as ContractFilters['attachment_status']
    }),
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) })
  };

  const querySignature = JSON.stringify(filters);
  const columns = useMemo(() => createMyContractColumns({ onView }), [onView]);

  const { table: shellTable } = useDataTable({
    data: [] as ContractDocument[],
    columns,
    pageCount: 1,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] },
      sorting: [{ id: 'approved_at', desc: true }]
    }
  });

  return (
    <div className='flex min-w-0 flex-1 flex-col'>
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <MyContractDateRangeFilter />
      </div>
      <DataTableToolbar table={shellTable} />
      <Suspense key={querySignature} fallback={<PageLoadingSpinner variant='fill' />}>
        <MyContractsTableBody columns={columns} filters={filters} />
      </Suspense>
    </div>
  );
}
