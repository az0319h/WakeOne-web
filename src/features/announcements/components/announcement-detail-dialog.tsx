'use client';

import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { announcementDetailQueryOptions } from '../api/queries';
import { AnnouncementAttachmentList } from './announcement-attachment-list';
import { AnnouncementPinBadge } from './announcement-pin-badge';
import { AnnouncementPriorityBadge } from './announcement-priority-badge';
import { AnnouncementTimestamps } from './announcement-timestamps';

interface AnnouncementDetailDialogProps {
  announcementId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export function AnnouncementDetailDialog({
  announcementId,
  open,
  onOpenChange,
  isAdmin = false
}: AnnouncementDetailDialogProps) {
  const { data: announcement, isPending, isError, refetch } = useQuery({
    ...announcementDetailQueryOptions(announcementId ?? 0),
    enabled: open && announcementId !== null && announcementId > 0,
    retry: false
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='flex max-h-[85vh] flex-col sm:max-w-2xl'
        data-testid='announcement-detail-dialog'
      >
        {isPending ? (
          <>
            <DialogHeader>
              <DialogTitle>공지 상세</DialogTitle>
            </DialogHeader>
            <PageLoadingSpinner variant='compact' />
          </>
        ) : isError || !announcement ? (
          <>
            <DialogHeader>
              <DialogTitle>공지 상세</DialogTitle>
              <DialogDescription>요청한 공지를 찾을 수 없습니다.</DialogDescription>
            </DialogHeader>
            <div className='text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm'>
              <Icons.page className='size-8 opacity-60' />
              <p data-testid='announcement-deleted-empty'>삭제된 공지입니다</p>
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                닫기
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className='flex flex-wrap items-center gap-2'>
                <DialogTitle className='text-left'>{announcement.title}</DialogTitle>
                {announcement.is_pinned ? <AnnouncementPinBadge /> : null}
                <AnnouncementPriorityBadge priority={announcement.priority} />
              </div>
              <DialogDescription asChild className='text-left'>
                <div>
                  <AnnouncementTimestamps
                    createdAt={announcement.created_at}
                    updatedAt={announcement.updated_at}
                  />
                </div>
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className='min-h-0 flex-1 pr-3'>
              <div className='min-w-0 space-y-4 pb-2 pr-1'>
                <div
                  className='text-sm whitespace-pre-wrap'
                  data-testid='announcement-detail-body'
                >
                  {announcement.body}
                </div>

                <section>
                  <h3 className='mb-2 text-sm font-medium'>첨부파일</h3>
                  <AnnouncementAttachmentList
                    announcementId={announcement.id}
                    attachments={announcement.attachments ?? []}
                    canDelete={isAdmin}
                    onAttachmentsChange={() => void refetch()}
                  />
                </section>
              </div>
              <ScrollBar orientation='vertical' />
            </ScrollArea>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                닫기
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
