'use client';

import { useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess, notifyWarning } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { resendQuickRequestOpenchatMutation } from '../../api/mutations';
import type { QuickOpenchatDispatchView, QuickRequestDetail } from '../../api/types';
import { notifyQuickRequestError } from '../../lib/quick-request-mutation-feedback';
import {
  QUICK_OPENCHAT_EVENT_LABELS,
  QUICK_OPENCHAT_STATUS_LABELS,
  QUICK_OPENCHAT_STATUS_TONE_CLASS
} from '../../lib/quick-request-status';
import { QuickDetailSection } from './quick-detail-section';

type OpenchatRowProps = {
  requestNo: string;
  configured: boolean;
  dispatch: QuickOpenchatDispatchView;
};

function OpenchatRow({ requestNo, configured, dispatch }: OpenchatRowProps) {
  const resend = useMutation({ ...resendQuickRequestOpenchatMutation });
  const testId = `quick-openchat-${dispatch.event}`;
  const lastAttemptAt = dispatch.lastAttemptAt ?? dispatch.sentAt;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(dispatch.text);
      notifySuccess('메시지가 복사되었습니다.');
    } catch {
      notifyError('메시지를 복사하지 못했습니다.');
    }
  }

  function handleResend() {
    resend.mutate(
      { requestNo, event: dispatch.event },
      {
        onSuccess: (result) => {
          if (result.status === 'sent') {
            notifySuccess('오픈채팅 메시지를 다시 보냈습니다.');
          } else {
            notifyWarning('오픈채팅 메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
          }
        },
        onError: (error) => {
          notifyQuickRequestError(error);
        }
      }
    );
  }

  return (
    <li data-testid={testId} className='flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0'>
      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <span className='text-sm font-medium text-foreground'>
          {QUICK_OPENCHAT_EVENT_LABELS[dispatch.event]}
        </span>
        <Badge
          variant='outline'
          data-testid={`${testId}-status`}
          data-status={dispatch.status}
          className={cn(
            'rounded-full border-transparent px-2 py-0.5 text-xs font-normal shadow-none',
            QUICK_OPENCHAT_STATUS_TONE_CLASS[dispatch.status]
          )}
        >
          {QUICK_OPENCHAT_STATUS_LABELS[dispatch.status]}
        </Badge>
      </div>
      <p className='text-xs text-muted-foreground tabular-nums'>
        시도 {dispatch.attemptCount}회
        {lastAttemptAt ? ` · 마지막 시도 ${formatAbsoluteDateTimeKo(lastAttemptAt)}` : ''}
      </p>
      {dispatch.status === 'failed' && (dispatch.httpStatus || dispatch.errorMessage) ? (
        <p className='line-clamp-2 text-xs break-words text-destructive'>
          {[dispatch.httpStatus ? `HTTP ${dispatch.httpStatus}` : null, dispatch.errorMessage]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      <div className='flex flex-wrap gap-2'>
        {dispatch.status !== 'sent' ? (
          <Button
            type='button'
            variant='outline'
            className='h-11 lg:h-9'
            disabled={!configured}
            isLoading={resend.isPending}
            data-testid={`${testId}-resend`}
            onClick={handleResend}
          >
            <Icons.refresh aria-hidden />
            다시 보내기
          </Button>
        ) : null}
        <Button
          type='button'
          variant='ghost'
          className='h-11 lg:h-9'
          data-testid={`${testId}-copy`}
          onClick={handleCopy}
        >
          <Icons.copy aria-hidden />
          메시지 복사
        </Button>
      </div>
    </li>
  );
}

type QuickOpenchatPanelProps = {
  detail: QuickRequestDetail;
};

/** 오픈채팅 발송 기록 (동방·admin) — 다시 보내기 · 메시지 복사 (AC-14 · D-13) */
export function QuickOpenchatPanel({ detail }: QuickOpenchatPanelProps) {
  const openchat = detail.openchat;
  if (!openchat) return null;

  return (
    <QuickDetailSection
      title='오픈채팅 발송'
      description='등록·접수·배차완료·취소 때 자동으로 보냅니다.'
      data-testid='quick-openchat-panel'
    >
      <div className='flex flex-col gap-3'>
        {!openchat.configured ? (
          <Alert className='bg-muted/50'>
            <Icons.info aria-hidden />
            <AlertDescription>
              발송 주소가 설정되지 않아 자동 발송을 하지 않습니다. 「메시지 복사」로 직접 공유해 주세요.
            </AlertDescription>
          </Alert>
        ) : null}
        {openchat.dispatches.length === 0 ? (
          <p className='text-sm text-muted-foreground'>발송 기록이 없습니다.</p>
        ) : (
          <ul className='flex flex-col divide-y'>
            {openchat.dispatches.map((dispatch) => (
              <OpenchatRow
                key={dispatch.event}
                requestNo={detail.requestNo}
                configured={openchat.configured}
                dispatch={dispatch}
              />
            ))}
          </ul>
        )}
      </div>
    </QuickDetailSection>
  );
}
