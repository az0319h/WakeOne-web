'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DialogDescription } from '@/components/ui/dialog';
import { AssetDateWithDday } from '@/features/asset-ledger/components/asset-dday';
import {
  LedgerDialogBody,
  LedgerDialogError,
  LedgerDialogFooter,
  LedgerDialogHeader,
  LedgerDialogLoading,
  LedgerDialogTitle
} from '@/features/asset-ledger/components/asset-ledger-dialog-frame';
import {
  AssetLedgerQueryBoundary,
  isNotFoundError
} from '@/features/asset-ledger/components/asset-ledger-query-boundary';
import { useAssetLedgerSheet } from '@/features/asset-ledger/components/asset-ledger-sheet-context';
import { AssetManagerSection } from '@/features/asset-ledger/components/asset-manager-section';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { AssigneeChip } from '@/features/asset-ledger/components/assignee-chip';
import { useLedgerDialogParams } from '@/features/asset-ledger/hooks/use-ledger-params';
import {
  formatBillingDay,
  formatLedgerMoney
} from '@/features/asset-ledger/lib/format';
import { SUBSCRIPTION_CATEGORY_ICONS } from '@/features/asset-ledger/lib/ui-labels';
import { AssetDetailDialog } from '@/features/asset-requests/components/asset-detail-dialog';
import { AssetRequestComposeScreen } from '@/features/asset-requests/components/asset-request-form';
import { AssetRowRequests } from '@/features/asset-requests/components/asset-row-requests';
import { formatAbsoluteDateKoOrPlaceholder } from '@/lib/format-date';
import { notifyError, notifySuccess } from '@/lib/notify';
import { deleteSubscriptionMutation } from '../api/mutations';
import { subscriptionDetailQueryOptions } from '../api/queries';
import {
  BILLING_CYCLE_LABELS,
  isSubscriptionManagerItem,
  PAYER_ENTITY_LABELS,
  SUBSCRIPTION_CATEGORY_LABELS,
  type SubscriptionItem,
  type SubscriptionManagerItem
} from '../api/types';

/** 「Adobe Creative Cloud · 모든 앱」 */
export function subscriptionTargetLabel(item: Pick<SubscriptionItem, 'name' | 'plan_name'>): string {
  return item.plan_name ? `${item.name} · ${item.plan_name}` : item.name;
}

function useSubscriptionDetail(id: number) {
  return useSuspenseQuery({
    ...subscriptionDetailQueryOptions(id),
    retry: (count, error) => !isNotFoundError(error) && count < 2
  });
}

function managerFields(item: SubscriptionManagerItem) {
  const amountText = item.amount_varies
    ? '매월 다름'
    : formatLedgerMoney(item.amount, item.currency);
  return [
    { label: '결제 법인', value: item.payer_entity ? PAYER_ENTITY_LABELS[item.payer_entity] : null },
    { label: '카드 끝 4자리', value: item.card_last4, mono: true },
    {
      label: '결제 주기',
      value: item.billing_cycle ? BILLING_CYCLE_LABELS[item.billing_cycle] : null
    },
    {
      label: '결제일',
      value:
        item.billing_day || item.billing_date
          ? formatBillingDay(item.billing_cycle, item.billing_day, item.billing_date)
          : null
    },
    { label: '금액', value: amountText, mono: !item.amount_varies },
    { label: '시작일', value: item.started_on ? formatAbsoluteDateKoOrPlaceholder(item.started_on) : null, mono: true },
    {
      label: '주계정',
      value: item.owner_account ? (
        <span translate='no' className='break-all'>
          {item.owner_account}
        </span>
      ) : null
    },
    { label: '관리 메모', value: item.manager_memo, wide: true }
  ];
}

function SubscriptionRowScreenContent({ id }: { id: number }) {
  const { data } = useSubscriptionDetail(id);
  const { item, requests } = data;
  const { openCompose, openRequestFromRow, close } = useLedgerDialogParams('subscription');
  const { openEdit } = useAssetLedgerSheet();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const CategoryIcon = Icons[SUBSCRIPTION_CATEGORY_ICONS[item.category] ?? 'product'];

  const deleteMutation = useMutation({
    ...deleteSubscriptionMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '삭제했어요.');
      setDeleteOpen(false);
      close();
    },
    onError: (error) => notifyError(error instanceof Error ? error.message : '삭제하지 못했어요.')
  });

  const description = [
    item.plan_name,
    SUBSCRIPTION_CATEGORY_LABELS[item.category],
    item.purpose
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <LedgerDialogHeader>
        <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted'>
          <CategoryIcon aria-hidden className='size-5' />
        </span>
        <div className='min-w-0 flex-1 space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <LedgerDialogTitle>
              <span translate='no'>{item.name}</span>
            </LedgerDialogTitle>
            <AssetStatusBadge kind='subscription' status={item.status} />
          </div>
          <DialogDescription className='text-sm wrap-break-word break-keep text-muted-foreground'>
            {description}
          </DialogDescription>
        </div>
      </LedgerDialogHeader>

      <LedgerDialogBody className='space-y-6'>
        <section aria-labelledby='subscription-info-title' className='space-y-3'>
          <h3 id='subscription-info-title' className='text-sm font-semibold'>
            구독 정보
          </h3>
          <dl className='grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2'>
            <div className='min-w-0 sm:col-span-2'>
              <dt className='text-xs text-muted-foreground'>대상자</dt>
              <dd className='mt-1 flex flex-wrap gap-2'>
                {item.assignees.length === 0 ? (
                  <span className='text-sm text-muted-foreground'>—</span>
                ) : (
                  item.assignees.map((assignee, index) => (
                    <span key={`${assignee.assignee_type}-${assignee.label}-${index}`} className='inline-flex items-center gap-1.5'>
                      <AssigneeChip assignee={assignee} />
                      {assignee.team_label ? (
                        <span className='text-xs text-muted-foreground'>{assignee.team_label}</span>
                      ) : null}
                    </span>
                  ))
                )}
              </dd>
            </div>
            {/* 휴대폰: 상태 배지는 머리(제목 옆)에 이미 있어 본문 줄은 뺀다 */}
            <div className='max-md:hidden'>
              <dt className='text-xs text-muted-foreground'>상태</dt>
              <dd className='mt-1'>
                <AssetStatusBadge kind='subscription' status={item.status} />
              </dd>
            </div>
            <div>
              <dt className='text-xs text-muted-foreground'>구분</dt>
              <dd className='mt-1 text-sm'>{SUBSCRIPTION_CATEGORY_LABELS[item.category]}</dd>
            </div>
            <div className='min-w-0'>
              <dt className='text-xs text-muted-foreground'>플랜</dt>
              <dd className='mt-1 text-sm break-words' translate='no'>
                {item.plan_name || '—'}
              </dd>
            </div>
            <div className='min-w-0'>
              <dt className='text-xs text-muted-foreground'>사용 목적</dt>
              <dd className='mt-1 text-sm break-words'>{item.purpose || '—'}</dd>
            </div>
            <div>
              <dt className='text-xs text-muted-foreground'>만료·갱신일</dt>
              <dd className='mt-1 text-sm'>
                <AssetDateWithDday date={item.expires_on} />
              </dd>
            </div>
          </dl>
        </section>

        {isSubscriptionManagerItem(item) ? (
          <AssetManagerSection
            fields={managerFields(item)}
            hasRequests={item.has_requests}
            deleteBlockedMessage='요청 기록이 있는 구독은 지울 수 없어요. 더 안 쓰면 상태를 「해지됨」으로 바꿔 주세요.'
            onEdit={() => openEdit(item.id)}
            onDelete={() => setDeleteOpen(true)}
          />
        ) : null}

        <AssetRowRequests targetType='subscription' requests={requests} onOpen={openRequestFromRow} />
      </LedgerDialogBody>

      <LedgerDialogFooter className='flex items-center justify-between gap-3'>
        <p className='min-w-0 text-xs text-muted-foreground sm:text-sm'>해지·변경은 여기서 요청해요</p>
        <Button
          type='button'
          className='h-11 shrink-0 md:h-9'
          data-testid='asset-request-open-form'
          onClick={openCompose}
        >
          <Icons.send aria-hidden />
          요청하기
        </Button>
      </LedgerDialogFooter>

      {isSubscriptionManagerItem(item) ? (
        <AlertModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate(item.id)}
          loading={deleteMutation.isPending}
          title='이 구독을 삭제할까요?'
          description='삭제하면 되돌릴 수 없어요. 활동 로그에는 기록이 남아요.'
          confirmLabel='삭제'
          cancelLabel='취소'
        />
      ) : null}
    </>
  );
}

function SubscriptionComposeContent({ id }: { id: number }) {
  const { data } = useSubscriptionDetail(id);
  const { closeCompose } = useLedgerDialogParams('subscription');
  return (
    <AssetRequestComposeScreen
      targetType='subscription'
      targetId={data.item.id}
      targetLabel={subscriptionTargetLabel(data.item)}
      onDone={closeCompose}
      onCancel={closeCompose}
    />
  );
}

type SubscriptionScreenBoundaryProps = {
  id: number;
  onClose: () => void;
  children: React.ReactNode;
};

function SubscriptionScreenBoundary({ id, onClose, children }: SubscriptionScreenBoundaryProps) {
  return (
    <AssetLedgerQueryBoundary
      errorMessage='구독 정보를 불러오지 못했어요.'
      resetKey={String(id)}
      loadingFallback={<LedgerDialogLoading title='구독 정보' />}
      renderError={(error, retry) => (
        <LedgerDialogError
          title='구독 정보'
          message={
            isNotFoundError(error) ? '요청한 구독을 찾을 수 없어요.' : '구독 정보를 불러오지 못했어요.'
          }
          onClose={onClose}
          onRetry={isNotFoundError(error) ? undefined : retry}
        />
      )}
    >
      {children}
    </AssetLedgerQueryBoundary>
  );
}

/** 구독 가운데 Dialog (`subscription-detail-dialog`) — 행 · 요청 폼 · 요청 1건 */
export function SubscriptionDetailDialog() {
  const { close } = useLedgerDialogParams('subscription');
  return (
    <AssetDetailDialog
      targetType='subscription'
      data-testid='subscription-detail-dialog'
      renderRow={(id) => (
        <SubscriptionScreenBoundary id={id} onClose={close}>
          <SubscriptionRowScreenContent id={id} />
        </SubscriptionScreenBoundary>
      )}
      renderCompose={(id) => (
        <SubscriptionScreenBoundary id={id} onClose={close}>
          <SubscriptionComposeContent id={id} />
        </SubscriptionScreenBoundary>
      )}
    />
  );
}
