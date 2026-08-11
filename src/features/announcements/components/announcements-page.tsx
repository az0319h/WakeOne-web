'use client';

import { Suspense, useCallback, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useNavAccess } from '@/contexts/nav-access';
import { Icons } from '@/components/icons';
import type { AnnouncementListItem } from '../api/types';
import { AnnouncementDetailDialog } from './announcement-detail-dialog';
import { AnnouncementFormDialog } from './announcement-form-dialog';
import { AnnouncementInfiniteList } from './announcement-infinite-list';
import { AnnouncementsListFilters } from './announcements-list-filters';

function parseAnnouncementId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface AnnouncementsListSectionProps {
  isAdmin: boolean;
  onRowClick: (announcement: AnnouncementListItem) => void;
  onEdit: (announcementId: number) => void;
  onCreateClick: () => void;
  onDeleted: () => void;
}

function AnnouncementsListSection({
  isAdmin,
  onRowClick,
  onEdit,
  onCreateClick,
  onDeleted
}: AnnouncementsListSectionProps) {
  return (
    <div data-testid='announcements-page' className='flex flex-1 flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <AnnouncementsListFilters />
        {isAdmin ? (
          <Button
            onClick={onCreateClick}
            data-testid='announcement-create-button'
            className='shrink-0 self-end sm:self-auto'
          >
            <Icons.add className='mr-2 h-4 w-4' />
            공지 작성
          </Button>
        ) : null}
      </div>

      <AnnouncementInfiniteList
        onRowClick={onRowClick}
        isAdmin={isAdmin}
        onEdit={onEdit}
        onDeleted={onDeleted}
      />
    </div>
  );
}

function AnnouncementsPageShell() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';

  const [params, setParams] = useQueryStates({
    announcement: parseAsString
  });

  const validDeepLinkId = parseAnnouncementId(params.announcement);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editAnnouncementId, setEditAnnouncementId] = useState<number | null>(null);

  const activeAnnouncementId = validDeepLinkId ?? selectedId;
  const isDetailOpen = detailOpen || validDeepLinkId !== null;

  const clearAnnouncementParam = useCallback(() => {
    void setParams({ announcement: null });
  }, [setParams]);

  function handleDetailOpenChange(open: boolean) {
    setDetailOpen(open);
    if (!open) {
      setSelectedId(null);
      clearAnnouncementParam();
    }
  }

  function handleRowClick(announcement: AnnouncementListItem) {
    setSelectedId(announcement.id);
    setDetailOpen(true);
    void setParams({ announcement: String(announcement.id) });
  }

  function handleCreateClick() {
    setFormMode('create');
    setEditAnnouncementId(null);
    setFormOpen(true);
  }

  function handleEditClick(announcementId: number) {
    setFormMode('edit');
    setEditAnnouncementId(announcementId);
    setDetailOpen(false);
    setFormOpen(true);
  }

  function handleFormOpenChange(open: boolean) {
    setFormOpen(open);
    if (!open) {
      setEditAnnouncementId(null);
      if (formMode === 'create') {
        setFormMode('create');
      }
    }
  }

  return (
    <>
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <AnnouncementsListSection
          isAdmin={isAdmin}
          onRowClick={handleRowClick}
          onEdit={handleEditClick}
          onCreateClick={handleCreateClick}
          onDeleted={clearAnnouncementParam}
        />
      </Suspense>

      <AnnouncementDetailDialog
        announcementId={activeAnnouncementId}
        open={isDetailOpen}
        onOpenChange={handleDetailOpenChange}
        isAdmin={isAdmin}
      />

      {isAdmin ? (
        <AnnouncementFormDialog
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          mode={formMode}
          editAnnouncementId={editAnnouncementId}
        />
      ) : null}
    </>
  );
}

export function AnnouncementsPage() {
  return <AnnouncementsPageShell />;
}
