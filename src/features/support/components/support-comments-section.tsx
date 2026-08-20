'use client';

import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Separator } from '@/components/ui/separator';
import type { AuthProfile } from '@/features/auth/api/types';
import { supportCommentsQueryOptions } from '../api/queries';
import type { SupportRequest } from '../api/types';
import { SupportCommentForm } from './support-comment-form';
import { SupportCommentRealtime } from './support-comment-realtime';
import { SupportCommentThread } from './support-comment-thread';

interface SupportCommentsSectionProps {
  request: SupportRequest;
  profile: AuthProfile | null;
  isAdmin: boolean;
  open: boolean;
}

interface SupportCommentsBodyProps {
  request: SupportRequest;
  profile: AuthProfile | null;
  isAdmin: boolean;
  open: boolean;
}

function SupportCommentsBody({
  request,
  profile,
  isAdmin,
  open
}: SupportCommentsBodyProps) {
  const { data: comments } = useSuspenseQuery(supportCommentsQueryOptions(request.id));
  const canComment = isAdmin || profile?.user_id === request.submitted_by;

  return (
    <div className='space-y-4' data-testid='support-comments-section'>
      <SupportCommentRealtime supportRequestId={request.id} enabled={open} />
      <SupportCommentThread
        comments={comments}
        supportRequestId={request.id}
        currentUserId={profile?.user_id ?? null}
        isAdmin={isAdmin}
      />
      {canComment ? (
        <div className='rounded-xl border p-3'>
          <SupportCommentForm mode='create' supportRequestId={request.id} />
        </div>
      ) : null}
    </div>
  );
}

export function SupportCommentsSection({
  request,
  profile,
  isAdmin,
  open
}: SupportCommentsSectionProps) {
  return (
    <section className='space-y-4 border-t pt-4'>
      <div className='space-y-1'>
        <h3 className='text-base font-semibold'>댓글</h3>
        <p className='text-muted-foreground text-sm'>
          문의 작성자와 관리자가 댓글과 답글로 대화할 수 있습니다.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
        <SupportCommentsBody request={request} profile={profile} isAdmin={isAdmin} open={open} />
      </Suspense>
    </section>
  );
}
