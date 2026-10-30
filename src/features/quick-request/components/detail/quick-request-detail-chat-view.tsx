'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { QuickRequestDetail } from '../../api/types';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY, QUICK_CHAT_TEXT } from '../chat/quick-chat-constants';
import { QuickChatHeaderFrame, QuickChatMobileHeader } from '../chat/quick-chat-mobile-header';
import { QuickChatParticipantsButton } from '../chat/quick-chat-participants-button';
import { QuickRequestConversation } from '../chat/quick-request-conversation';
import { useMatchMedia } from '../chat/use-match-media';
import { useVisualViewportHeight } from '../chat/use-visual-viewport-height';
import { quickRequestDetailHref } from '../dashboard/quick-dashboard-columns';
import { useQuickBack } from '../mobile/use-quick-back';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QuickRequestNotFound } from './quick-request-not-found';

type QuickRequestDetailChatViewProps = {
  detail: QuickRequestDetail;
  /**
   * @deprecated plan 106 D-5 — **무시된다**(하위 호환용으로만 남김 · 넘겨도 되고 빼도 된다).
   * 「상세로」(`quick-detail-chat-back`)는 이 컴포넌트가 `useQuickBack`으로 처리한다: 퀵 안 기록이 있으면 `router.back()`,
   * 바로 들어온 `?chat=1`이면 같은 상세(`chat` 제거)로 `replace`. 예전 `setChatParam({ chat: null })`(push)은
   * [상세, 상세?chat=1, 상세]를 쌓아 폰 뒤로가기가 닫은 대화를 다시 여는 문제(T5 · AC-35 ④)가 있었다.
   */
  onBack?: () => void;
};

/**
 * plan 93 designer §4.3 — xl 미만 `?chat=1` 전체 높이 대화 뷰 (Drawer·Sheet 아님 · 문서 흐름 안 → 키보드가 입력창을 가리지 않음).
 * 본문은 공용 `QuickRequestConversation variant='detail'`.
 *
 * - lg 미만(plan 106 D-12 · designer §6.9 · K1): **전체 화면** — 루트 `data-quick-fullscreen`(공통 상단바·앱 배너 숨김 · 문서 스크롤 잠금)
 *   + `PageContainer` 패딩 상쇄 + 높이 = visualViewport · 한 줄 상단바 `QuickChatMobileHeader`(「상세로」 · 번호·상태 ·
 *   둘째 줄 「요청 대화 · 출발 → 도착」 · 「⋯」 = 참여자 N만). 로딩·오류에도 상단바 틀(`QuickChatHeaderFrame`)로 뒤로 가능.
 * - 1024~1279(PC): 지금 화면 그대로(「상세로」 + 「요청 대화」 + 번호·상태 + 참여자 N).
 */
export function QuickRequestDetailChatView({ detail }: QuickRequestDetailChatViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);
  const goBack = useQuickBack(quickRequestDetailHref(detail.requestNo));
  // 상세를 아래로 내려 보다가 열면 창 스크롤이 남아 있다 → 맨 위로 (훅이 `top` 기준으로 높이를 잡는다)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  useVisualViewportHeight(ref, { mode: 'fullscreen' });

  return (
    <div
      ref={ref}
      data-testid='quick-detail-chat'
      data-mode='full'
      data-quick-fullscreen=''
      className={cn(
        'flex h-[calc(100dvh-11rem)] min-h-[20rem] min-w-0 flex-col rounded-xl border bg-card',
        'max-lg:-mx-4 max-lg:-mt-2 max-lg:-mb-4 max-lg:h-dvh max-lg:min-h-0 max-lg:rounded-none max-lg:border-0 md:max-lg:-mx-6 md:max-lg:-mt-4'
      )}
    >
      {isMobile ? null : (
        // PC 헤더 — SSR·hydration 직후(isMobile false) 휴대폰에서 잠깐 보이지 않게 lg 미만은 CSS로도 숨긴다
        <div className='flex shrink-0 items-center gap-2 border-b px-4 py-3 max-lg:hidden'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='-ml-2 size-11 shrink-0'
            aria-label={QUICK_CHAT_TEXT.backToDetail}
            data-testid='quick-detail-chat-back'
            onClick={goBack}
          >
            <Icons.chevronLeft aria-hidden />
          </Button>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
            <h3 className='text-base font-semibold'>{QUICK_CHAT_TEXT.detailChatTitle}</h3>
            <span translate='no' className='text-sm text-muted-foreground tabular-nums'>
              {detail.requestNo}
            </span>
            <QuickRequestStatusBadge status={detail.status} />
          </div>
          {/* plan 101 U-1 — 「참여자 N」 */}
          <QuickChatParticipantsButton requestNo={detail.requestNo} variant='detail' className='ml-auto' />
        </div>
      )}
      <QuickRequestConversation
        requestNo={detail.requestNo}
        variant='detail'
        autoFocus
        header={
          isMobile
            ? (request) => <QuickChatMobileHeader request={request} variant='detail' onBack={goBack} />
            : undefined
        }
        frameHeader={
          isMobile ? (
            <QuickChatHeaderFrame variant='detail' requestNo={detail.requestNo} onBack={goBack} />
          ) : undefined
        }
        notFound={<QuickRequestNotFound />}
      />
    </div>
  );
}
