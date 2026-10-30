'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import {
  QUICK_CHAT_DETAIL_ASIDE_MEDIA_QUERY,
  QUICK_CHAT_MOBILE_MEDIA_QUERY,
  QUICK_CHAT_TEXT
} from '../chat/quick-chat-constants';
import { QuickChatParticipantsButton } from '../chat/quick-chat-participants-button';
import { QuickRequestConversation } from '../chat/quick-request-conversation';
import { useMatchMedia } from '../chat/use-match-media';
import { QuickRequestDetailChatView } from './quick-request-detail-chat-view';
import { quickRequestDetailQueryOptions } from '../../api/queries';
import type { QuickRequestDetail } from '../../api/types';
import { quickRequestTopic } from '../../lib/quick-realtime-topics';
import { QuickApproveAlert } from '../dialogs/quick-approve-alert';
import { QuickCancelAlert } from '../dialogs/quick-cancel-alert';
import { QuickDispatchDialog } from '../dialogs/quick-dispatch-dialog';
import { QuickFinalAmountDialog } from '../dialogs/quick-final-amount-dialog';
import { QuickRequestEditSheet } from '../edit/quick-request-edit-sheet';
import { QuickRequestQueryBoundary } from '../quick-request-query-boundary';
import { QuickRequestRealtime } from '../quick-request-realtime';
import {
  QuickRequestActionBar,
  type QuickRequestDetailActionHandlers
} from './quick-request-action-bar';
import { QuickRequestAmountSection } from './quick-request-amount-section';
import {
  QUICK_DETAIL_DL_CLASS,
  QuickDetailGoodsRows,
  QuickDetailRow,
  QuickDetailSection
} from './quick-detail-section';
import { QuickRequestDetailHero } from './quick-request-detail-hero';
import { QuickRequestDetailMobile } from './quick-request-detail-mobile';
import { QuickRequestHistoryList } from './quick-request-history';
import { QuickRequestNotFound } from './quick-request-not-found';
import { QuickRequestPhoneLink } from './quick-request-phone-link';
import { QuickRequestRouteView } from './quick-request-route-view';

type OpenDialog = 'edit' | 'dispatch' | 'setFinal' | 'approve' | 'cancel' | null;

const chatParamParsers = {
  /** plan 93 — `?chat=1` (xl 미만 전체 대화 뷰 · xl은 aside 카드로 스크롤+포커스) · 뒤로가기로 상세 복귀 */
  chat: parseAsString.withOptions({ history: 'push' })
};

function QuickRequestDetailBody({ detail }: { detail: QuickRequestDetail }) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [{ chat }, setChatParam] = useQueryStates(chatParamParsers, {
    shallow: true
  });
  const isXl = useMatchMedia(QUICK_CHAT_DETAIL_ASIDE_MEDIA_QUERY);
  // plan 106 K9 — lg(1024) 미만은 휴대폰 전용 트리 1벌 (상세 본문은 hydration 뒤에만 그려져 SSR 불일치 없음)
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);
  const chatCardRef = useRef<HTMLDivElement>(null);
  const chatOpen = chat !== null;
  const close = () => setOpenDialog(null);
  const hasDispatch =
    detail.dispatch.vehicleInfo || detail.dispatch.driverName || detail.dispatch.driverPhone;
  const actionHandlers: QuickRequestDetailActionHandlers = {
    onOpenChat: () => void setChatParam({ chat: '1' }),
    onEdit: () => setOpenDialog('edit'),
    onCancel: () => setOpenDialog('cancel'),
    onDispatch: () => setOpenDialog('dispatch'),
    onSetFinal: () => setOpenDialog('setFinal'),
    onApprove: () => setOpenDialog('approve')
  };

  // xl + `?chat=1` (알림 착지 호환) — aside 카드로 스크롤 (입력창 포커스는 대화 본문이 뜬 뒤 `autoFocus`) (designer §4.3)
  useEffect(() => {
    if (!isXl || !chatOpen) return;
    chatCardRef.current?.scrollIntoView({ block: 'start' });
  }, [chatOpen, isXl]);

  // xl 미만 `?chat=1` — 상세 대화 뷰(lg 미만 전체 화면). 「상세로」는 뷰 안에서 `useQuickBack`이 처리한다
  // (예전 `setChatParam({ chat: null })` push는 폰 뒤로가기로 닫은 대화가 다시 열림 · T5 · AC-35 ④).
  // 뷰가 PageContainer 패딩을 음수 여백으로 상쇄하므로 다른 요소로 감싸지 않는다.
  if (!isXl && chatOpen) {
    return <QuickRequestDetailChatView detail={detail} />;
  }

  return (
    <>
      {isMobile ? (
        <QuickRequestDetailMobile detail={detail} {...actionHandlers} />
      ) : (
        <div className='flex min-w-0 flex-col gap-4'>
          <QuickRequestDetailHero detail={detail} />
          <div className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start'>
            <div className='flex min-w-0 flex-col gap-4'>
              <QuickDetailSection title='요청 정보' data-testid='quick-detail-section-request'>
                <dl className={QUICK_DETAIL_DL_CLASS}>
                  <QuickDetailRow label='요청자'>{detail.requester.name}</QuickDetailRow>
                  <QuickDetailRow label='연락처'>
                    <QuickRequestPhoneLink phone={detail.requester.phone} />
                  </QuickDetailRow>
                  <QuickDetailRow label='요청 시각'>
                    <time dateTime={detail.requestedAt} className='tabular-nums'>
                      {formatAbsoluteDateTimeKo(detail.requestedAt)}
                    </time>
                  </QuickDetailRow>
                </dl>
              </QuickDetailSection>
              <QuickDetailSection title='이동 경로' data-testid='quick-detail-section-route'>
                <QuickRequestRouteView detail={detail} />
              </QuickDetailSection>
              <QuickDetailSection
                title='물품 · 차량 · 운임'
                data-testid='quick-detail-section-goods'
              >
                <QuickDetailGoodsRows detail={detail} />
              </QuickDetailSection>
            </div>
            <aside
              aria-label='요청 대화 · 금액 · 배차 · 이력'
              className='flex min-w-0 flex-col gap-4'
            >
              {isXl ? (
                <div ref={chatCardRef} className='scroll-mt-4'>
                  <QuickDetailSection
                    title={QUICK_CHAT_TEXT.detailChatTitle}
                    data-testid='quick-detail-chat'
                    action={
                      <QuickChatParticipantsButton requestNo={detail.requestNo} variant='detail' />
                    }
                  >
                    <div className='-mx-5 -mb-5 flex h-[32rem] min-h-0 flex-col overflow-hidden rounded-b-xl border-t'>
                      <QuickRequestConversation
                        requestNo={detail.requestNo}
                        variant='detail'
                        autoFocus={chatOpen}
                        notFound={<QuickRequestNotFound />}
                      />
                    </div>
                  </QuickDetailSection>
                </div>
              ) : null}
              <QuickRequestAmountSection detail={detail} />
              <QuickDetailSection title='배차 정보' data-testid='quick-detail-section-dispatch'>
                {hasDispatch ? (
                  <dl className={QUICK_DETAIL_DL_CLASS}>
                    <QuickDetailRow label='자동차등록번호'>
                      {detail.dispatch.vehicleInfo ?? '—'}
                    </QuickDetailRow>
                    <QuickDetailRow label='기사 이름'>
                      {detail.dispatch.driverName ?? '—'}
                    </QuickDetailRow>
                    <QuickDetailRow label='기사 연락처'>
                      <QuickRequestPhoneLink
                        phone={detail.dispatch.driverPhone}
                        data-testid='quick-detail-driver-phone'
                      />
                    </QuickDetailRow>
                  </dl>
                ) : (
                  <p className='text-sm text-muted-foreground'>배차 완료 후 표시됩니다.</p>
                )}
              </QuickDetailSection>
              <QuickDetailSection title='처리 이력' data-testid='quick-detail-section-history'>
                <QuickRequestHistoryList detail={detail} />
              </QuickDetailSection>
            </aside>
          </div>
          <QuickRequestActionBar detail={detail} {...actionHandlers} />
        </div>
      )}

      {detail.permissions.canEdit ? (
        <QuickRequestEditSheet
          detail={detail}
          open={openDialog === 'edit'}
          onOpenChange={(open) => setOpenDialog(open ? 'edit' : null)}
        />
      ) : null}
      <QuickDispatchDialog
        requestNo={openDialog === 'dispatch' ? detail.requestNo : null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      />
      <QuickFinalAmountDialog
        target={
          openDialog === 'setFinal'
            ? {
                requestNo: detail.requestNo,
                estimatedAmount: detail.dispatch.estimatedAmount
              }
            : null
        }
        onOpenChange={(open) => {
          if (!open) close();
        }}
      />
      <QuickApproveAlert
        target={
          openDialog === 'approve'
            ? { requestNo: detail.requestNo, finalAmount: detail.finalAmount }
            : null
        }
        onOpenChange={(open) => {
          if (!open) close();
        }}
      />
      <QuickCancelAlert
        requestNo={openDialog === 'cancel' ? detail.requestNo : null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      />
    </>
  );
}

function QuickRequestDetailContent({ requestNo }: { requestNo: string }) {
  const { data: detail } = useSuspenseQuery(quickRequestDetailQueryOptions(requestNo));
  if (!detail) {
    return <QuickRequestNotFound />;
  }
  return (
    <>
      {/* plan 94 D-3 — 건별 private topic은 `id`(uuid)가 필요하므로 detail 조회 뒤 구독한다 (대화 컴포넌트와 채널 공유) */}
      <QuickRequestRealtime topic={quickRequestTopic(detail.id)} requestNo={requestNo} />
      <QuickRequestDetailBody detail={detail} />
    </>
  );
}

const subscribeNoop = () => () => undefined;

function useIsHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

type QuickRequestDetailPageProps = {
  requestNo: string;
};

/**
 * 상세 client 셸 — hydration 뒤 클라이언트에서 조회 (서버 상대 URL fetch 방지).
 * plan 92 U-2 — aside는 금액 → 배차 정보 → 처리 이력 3카드.
 * plan 93 — xl에서는 aside 상단에 「요청 대화」 카드, xl 미만은 액션바 「대화 N」 → `?chat=1` 전체 뷰 (designer §4.3).
 * plan 106 — lg 미만은 `QuickRequestDetailMobile`(상태 문장 → 기사 → 금액 → 경로 … · 하단 주 버튼 + 대화 + ⋯).
 *   lg 이상(1024~1279 · 1280 이상)은 지금 화면 그대로. 수정 Sheet·Dialog·AlertModal은 두 트리 공용.
 */
export function QuickRequestDetailPage({ requestNo }: QuickRequestDetailPageProps) {
  const isHydrated = useIsHydrated();

  return (
    <div data-testid='quick-detail' className='flex min-w-0 flex-1 flex-col'>
      {isHydrated ? (
        <QuickRequestQueryBoundary
          errorMessage='퀵 요청을 불러오지 못했습니다.'
          loadingFallback={<PageLoadingSpinner variant='fill' />}
        >
          <QuickRequestDetailContent requestNo={requestNo} />
        </QuickRequestQueryBoundary>
      ) : (
        <PageLoadingSpinner variant='fill' />
      )}
    </div>
  );
}
