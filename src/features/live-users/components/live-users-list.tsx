'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { getInitials } from '@/features/auth/components/profile-display';
import { cn } from '@/lib/utils';
import type { LiveUserPresence } from '../api/types';
import { LIVE_USERS_PAGE_SIZE, LIVE_USERS_SCROLL_MAX_HEIGHT } from '../lib/constants';

interface LiveUsersListProps {
  users: LiveUserPresence[];
}

export function LiveUsersList({ users }: LiveUsersListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const canLoadMoreRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(LIVE_USERS_PAGE_SIZE);

  const visibleUsers = users.slice(0, visibleCount);
  const hasMore = visibleCount < users.length;
  const needsScroll = users.length > LIVE_USERS_PAGE_SIZE;

  useEffect(() => {
    setVisibleCount(LIVE_USERS_PAGE_SIZE);
    canLoadMoreRef.current = false;
  }, [users]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) {
      return;
    }

    const onScroll = () => {
      canLoadMoreRef.current = true;

      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 24) {
        setVisibleCount((current) => {
          if (current >= users.length) {
            return current;
          }
          return Math.min(current + LIVE_USERS_PAGE_SIZE, users.length);
        });
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [users.length]);

  useEffect(() => {
    const node = loadMoreRef.current;
    const root = scrollRef.current;
    if (!node || !root || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const scrolled =
          canLoadMoreRef.current ||
          root.scrollTop > 0 ||
          root.scrollHeight <= root.clientHeight;

        if (entries[0]?.isIntersecting && scrolled) {
          setVisibleCount((current) =>
            Math.min(current + LIVE_USERS_PAGE_SIZE, users.length)
          );
        }
      },
      {
        root,
        rootMargin: '120px'
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, users.length]);

  return (
    <div
      ref={scrollRef}
      data-testid='live-users-list-scroll'
      className={cn('pr-1', needsScroll && 'overflow-y-auto')}
      style={needsScroll ? { maxHeight: LIVE_USERS_SCROLL_MAX_HEIGHT } : undefined}
    >
      <div className='space-y-8'>
        {visibleUsers.map((user) => (
          <div
            key={user.user_id}
            className='flex min-h-11 items-center'
            data-testid={`live-user-${user.user_id}`}
          >
            <Avatar className='h-9 w-9'>
              <AvatarImage src={user.avatar_url ?? undefined} alt={user.full_name} />
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
            <div className='ml-4 min-w-0 space-y-1'>
              <p className='flex min-w-0 items-center gap-1.5 truncate text-sm leading-none font-medium'>
                <span
                  aria-hidden='true'
                  data-testid='live-user-dot'
                  className='size-2 shrink-0 animate-pulse rounded-full bg-emerald-500 ring-2 ring-background dark:bg-emerald-400'
                />
                <span className='truncate'>{user.full_name}</span>
              </p>
              <p className='text-muted-foreground truncate text-sm'>{user.email}</p>
            </div>
            <Badge variant='outline' className='ml-auto shrink-0'>
              접속 중
            </Badge>
          </div>
        ))}
      </div>
      {hasMore ? (
        <div ref={loadMoreRef} className='flex justify-center pt-2'>
          <PageLoadingSpinner variant='compact' />
        </div>
      ) : null}
    </div>
  );
}
