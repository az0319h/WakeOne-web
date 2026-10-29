'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { QuickRequestChatRequestSummary } from '../../api/types';
import { quickRequestDetailHref } from '../dashboard/quick-dashboard-columns';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import { QuickChatParticipantsButton } from './quick-chat-participants-button';

type QuickChatHeaderProps = {
  request: QuickRequestChatRequestSummary;
  /** lg 미만 「목록」 (AC-03) */
  onBack: () => void;
};

/** Messenger 대화 헤더 — 목록 · 요청번호 · 상태 · 경로·요청자 · 참여자 N(plan 101) · 상세 보기 (U-3 · designer §4.2) */
export function QuickChatHeader({ request, onBack }: QuickChatHeaderProps) {
  return (
    <div data-testid='quick-chat-header' className='flex items-center gap-2 px-4 py-3'>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='-ml-2 size-11 shrink-0 lg:hidden'
        aria-label={QUICK_CHAT_TEXT.backToList}
        data-testid='quick-chat-back'
        onClick={onBack}
      >
        <Icons.chevronLeft aria-hidden />
      </Button>
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
      {/* plan 101 U-1 — 「참여자 N」 (Popover lg↑ / Drawer 미만) */}
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
