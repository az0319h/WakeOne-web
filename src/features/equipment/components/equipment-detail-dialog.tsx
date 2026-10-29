'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DialogDescription } from '@/components/ui/dialog';
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
import { formatLedgerMoney } from '@/features/asset-ledger/lib/format';
import { EQUIPMENT_KIND_ICONS } from '@/features/asset-ledger/lib/ui-labels';
import { AssetDetailDialog } from '@/features/asset-requests/components/asset-detail-dialog';
import { AssetRequestComposeScreen } from '@/features/asset-requests/components/asset-request-form';
import { AssetRowRequests } from '@/features/asset-requests/components/asset-row-requests';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { notifyError, notifySuccess } from '@/lib/notify';
import { deleteEquipmentMutation } from '../api/mutations';
import { equipmentDetailQueryOptions } from '../api/queries';
import {
  EQUIPMENT_KIND_LABELS,
  isEquipmentManagerItem,
  LEDGER_ENTITY_LABELS,
  type EquipmentItem,
  type EquipmentManagerItem
} from '../api/types';

/** 「N-012 · MacBook Air 13」 */
export function equipmentTargetLabel(item: Pick<EquipmentItem, 'asset_no' | 'model_serial'>): string {
  return item.model_serial ? `${item.asset_no} · ${item.model_serial}` : item.asset_no;
}

function useEquipmentDetail(id: number) {
  return useSuspenseQuery({
    ...equipmentDetailQueryOptions(id),
    retry: (count, error) => !isNotFoundError(error) && count < 2
  });
}

function managerFields(item: EquipmentManagerItem) {
  return [
    { label: '회계장부', value: item.ledger_entity ? LEDGER_ENTITY_LABELS[item.ledger_entity] : null },
    { label: '장부코드', value: item.ledger_code, mono: true },
    {
      label: '구입 금액 (VAT 포함)',
      value: formatLedgerMoney(item.purchase_amount, 'KRW'),
      mono: true
    },
    {
      label: '구입일',
      value: item.purchased_on ? formatAbsoluteDateKo(item.purchased_on) : null,
      mono: true
    },
    { label: '구입처', value: item.vendor },
    { label: '관리 메모', value: item.manager_memo, wide: true }
  ];
}

function EquipmentRowScreenContent({ id }: { id: number }) {
  const { data } = useEquipmentDetail(id);
  const { item, requests } = data;
  const { openCompose, openRequestFromRow, close } = useLedgerDialogParams('equipment');
  const { openEdit } = useAssetLedgerSheet();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const KindIcon = Icons[EQUIPMENT_KIND_ICONS[item.kind] ?? 'product'];
  const kindLabel = EQUIPMENT_KIND_LABELS[item.kind] ?? item.kind;

  const deleteMutation = useMutation({
    ...deleteEquipmentMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '삭제했어요.');
      setDeleteOpen(false);
      close();
    },
    onError: (error) => notifyError(error instanceof Error ? error.message : '삭제하지 못했어요.')
  });

  return (
    <>
      <LedgerDialogHeader>
        <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted'>
          <KindIcon aria-hidden className='size-5' />
        </span>
        <div className='min-w-0 flex-1 space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <LedgerDialogTitle>
              <span translate='no'>{equipmentTargetLabel(item)}</span>
            </LedgerDialogTitle>
            <AssetStatusBadge kind='equipment' status={item.status} />
          </div>
          <DialogDescription className='text-sm text-muted-foreground'>{kindLabel}</DialogDescription>
        </div>
      </LedgerDialogHeader>

      <LedgerDialogBody className='space-y-6'>
        <section aria-labelledby='equipment-info-title' className='space-y-3'>
          <h3 id='equipment-info-title' className='text-sm font-semibold'>
            장비 정보
          </h3>
          <dl className='grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2'>
            <div className='min-w-0'>
              <dt className='text-xs text-muted-foreground'>사용자</dt>
              <dd className='mt-1 flex min-w-0 flex-wrap items-center gap-2'>
                <AssigneeChip assignee={item.assignee} />
                {item.assignee?.team_label ? (
                  <span className='text-xs text-muted-foreground'>{item.assignee.team_label}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className='text-xs text-muted-foreground'>상태</dt>
              <dd className='mt-1'>
                <AssetStatusBadge kind='equipment' status={item.status} />
              </dd>
            </div>
            <div>
              <dt className='text-xs text-muted-foreground'>품목</dt>
              <dd className='mt-1 text-sm'>{kindLabel}</dd>
            </div>
            <div className='min-w-0'>
              <dt className='text-xs text-muted-foreground'>모델·시리얼</dt>
              <dd className='mt-1 text-sm break-words' translate='no'>
                {item.model_serial || '—'}
              </dd>
            </div>
          </dl>
        </section>

        {isEquipmentManagerItem(item) ? (
          <AssetManagerSection
            fields={managerFields(item)}
            hasRequests={item.has_requests}
            deleteBlockedMessage='요청 기록이 있는 장비는 지울 수 없어요. 더 안 쓰면 상태를 「폐기」로 바꿔 주세요.'
            onEdit={() => openEdit(item.id)}
            onDelete={() => setDeleteOpen(true)}
          />
        ) : null}

        <AssetRowRequests targetType='equipment' requests={requests} onOpen={openRequestFromRow} />
      </LedgerDialogBody>

      <LedgerDialogFooter className='flex items-center justify-between gap-3'>
        <p className='min-w-0 text-xs text-muted-foreground sm:text-sm'>
          고장·교체·반납·분실은 여기서 요청해요
        </p>
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

      {isEquipmentManagerItem(item) ? (
        <AlertModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate(item.id)}
          loading={deleteMutation.isPending}
          title='이 비품을 삭제할까요?'
          description='삭제하면 되돌릴 수 없어요. 활동 로그에는 기록이 남아요.'
          confirmLabel='삭제'
          cancelLabel='취소'
        />
      ) : null}
    </>
  );
}

function EquipmentComposeContent({ id }: { id: number }) {
  const { data } = useEquipmentDetail(id);
  const { closeCompose } = useLedgerDialogParams('equipment');
  return (
    <AssetRequestComposeScreen
      targetType='equipment'
      targetId={data.item.id}
      targetLabel={equipmentTargetLabel(data.item)}
      onDone={closeCompose}
      onCancel={closeCompose}
    />
  );
}

type EquipmentScreenBoundaryProps = {
  id: number;
  onClose: () => void;
  children: React.ReactNode;
};

function EquipmentScreenBoundary({ id, onClose, children }: EquipmentScreenBoundaryProps) {
  return (
    <AssetLedgerQueryBoundary
      errorMessage='장비 정보를 불러오지 못했어요.'
      resetKey={String(id)}
      loadingFallback={<LedgerDialogLoading title='장비 정보' />}
      renderError={(error, retry) => (
        <LedgerDialogError
          title='장비 정보'
          message={
            isNotFoundError(error) ? '요청한 비품을 찾을 수 없어요.' : '장비 정보를 불러오지 못했어요.'
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

/** 비품 가운데 Dialog (`equipment-detail-dialog`) — 행 · 요청 폼 · 요청 1건 */
export function EquipmentDetailDialog() {
  const { close } = useLedgerDialogParams('equipment');
  return (
    <AssetDetailDialog
      targetType='equipment'
      data-testid='equipment-detail-dialog'
      renderRow={(id) => (
        <EquipmentScreenBoundary id={id} onClose={close}>
          <EquipmentRowScreenContent id={id} />
        </EquipmentScreenBoundary>
      )}
      renderCompose={(id) => (
        <EquipmentScreenBoundary id={id} onClose={close}>
          <EquipmentComposeContent id={id} />
        </EquipmentScreenBoundary>
      )}
    />
  );
}
