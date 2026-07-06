'use client';

import { useCallback, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { DateRange } from 'react-day-picker';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Icons } from '@/components/icons';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { formatDate } from '@/lib/format';
import { contractsQueryOptions } from '../../api/queries';
import type { ContractDocument, ContractFilters } from '../../api/types';
import { createContractColumns, getContractExternalDocumentUrl } from './columns';

const SORTABLE_COLUMN_IDS = [
  'document_created_at',
  'document_number',
  'author_name',
  'contract_target',
  'amount',
  'updated_at'
] as const;

interface ContractsTableProps {
  onView: (contract: ContractDocument) => void;
  onEdit: (contract: ContractDocument) => void;
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

function ContractDateRangeFilter() {
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
    ? `${selected.from ? formatDate(selected.from) : '시작일'} - ${
        selected.to ? formatDate(selected.to) : '종료일'
      }`
    : '문서 생성일';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='border-dashed'>
          {hasValue ? <Icons.xCircle className='h-4 w-4' /> : <Icons.calendar className='h-4 w-4' />}
          <span>날짜 범위</span>
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

export function ContractsTable({ onView, onEdit }: ContractsTableProps) {
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

  const { data } = useSuspenseQuery(contractsQueryOptions(filters));
  const columns = useMemo(() => createContractColumns({ onView, onEdit }), [onView, onEdit]);
  const pageCount = Math.max(1, Math.ceil(data.total / params.perPage));

  const { table } = useDataTable({
    data: data.items,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] },
      sorting: [{ id: 'document_created_at', desc: true }]
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
    <>
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <ContractDateRangeFilter />
      </div>
      <DataTable
        table={table}
        onRowClick={handleRowClick}
        isRowClickable={isRowClickable}
      >
        <DataTableToolbar table={table} />
      </DataTable>
      {data.items.length === 0 ? (
        <div className='border-border bg-card/50 -mt-2 rounded-lg border border-dashed p-6 text-center'>
          <p className='text-sm font-medium'>조회된 계약 문서가 없습니다.</p>
          <p className='text-muted-foreground mt-1 text-sm'>
            OpenClaw/Gmail 수집 또는 필터 조건을 확인해 주세요.
          </p>
        </div>
      ) : null}
    </>
  );
}
