'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { QUICK_CHAT_DETAIL_ASIDE_MEDIA_QUERY, QUICK_CHAT_TEXT } from '../chat/quick-chat-constants';
import { QuickRequestConversation } from '../chat/quick-request-conversation';
import { useMatchMedia } from '../chat/use-match-media';
import { QuickRequestDetailChatView } from './quick-request-detail-chat-view';
import { quickRequestDetailQueryOptions } from '../../api/queries';
import type { QuickRequestDetail } from '../../api/types';
import { formatQuickAmountWon } from '../../lib/format-quick-amount';
import {
  formatQuickFreightLabel,
  formatQuickGoodsLabel,
  formatQuickVehicleTypes
} from '../../lib/quick-request-route-label';
import { QuickApproveAlert } from '../dialogs/quick-approve-alert';
import { QuickCancelAlert } from '../dialogs/quick-cancel-alert';
import { QuickDispatchDialog } from '../dialogs/quick-dispatch-dialog';
import { QuickFinalAmountDialog } from '../dialogs/quick-final-amount-dialog';
import { QuickRequestEditSheet } from '../edit/quick-request-edit-sheet';
import { QuickRequestQueryBoundary } from '../quick-request-query-boundary';
import { QuickRequestRealtime } from '../quick-request-realtime';
import { QuickRequestActionBar } from './quick-request-action-bar';
import { QUICK_DETAIL_DL_CLASS, QuickDetailRow, QuickDetailSection } from './quick-detail-section';
import { QuickRequestDetailHero } from './quick-request-detail-hero';
import { QuickRequestHistoryList } from './quick-request-history';
import { QuickRequestNotFound } from './quick-request-not-found';
import { QuickRequestPhoneLink } from './quick-request-phone-link';
import { QuickRequestRouteView } from './quick-request-route-view';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';

type OpenDialog = 'edit' | 'dispatch' | 'setFinal' | 'approve' | 'cancel' | null;

function AmountRow({ label, amount, testId }: { label: string; amount: number | null; testId: string }) {
  return (
    <div className='flex min-w-0 items-baseline justify-between gap-3'>
      <dt className='text-sm text-muted-foreground'>{label}</dt>
      <dd data-testid={testId} className='text-lg font-semibold text-foreground tabular-nums'>
        {formatQuickAmountWon(amount)}
      </dd>
    </div>
  );
}

const chatParamParsers = {
  /** plan 93 — `?chat=1` (xl 미만 전체 대화 뷰 · xl은 aside 카드로 스크롤+포커스) · 뒤로가기로 상세 복귀 */
  chat: parseAsString.withOptions({ history: 'push' })
};

function QuickRequestDetailBody({ detail }: { detail: QuickRequestDetail }) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [{ chat }, setChatParam] = useQueryStates(chatParamParsers, { shallow: true });
  const isXl = useMatchMedia(QUICK_CHAT_DETAIL_ASIDE_MEDIA_QUERY);
  const chatCardRef = useRef<HTMLDivElement>(null);
  const chatOpen = chat !== null;
  const close = () => setOpenDialog(null);
  const isOtherGoods = detail.goodsSize === 'other';
  const hasDispatch =
    detail.dispatch.vehicleInfo || detail.dispatch.driverName || detail.dispatch.driverPhone;

  // xl + `?chat=1` (알림 착지 호환) — aside 카드로 스크롤 (입력창 포커스는 대화 본문이 뜬 뒤 `autoFocus`) (designer §4.3)
  useEffect(() => {
    if (!isXl || !chatOpen) return;
    chatCardRef.current?.scrollIntoView({ block: 'start' });
  }, [chatOpen, isXl]);

  if (!isXl && chatOpen) {
    return <QuickRequestDetailChatView detail={detail} onBack={() => void setChatParam({ chat: null })} />;
  }

  return (
    <>
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
            <QuickDetailSection title='물품 · 차량 · 운임' data-testid='quick-detail-section-goods'>
              <dl className={QUICK_DETAIL_DL_CLASS}>
                <QuickDetailRow label='물품 크기'>{formatQuickGoodsLabel(detail.goodsSize)}</QuickDetailRow>
                {isOtherGoods && detail.itemDescription ? (
                  <QuickDetailRow label='물품 내용'>
                    <span className='whitespace-pre-wrap'>{detail.itemDescription}</span>
                  </QuickDetailRow>
                ) : null}
                <QuickDetailRow label='차량 종류'>{formatQuickVehicleTypes(detail)}</QuickDetailRow>
                <QuickDetailRow label='대수'>
                  <span className='tabular-nums'>{detail.vehicleCount}대</span>
                </QuickDetailRow>
                <QuickDetailRow label='운임'>{formatQuickFreightLabel(detail.freightPayment)}</QuickDetailRow>
              </dl>
            </QuickDetailSection>
          </div>
          <aside aria-label='요청 대화 · 금액 · 배차 · 이력' className='flex min-w-0 flex-col gap-4'>
            {isXl ? (
              <div ref={chatCardRef} className='scroll-mt-4'>
                <QuickDetailSection title={QUICK_CHAT_TEXT.detailChatTitle} data-testid='quick-detail-chat'>
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
            <QuickDetailSection title='금액' data-testid='quick-detail-section-amount'>
              <dl className='flex flex-col gap-2'>
                <AmountRow
                  label='예상금액'
                  amount={detail.dispatch.estimatedAmount}
                  testId='quick-detail-estimated-amount'
                />
                <AmountRow label='최종금액' amount={detail.finalAmount} testId='quick-detail-final-amount' />
              </dl>
              <p className='mt-2 text-xs text-muted-foreground'>예상금액은 부가세 별도입니다.</p>
            </QuickDetailSection>
            <QuickDetailSection title='배차 정보' data-testid='quick-detail-section-dispatch'>
              {hasDispatch ? (
                <dl className={QUICK_DETAIL_DL_CLASS}>
                  <QuickDetailRow label='차량정보'>{detail.dispatch.vehicleInfo ?? '—'}</QuickDetailRow>
                  <QuickDetailRow label='기사 이름'>{detail.dispatch.driverName ?? '—'}</QuickDetailRow>
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
        <QuickRequestActionBar
          detail={detail}
          onOpenChat={() => void setChatParam({ chat: '1' })}
          onEdit={() => setOpenDialog('edit')}
          onCancel={() => setOpenDialog('cancel')}
          onDispatch={() => setOpenDialog('dispatch')}
          onSetFinal={() => setOpenDialog('setFinal')}
          onApprove={() => setOpenDialog('approve')}
        />
      </div>

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
            ? { requestNo: detail.requestNo, estimatedAmount: detail.dispatch.estimatedAmount }
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
  return <QuickRequestDetailBody detail={detail} />;
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
 */
export function QuickRequestDetailPage({ requestNo }: QuickRequestDetailPageProps) {
  const isHydrated = useIsHydrated();

  return (
    <div data-testid='quick-detail' className='flex min-w-0 flex-1 flex-col'>
      <QuickRequestRealtime requestNo={requestNo} />
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
