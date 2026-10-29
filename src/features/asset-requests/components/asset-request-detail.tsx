'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  AssetStatusBadge,
  LedgerToneBadge
} from '@/features/asset-ledger/components/asset-status-badge';
import {
  assetRequestTitle,
  nameInitials,
  targetLabelHead
} from '@/features/asset-ledger/lib/ui-labels';
import { useNavAccess } from '@/contexts/nav-access';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cancelAssetRequestMutation, changeAssetRequestStatusMutation } from '../api/mutations';
import { assetRequestDetailQueryOptions } from '../api/queries';
import { ASSET_TARGET_LABELS, type AssetTargetType } from '../api/types';
import { AssetCommentForm } from './asset-comment-form';
import { AssetCommentsSection } from './asset-comments-section';
import { AssetRequestAssigneeChange } from './asset-request-assignee-change';
import { AssetRequestEditForm } from './asset-request-form';
import { AssetRequestRejectModal } from './asset-request-reject-modal';
import { AssetRequestStepper } from './asset-request-stepper';

type PersonLineProps = {
  name: string;
  teamLabel: string | null;
};

function PersonLine({ name, teamLabel }: PersonLineProps) {
  return (
    <span className='flex min-w-0 flex-wrap items-center gap-2'>
      <Avatar className='size-6 shrink-0'>
        <AvatarFallback className='text-[10px]'>{nameInitials(name)}</AvatarFallback>
      </Avatar>
      <span className='font-medium' translate='no'>
        {name}
      </span>
      {teamLabel ? <span className='text-xs text-muted-foreground'>{teamLabel}</span> : null}
    </span>
  );
}

type RequestScreenProps = {
  targetType: AssetTargetType;
  requestId: number;
  /** 행 화면에서 열었으면(행 파라미터 있음) 「N-012 장비로」, 아니면 「장비 정보 보기」 */
  openedFromRow: boolean;
  onBack: () => void;
  onOpenTarget: (targetId: number) => void;
};

function AssetRequestScreen({
  targetType,
  requestId,
  openedFromRow,
  onBack,
  onOpenTarget
}: RequestScreenProps) {
  const profile = useNavAccess();
  const { data } = useSuspenseQuery({
    ...assetRequestDetailQueryOptions(requestId),
    retry: (count, error) => !isNotFoundError(error) && count < 2
  });
  const { request, viewer } = data;
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const statusMutation = useMutation({
    ...changeAssetRequestStatusMutation,
    onSuccess: (response) => notifySuccess(response.message),
    onError: (error) =>
      notifyError(error instanceof Error ? error.message : '상태를 바꾸지 못했어요.')
  });
  const cancelMutation = useMutation({
    ...cancelAssetRequestMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '요청을 취소했어요.');
      setCancelOpen(false);
    },
    onError: (error) =>
      notifyError(error instanceof Error ? error.message : '요청을 취소하지 못했어요.')
  });

  const head = targetLabelHead(request.target_label);
  const backLabel = openedFromRow
    ? targetType === 'equipment'
      ? `${head} 장비로`
      : `${head} 구독으로`
    : targetType === 'equipment'
      ? '장비 정보 보기'
      : '구독 정보 보기';
  const managerHint =
    targetType === 'equipment'
      ? '완료해도 장비 정보는 자동으로 바뀌지 않아요.'
      : '완료해도 구독 정보는 자동으로 바뀌지 않아요.';
  const showRequesterActions = viewer.can_edit || viewer.can_cancel;
  const pendingStatus = statusMutation.isPending ? statusMutation.variables?.payload.status : null;

  return (
    <>
      <LedgerDialogHeader>
        <div className='min-w-0 flex-1 space-y-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='-ml-2 h-9'
            data-testid='asset-request-back'
            onClick={() => (openedFromRow ? onBack() : onOpenTarget(request.target_id))}
          >
            <Icons.chevronLeft aria-hidden />
            <span translate='no'>{backLabel}</span>
          </Button>
          <div className='flex flex-wrap items-center gap-2'>
            <LedgerDialogTitle>{assetRequestTitle(request.request_type)}</LedgerDialogTitle>
            <AssetStatusBadge
              kind='request'
              status={request.status}
              data-testid='asset-request-status-badge'
            />
          </div>
          <DialogDescription className='text-sm text-muted-foreground' translate='no'>
            {request.target_label} · {ASSET_TARGET_LABELS[targetType]}
          </DialogDescription>
          <AssetRequestStepper status={request.status} hasAssignee={request.assignee_user_id !== null} />
        </div>
      </LedgerDialogHeader>

      <LedgerDialogBody className='space-y-5'>
        <div data-testid='asset-request-detail' className='space-y-5'>
          <dl className='grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-3 text-sm'>
            <dt className='text-muted-foreground'>요청자</dt>
            <dd className='min-w-0'>
              <PersonLine name={request.requester_name} teamLabel={request.requester_team_label} />
            </dd>
            <dt className='text-muted-foreground'>요청 시각</dt>
            <dd className='font-mono tabular-nums'>{formatAbsoluteDateTimeKo(request.created_at)}</dd>
            <dt className='text-muted-foreground'>담당자</dt>
            <dd className='flex min-w-0 flex-wrap items-center gap-2'>
              <div data-testid='asset-request-assignee' className='min-w-0'>
                {request.assignee_name ? (
                  <PersonLine name={request.assignee_name} teamLabel={request.assignee_team_label} />
                ) : (
                  <span className='text-amber-700 dark:text-amber-400'>담당자 없음</span>
                )}
              </div>
              {viewer.can_change_assignee ? (
                <AssetRequestAssigneeChange
                  requestId={request.id}
                  currentAssigneeId={request.assignee_user_id}
                />
              ) : null}
            </dd>
          </dl>

          {editing ? (
            <AssetRequestEditForm
              key={`${request.id}-${request.updated_at}`}
              targetType={targetType}
              request={request}
              onDone={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div data-testid='asset-request-content' className='space-y-2 rounded-lg border p-4'>
              <p className='text-xs text-muted-foreground'>요청 내용</p>
              <p className='text-sm break-words whitespace-pre-wrap'>{request.body}</p>
              {request.edited_at ? (
                <p
                  data-testid='asset-request-edited'
                  className='font-mono text-xs text-muted-foreground tabular-nums'
                >
                  수정됨 {formatAbsoluteDateTimeKo(request.edited_at)}
                </p>
              ) : null}
            </div>
          )}

          {request.status === 'rejected' && request.reject_reason ? (
            <div
              data-testid='asset-request-reject-reason-view'
              className='rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm break-words whitespace-pre-wrap'
            >
              반려 사유: {request.reject_reason}
            </div>
          ) : null}

          <div data-testid='asset-request-actions' className='flex flex-wrap items-center gap-2'>
            {showRequesterActions && !editing ? (
              <>
                {viewer.can_edit ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-9'
                    data-testid='asset-request-edit'
                    onClick={() => setEditing(true)}
                  >
                    <Icons.edit aria-hidden />
                    수정
                  </Button>
                ) : null}
                {viewer.can_cancel ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-9 text-destructive hover:text-destructive'
                    data-testid='asset-request-cancel'
                    onClick={() => setCancelOpen(true)}
                  >
                    <Icons.xCircle aria-hidden />
                    요청 취소
                  </Button>
                ) : null}
              </>
            ) : null}
            {viewer.is_manager ? (
              <>
                <LedgerToneBadge tone='violet'>
                  <Icons.lock aria-hidden className='size-3' />
                  권한자
                </LedgerToneBadge>
                {viewer.can_start ? (
                  <Button
                    type='button'
                    size='sm'
                    className='h-9'
                    data-testid='asset-request-start'
                    isLoading={pendingStatus === 'in_progress'}
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ id: request.id, payload: { status: 'in_progress' } })
                    }
                  >
                    <Icons.clock aria-hidden />
                    처리 시작
                  </Button>
                ) : null}
                {viewer.can_complete ? (
                  <Button
                    type='button'
                    size='sm'
                    className='h-9'
                    data-testid='asset-request-complete'
                    isLoading={pendingStatus === 'completed'}
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ id: request.id, payload: { status: 'completed' } })
                    }
                  >
                    <Icons.check aria-hidden />
                    완료 처리
                  </Button>
                ) : null}
                {viewer.can_reject ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-9'
                    data-testid='asset-request-reject'
                    disabled={statusMutation.isPending}
                    onClick={() => setRejectOpen(true)}
                  >
                    <Icons.ban aria-hidden />
                    반려
                  </Button>
                ) : null}
                <p
                  data-testid='asset-request-manager-hint'
                  className='w-full text-xs text-muted-foreground sm:w-auto'
                >
                  {managerHint}
                </p>
              </>
            ) : null}
          </div>

          <AssetCommentsSection
            requestId={request.id}
            viewerId={profile?.user_id ?? null}
            isManager={viewer.is_manager}
            canComment={viewer.can_comment}
            realtimeEnabled
          />
        </div>
      </LedgerDialogBody>

      {viewer.can_comment ? (
        <LedgerDialogFooter>
          <AssetCommentForm mode='create' requestId={request.id} />
        </LedgerDialogFooter>
      ) : null}

      <AlertModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate(request.id)}
        loading={cancelMutation.isPending}
        title='요청을 취소할까요?'
        description='취소한 요청은 되돌릴 수 없어요.'
        confirmLabel='요청 취소'
        cancelLabel='닫기'
      />
      {viewer.can_reject ? (
        <AssetRequestRejectModal requestId={request.id} open={rejectOpen} onOpenChange={setRejectOpen} />
      ) : null}
    </>
  );
}

type AssetRequestDetailProps = RequestScreenProps & {
  onClose: () => void;
};

/**
 * Dialog 화면 3 — 요청 1건 (designer §2-5-3) · 상태·담당자·요청 내용·댓글.
 * 버튼 노출은 서버가 계산한 `viewer.can_*`만 따른다(Route가 매번 재검증).
 */
export function AssetRequestDetail({ onClose, ...props }: AssetRequestDetailProps) {
  return (
    <AssetLedgerQueryBoundary
      errorMessage='요청을 불러오지 못했어요.'
      resetKey={String(props.requestId)}
      loadingFallback={<LedgerDialogLoading title='요청' />}
      renderError={(error, retry) => (
        <LedgerDialogError
          title='요청'
          message={isNotFoundError(error) ? '요청을 찾을 수 없어요.' : '요청을 불러오지 못했어요.'}
          onClose={onClose}
          onRetry={isNotFoundError(error) ? undefined : retry}
        />
      )}
    >
      <AssetRequestScreen {...props} />
    </AssetLedgerQueryBoundary>
  );
}
