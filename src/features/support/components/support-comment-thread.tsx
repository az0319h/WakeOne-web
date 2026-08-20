'use client';

import { useState } from 'react';
import type { SupportComment } from '../api/types';
import { SupportCommentItem } from './support-comment-item';

interface SupportCommentThreadProps {
  comments: SupportComment[];
  supportRequestId: number;
  currentUserId: string | null;
  isAdmin: boolean;
}

export function SupportCommentThread({
  comments,
  supportRequestId,
  currentUserId,
  isAdmin
}: SupportCommentThreadProps) {
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);

  if (comments.length === 0) {
    return (
      <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm'>
        아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {comments.map((comment) => (
        <SupportCommentItem
          key={comment.id}
          comment={comment}
          supportRequestId={supportRequestId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          replyingToId={replyingToId}
          editingCommentId={editingCommentId}
          onReplyChange={setReplyingToId}
          onEditChange={setEditingCommentId}
        />
      ))}
    </div>
  );
}
