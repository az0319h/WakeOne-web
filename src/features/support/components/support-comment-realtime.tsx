'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { supportKeys } from '../api/keys';
import type { SupportComment } from '../api/types';

interface SupportCommentRealtimeProps {
  supportRequestId: number;
  enabled?: boolean;
}

function isSupportComment(value: unknown): value is SupportComment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const comment = value as Partial<SupportComment>;
  return (
    typeof comment.id === 'number' &&
    typeof comment.support_request_id === 'number' &&
    typeof comment.author_user_id === 'string' &&
    typeof comment.author_name === 'string' &&
    (comment.author_role === 'admin' || comment.author_role === 'user') &&
    typeof comment.path === 'string' &&
    typeof comment.depth === 'number' &&
    typeof comment.body === 'string' &&
    typeof comment.is_deleted === 'boolean' &&
    typeof comment.created_at === 'string' &&
    typeof comment.updated_at === 'string'
  );
}

function mergeComment(comments: SupportComment[] | undefined, next: SupportComment) {
  if (!comments) {
    return comments;
  }

  const nextComments = comments.filter((comment) => comment.id !== next.id);
  nextComments.push(next);
  return nextComments.toSorted((a, b) => a.path.localeCompare(b.path));
}

export function SupportCommentRealtime({
  supportRequestId,
  enabled = true
}: SupportCommentRealtimeProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    function refreshComments(payload: { new: unknown }) {
      const nextComment = payload.new;
      if (isSupportComment(nextComment)) {
        queryClient.setQueryData<SupportComment[]>(
          supportKeys.comments(supportRequestId),
          (current) => mergeComment(current, nextComment)
        );
      }

      void queryClient.invalidateQueries({
        queryKey: supportKeys.comments(supportRequestId)
      });
    }

    const setup = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (cancelled || !session?.access_token) {
        return;
      }

      await supabase.realtime.setAuth(session.access_token);

      if (cancelled) {
        return;
      }

      channel = supabase
        .channel(`support-comments-${supportRequestId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_comments',
            filter: `support_request_id=eq.${supportRequestId}`
          },
          refreshComments
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'support_comments',
            filter: `support_request_id=eq.${supportRequestId}`
          },
          refreshComments
        )
        .subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient, supportRequestId]);

  return null;
}
