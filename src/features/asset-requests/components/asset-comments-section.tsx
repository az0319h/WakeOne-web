'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { LedgerToneBadge } from '@/features/asset-ledger/components/asset-status-badge';
import {
  AssetLedgerErrorAlert,
  AssetLedgerQueryBoundary
} from '@/features/asset-ledger/components/asset-ledger-query-boundary';
import { nameInitials, type LedgerTone } from '@/features/asset-ledger/lib/ui-labels';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { deleteAssetRequestCommentMutation } from '../api/mutations';
import { assetRequestCommentsQueryOptions } from '../api/queries';
import {
  ASSET_COMMENT_ROLE_LABELS,
  type AssetCommentAuthorRole,
  type AssetRequestComment
} from '../api/types';
import { AssetCommentForm } from './asset-comment-form';
import { AssetCommentRealtime } from './asset-comment-realtime';

/** 들여쓰기 제한 — 휴대폰 3단 · md↑ 6단 (designer §2-6) */
const MAX_DEPTH_MOBILE = 3;
const MAX_DEPTH_DESKTOP = 6;

const ROLE_TONES: Record<AssetCommentAuthorRole, LedgerTone | null> = {
  requester: null,
  assignee: 'blue',
  manager: 'violet'
};

function RoleBadge({ role }: { role: AssetCommentAuthorRole }) {
  const tone = ROLE_TONES[role];
  const label = ASSET_COMMENT_ROLE_LABELS[role];
  if (!tone) {
    return (
      <span
        data-testid='asset-comment-role'
        data-role={role}
        className='inline-flex items-center rounded-full border px-2 py-0.5 text-xs'
      >
        {label}
      </span>
    );
  }
  return (
    <LedgerToneBadge tone={tone} data-testid='asset-comment-role'>
      {label}
    </LedgerToneBadge>
  );
}

type AssetCommentItemProps = {
  comment: AssetRequestComment;
  requestId: number;
  viewerId: string | null;
  isManager: boolean;
  canComment: boolean;
  replyingToId: number | null;
  editingId: number | null;
  onReplyChange: (id: number | null) => void;
  onEditChange: (id: number | null) => void;
};

function AssetCommentItem({
  comment,
  requestId,
  viewerId,
  isManager,
  canComment,
  replyingToId,
  editingId,
  onReplyChange,
  onEditChange
}: AssetCommentItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwn = viewerId !== null && viewerId === comment.author_user_id;
  const canEdit = isOwn && !comment.is_deleted;
  const canDelete = (isOwn || isManager) && !comment.is_deleted;
  const canReply = canComment && !comment.is_deleted;
  const isReplying = replyingToId === comment.id;
  const isEditing = editingId === comment.id;

  const deleteMutation = useMutation({
    ...deleteAssetRequestCommentMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '댓글을 삭제했어요.');
      setDeleteOpen(false);
    },
    onError: (error) =>
      notifyError(error instanceof Error ? error.message : '댓글을 삭제하지 못했어요.')
  });

  const indentStyle = {
    '--indent-mobile': `${Math.min(comment.depth, MAX_DEPTH_MOBILE)}rem`,
    '--indent-desktop': `${Math.min(comment.depth, MAX_DEPTH_DESKTOP) * 1.25}rem`
  } as React.CSSProperties;

  return (
    <li
      data-testid={`asset-comment-${comment.id}`}
      data-depth={comment.depth}
      style={indentStyle}
      className='relative pl-[var(--indent-mobile)] md:pl-[var(--indent-desktop)]'
    >
      {comment.depth > 0 ? (
        <span
          aria-hidden
          className='absolute inset-y-0 left-[calc(var(--indent-mobile)-0.5rem)] w-px bg-border md:left-[calc(var(--indent-desktop)-0.625rem)]'
        />
      ) : null}
      <article className='flex min-w-0 gap-3'>
        <Avatar className='size-7 shrink-0'>
          <AvatarFallback className='text-[10px]'>{nameInitials(comment.author_name)}</AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1 space-y-1'>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <span className='text-sm font-medium' translate='no'>
              {comment.author_name}
            </span>
            <RoleBadge role={comment.author_role} />
            <span className='font-mono text-xs whitespace-nowrap text-muted-foreground'>
              {formatAbsoluteDateTimeKo(comment.created_at)}
            </span>
            {comment.edited_at && !comment.is_deleted ? (
              <span className='font-mono text-xs whitespace-nowrap text-muted-foreground'>
                수정됨 {formatAbsoluteDateTimeKo(comment.edited_at)}
              </span>
            ) : null}
          </div>

          {isEditing ? (
            <AssetCommentForm
              key={`edit-${comment.id}-${comment.updated_at}`}
              mode='edit'
              requestId={requestId}
              commentId={comment.id}
              defaultBody={comment.body}
              onCancel={() => onEditChange(null)}
              onSuccess={() => onEditChange(null)}
            />
          ) : (
            <p
              className={cn(
                'text-sm break-words whitespace-pre-wrap',
                comment.is_deleted && 'text-muted-foreground italic'
              )}
            >
              {comment.is_deleted ? '삭제된 댓글입니다.' : comment.body}
            </p>
          )}

          {!comment.is_deleted && !isEditing ? (
            <div className='-ml-2 flex flex-wrap items-center gap-1'>
              {canReply ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 px-2 text-xs'
                  data-testid={`asset-comment-reply-${comment.id}`}
                  onClick={() => {
                    onEditChange(null);
                    onReplyChange(isReplying ? null : comment.id);
                  }}
                >
                  <Icons.chat aria-hidden className='size-3.5' />
                  답글
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 px-2 text-xs'
                  data-testid={`asset-comment-edit-${comment.id}`}
                  onClick={() => {
                    onReplyChange(null);
                    onEditChange(comment.id);
                  }}
                >
                  <Icons.edit aria-hidden className='size-3.5' />
                  수정
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 px-2 text-xs text-destructive hover:text-destructive'
                  data-testid={`asset-comment-delete-${comment.id}`}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Icons.trash aria-hidden className='size-3.5' />
                  삭제
                </Button>
              ) : null}
            </div>
          ) : null}

          {isReplying ? (
            <div className='rounded-lg border p-3'>
              <AssetCommentForm
                mode='reply'
                requestId={requestId}
                parentId={comment.id}
                onCancel={() => onReplyChange(null)}
                onSuccess={() => onReplyChange(null)}
              />
            </div>
          ) : null}
        </div>
      </article>

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate({ requestId, commentId: comment.id })}
        loading={deleteMutation.isPending}
        title='댓글을 삭제할까요?'
        description='댓글 내용은 숨겨지고 답글은 남아요.'
        confirmLabel='삭제'
        cancelLabel='취소'
      />
    </li>
  );
}

type AssetCommentThreadProps = {
  requestId: number;
  viewerId: string | null;
  isManager: boolean;
  canComment: boolean;
};

function AssetCommentThread({ requestId, viewerId, isManager, canComment }: AssetCommentThreadProps) {
  const { data: comments } = useSuspenseQuery(assetRequestCommentsQueryOptions(requestId));
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const liveCount = comments.filter((comment) => !comment.is_deleted).length;

  return (
    <>
      <h3 className='flex items-center gap-2 text-sm font-semibold'>
        댓글
        <span className='font-normal text-muted-foreground tabular-nums'>{liveCount}</span>
      </h3>
      {comments.length === 0 ? (
        <p data-testid='asset-comments-empty' className='text-sm text-muted-foreground'>
          아직 댓글이 없어요.
        </p>
      ) : (
        <ul className='space-y-4'>
          {comments.map((comment) => (
            <AssetCommentItem
              key={comment.id}
              comment={comment}
              requestId={requestId}
              viewerId={viewerId}
              isManager={isManager}
              canComment={canComment}
              replyingToId={replyingToId}
              editingId={editingId}
              onReplyChange={setReplyingToId}
              onEditChange={setEditingId}
            />
          ))}
        </ul>
      )}
    </>
  );
}

type AssetCommentsSectionProps = {
  requestId: number;
  viewerId: string | null;
  isManager: boolean;
  canComment: boolean;
  /** Dialog가 열려 있고 요청 화면일 때만 Realtime 구독 */
  realtimeEnabled: boolean;
};

/** 댓글 스레드 (`asset-comments-section` · plan 43 모양 복제) — 입력창은 Dialog 하단 고정(`AssetCommentForm mode='create'`) */
export function AssetCommentsSection({
  requestId,
  viewerId,
  isManager,
  canComment,
  realtimeEnabled
}: AssetCommentsSectionProps) {
  return (
    <section data-testid='asset-comments-section' aria-label='댓글' className='space-y-4 border-t pt-5'>
      <AssetCommentRealtime requestId={requestId} enabled={realtimeEnabled} />
      <AssetLedgerQueryBoundary
        errorMessage='댓글을 불러오지 못했어요.'
        loadingFallback={<PageLoadingSpinner variant='compact' />}
        renderError={(_error, retry) => (
          <AssetLedgerErrorAlert message='댓글을 불러오지 못했어요.' onRetry={retry} />
        )}
      >
        <AssetCommentThread
          requestId={requestId}
          viewerId={viewerId}
          isManager={isManager}
          canComment={canComment}
        />
      </AssetLedgerQueryBoundary>
    </section>
  );
}
