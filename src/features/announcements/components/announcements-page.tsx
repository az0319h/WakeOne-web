'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
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

function AnnouncementsPageContent() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';

  const [params, setParams] = useQueryStates({
    announcement: parseAsString
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editAnnouncementId, setEditAnnouncementId] = useState<number | null>(null);

  const deepLinkId = params.announcement ? Number(params.announcement) : null;
  const validDeepLinkId =
    deepLinkId !== null && Number.isFinite(deepLinkId) && deepLinkId > 0
      ? deepLinkId
      : null;

  useEffect(() => {
    if (validDeepLinkId !== null) {
      setSelectedId(validDeepLinkId);
      setDetailOpen(true);
    }
  }, [validDeepLinkId]);

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
    <div data-testid='announcements-page' className='flex flex-1 flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <AnnouncementsListFilters />
        {isAdmin ? (
          <Button
            onClick={handleCreateClick}
            data-testid='announcement-create-button'
            className='shrink-0 self-end sm:self-auto'
          >
            <Icons.add className='mr-2 h-4 w-4' />
            공지 작성
          </Button>
        ) : null}
      </div>

      <AnnouncementInfiniteList
        onRowClick={handleRowClick}
        isAdmin={isAdmin}
        onEdit={handleEditClick}
        onDeleted={clearAnnouncementParam}
      />

      <AnnouncementDetailDialog
        announcementId={selectedId}
        open={detailOpen}
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
    </div>
  );
}

export function AnnouncementsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
      <AnnouncementsPageContent />
    </Suspense>
  );
}
