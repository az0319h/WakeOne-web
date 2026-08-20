'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { deleteSupportCommentMutation } from '../api/mutations';
import type { SupportComment } from '../api/types';
import { SupportCommentForm } from './support-comment-form';

const MAX_VISUAL_DEPTH = 6;

interface SupportCommentItemProps {
  comment: SupportComment;
  supportRequestId: number;
  currentUserId: string | null;
  isAdmin: boolean;
  replyingToId: number | null;
  editingCommentId: number | null;
  onReplyChange: (commentId: number | null) => void;
  onEditChange: (commentId: number | null) => void;
}

function isCommentEdited(comment: SupportComment): boolean {
  return new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime();
}

function getInitials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

export function SupportCommentItem({
  comment,
  supportRequestId,
  currentUserId,
  isAdmin,
  replyingToId,
  editingCommentId,
  onReplyChange,
  onEditChange
}: SupportCommentItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwnComment = currentUserId === comment.author_user_id;
  const canReply = !comment.is_deleted;
  const canEdit = isOwnComment && !comment.is_deleted;
  const canDelete = (isOwnComment || isAdmin) && !comment.is_deleted;
  const isReplying = replyingToId === comment.id;
  const isEditing = editingCommentId === comment.id;

  const visualDepth = Math.min(comment.depth, MAX_VISUAL_DEPTH);
  const isEdited = useMemo(() => isCommentEdited(comment), [comment]);

  const deleteMutation = useMutation({
    ...deleteSupportCommentMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '댓글이 삭제되었습니다.');
      setDeleteOpen(false);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '댓글 삭제에 실패했습니다.');
    }
  });

  function handleDeleteConfirm() {
    deleteMutation.mutate({
      supportRequestId,
      commentId: comment.id
    });
  }

  return (
    <div
      className='relative'
      style={{ '--comment-indent': `${visualDepth * 1.25}rem` } as React.CSSProperties}
      data-testid={`support-comment-${comment.id}`}
    >
      <div
        className={cn(
          'relative pl-[var(--comment-indent)]',
          comment.depth > MAX_VISUAL_DEPTH && 'sm:pl-[var(--comment-indent)]'
        )}
      >
        {comment.depth > 0 ? (
          <span
            aria-hidden='true'
            className='bg-border absolute top-0 bottom-0 left-[calc(var(--comment-indent)-0.625rem)] w-px'
          />
        ) : null}

        <article className='bg-card rounded-xl border p-3 shadow-xs'>
          <div className='flex min-w-0 items-start gap-3'>
            <Avatar className='size-8'>
              <AvatarFallback className='text-xs'>{getInitials(comment.author_name)}</AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1 space-y-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm font-medium'>{comment.author_name}</span>
                {comment.author_role === 'admin' ? (
                  <Badge variant='outline' className='rounded-full px-2 py-0 text-[11px]'>
                    admin
                  </Badge>
                ) : null}
                <span className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
                  {formatAbsoluteDateTimeKo(comment.created_at)}
                </span>
                {!comment.is_deleted && isEdited ? (
                  <span className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
                    수정됨 {formatAbsoluteDateTimeKo(comment.updated_at)}
                  </span>
                ) : null}
              </div>

              {isEditing ? (
                <SupportCommentForm
                  key={`edit-${comment.id}-${comment.updated_at}`}
                  mode='edit'
                  supportRequestId={supportRequestId}
                  commentId={comment.id}
                  defaultBody={comment.body}
                  autoFocus
                  onCancel={() => onEditChange(null)}
                  onSuccess={() => onEditChange(null)}
                />
              ) : (
                <p
                  className={cn(
                    'text-sm whitespace-pre-wrap',
                    comment.is_deleted && 'text-muted-foreground italic'
                  )}
                >
                  {comment.is_deleted ? '삭제된 댓글입니다.' : comment.body}
                </p>
              )}

              {!comment.is_deleted ? (
                <div className='flex flex-wrap items-center gap-1'>
                  {canReply ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-7 px-2 text-xs'
                      onClick={() => {
                        onEditChange(null);
                        onReplyChange(isReplying ? null : comment.id);
                      }}
                    >
                      <Icons.chat className='size-3.5' />
                      답글
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-7 px-2 text-xs'
                      onClick={() => {
                        onReplyChange(null);
                        onEditChange(isEditing ? null : comment.id);
                      }}
                    >
                      <Icons.edit className='size-3.5' />
                      수정
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='text-destructive hover:text-destructive h-7 px-2 text-xs'
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Icons.trash className='size-3.5' />
                      삭제
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {isReplying ? (
                <div className='rounded-lg border p-3'>
                  <SupportCommentForm
                    mode='reply'
                    supportRequestId={supportRequestId}
                    commentId={comment.id}
                    autoFocus
                    onCancel={() => onReplyChange(null)}
                    onSuccess={() => onReplyChange(null)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </article>
      </div>

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
        title='댓글을 삭제하시겠습니까?'
        description='댓글 내용은 숨겨지고 답글은 유지됩니다.'
        confirmLabel='삭제'
        cancelLabel='취소'
      />
    </div>
  );
}
