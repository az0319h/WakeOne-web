'use client';

import { Suspense, useCallback, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useNavAccess } from '@/contexts/nav-access';
import type { SupportListItem } from '../api/types';
import { SupportDetailDialog } from './support-detail-dialog';
import { SupportFormSheet } from './support-form-sheet';
import { SupportInfiniteList } from './support-infinite-list';
import { SupportListFilters, useSupportListFilterParams } from './support-list-filters';
import { useSupportSheet } from './support-sheet-context';

function parseSupportId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface SupportListBodyProps {
  isAdmin: boolean;
  onRowClick: (request: SupportListItem) => void;
}

function SupportListBody({ isAdmin, onRowClick }: SupportListBodyProps) {
  return <SupportInfiniteList isAdmin={isAdmin} onRowClick={onRowClick} />;
}

function SupportPageShell() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';
  const { filters } = useSupportListFilterParams();
  const querySignature = JSON.stringify(filters);
  const { formOpen, setFormOpen } = useSupportSheet();

  const [params, setParams] = useQueryStates({
    support: parseAsString
  });

  const validDeepLinkId = parseSupportId(params.support);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeRequestId = validDeepLinkId ?? selectedId;
  const isDetailOpen = detailOpen || validDeepLinkId !== null;

  const clearSupportParam = useCallback(() => {
    void setParams({ support: null });
  }, [setParams]);

  function handleDetailOpenChange(open: boolean) {
    setDetailOpen(open);
    if (!open) {
      setSelectedId(null);
      clearSupportParam();
    }
  }

  function handleRowClick(request: SupportListItem) {
    setSelectedId(request.id);
    setDetailOpen(true);
    void setParams({ support: String(request.id) });
  }

  return (
    <>
      <div data-testid='support-page' className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <SupportListFilters />
        </div>

        <Suspense key={querySignature} fallback={<PageLoadingSpinner variant='fill' />}>
          <SupportListBody isAdmin={isAdmin} onRowClick={handleRowClick} />
        </Suspense>
      </div>

      <SupportDetailDialog
        requestId={activeRequestId}
        open={isDetailOpen}
        onOpenChange={handleDetailOpenChange}
        isAdmin={isAdmin}
      />

      {!isAdmin ? <SupportFormSheet open={formOpen} onOpenChange={setFormOpen} /> : null}
    </>
  );
}

export function SupportPage() {
  return <SupportPageShell />;
}
