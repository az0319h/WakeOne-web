'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { quickRequestMessagesQueryOptions } from '../../api/queries';
import { countUnreadMessages } from '../chat/group-messages';
import { formatUnreadBadge } from '../chat/format-unread-badge';
import { QUICK_CHAT_TEXT, quickChatText } from '../chat/quick-chat-constants';

type QuickRequestChatLauncherProps = {
  requestNo: string;
  onOpen: () => void;
  className?: string;
};

/**
 * 액션바 「대화 N」 버튼 (xl 미만 · designer §4.3). 안 읽은 수는 `messages(no)`를 non-suspense `useQuery`로 읽어
 * 서버와 같은 규칙(남이 쓴 메시지 · id > 내 읽음 위치)으로 센다 — 집계 배지라 Suspense 경계를 두지 않는다.
 */
export function QuickRequestChatLauncher({ requestNo, onOpen, className }: QuickRequestChatLauncherProps) {
  const { data } = useQuery(quickRequestMessagesQueryOptions(requestNo));
  const unread = data
    ? countUnreadMessages(data.messages, {
        myUserId: data.viewer.userId,
        myLastReadMessageId: data.myLastReadMessageId
      })
    : 0;

  return (
    <Button
      type='button'
      variant='outline'
      className={cn('h-11 lg:h-10', className)}
      aria-label={quickChatText.chatButtonLabel(unread)}
      data-testid='quick-detail-chat-button'
      onClick={onOpen}
    >
      <Icons.chat aria-hidden />
      {QUICK_CHAT_TEXT.chatButton}
      {unread > 0 ? (
        <Badge
          data-testid='quick-detail-chat-unread'
          className='h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums'
        >
          {formatUnreadBadge(unread)}
        </Badge>
      ) : null}
    </Button>
  );
}
