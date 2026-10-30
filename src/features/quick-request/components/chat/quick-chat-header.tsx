'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { QuickRequestChatRequestSummary } from '../../api/types';
import { quickRequestDetailHref } from '../dashboard/quick-dashboard-columns';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY, QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import { QuickChatMobileHeader } from './quick-chat-mobile-header';
import { QuickChatParticipantsButton } from './quick-chat-participants-button';
import { useMatchMedia } from './use-match-media';

type QuickChatHeaderProps = {
  request: QuickRequestChatRequestSummary;
  /** lg 미만 「목록」(`quick-chat-back`) — 호출자가 `useQuickBack`으로 넘긴다 (plan 106 D-5 · T5) */
  onBack: () => void;
};

/**
 * Messenger 대화 헤더 (U-3 · designer §4.2).
 * - lg↑(PC · 지금 화면 그대로): 요청번호 · 상태 · 경로·요청자 · 참여자 N(plan 101) · 상세 보기.
 * - lg 미만(plan 106 D-12): 전체 화면 한 줄 상단바 `QuickChatMobileHeader` — 뒤로 「목록」 · 번호·상태 · 「⋯」(참여자 N · 상세 보기).
 * 대화 헤더는 메시지 조회 뒤(= hydration 뒤) 그려지므로 `useMatchMedia`로 **하나만** 렌더한다(testid 한 벌 · designer K2).
 */
export function QuickChatHeader({ request, onBack }: QuickChatHeaderProps) {
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);

  if (isMobile) {
    return <QuickChatMobileHeader request={request} variant='messenger' onBack={onBack} />;
  }

  return (
    <div data-testid='quick-chat-header' className='flex items-center gap-2 px-4 py-3'>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 translate='no' className='text-base font-semibold tabular-nums'>
            {request.requestNo}
          </h2>
          <QuickRequestStatusBadge status={request.status} />
        </div>
        <p className='truncate text-xs text-muted-foreground'>
          {request.route.from} → {request.route.to} · {request.requesterName}
        </p>
      </div>
      {/* plan 101 U-1 — 「참여자 N」 (PC Popover) */}
      <QuickChatParticipantsButton requestNo={request.requestNo} variant='messenger' />
      <Button variant='outline' size='sm' className='h-9 shrink-0' asChild>
        <Link
          href={quickRequestDetailHref(request.requestNo)}
          aria-label={quickChatText.detailLinkLabel(request.requestNo)}
          data-testid='quick-chat-detail-link'
        >
          {QUICK_CHAT_TEXT.detailLink}
          <Icons.chevronRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
