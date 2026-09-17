'use client';

import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { walletBalanceEmailLogDetailQueryOptions } from '../../api/queries';
import { RecipientsInfiniteTable } from './recipients-infinite-table';
import { RunStatusBadge, TriggerSourceBadge } from './status-badges';

type RunDetailDialogProps = {
  runId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RunDetailDialog({ runId, open, onOpenChange }: RunDetailDialogProps) {
  const { data, isLoading, isError } = useQuery({
    ...walletBalanceEmailLogDetailQueryOptions(runId ?? 0),
    enabled: open && runId !== null
  });

  const run = data?.run;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='flex max-h-[85vh] flex-col sm:max-w-3xl'
        data-testid='wallet-balance-email-log-detail-dialog'
      >
        <DialogHeader>
          <DialogTitle>잔액 확인 이메일 run 상세</DialogTitle>
          {run ? (
            <DialogDescription className='flex flex-wrap items-center gap-2 pt-1'>
              <span className='font-mono text-xs'>{run.run_key}</span>
              <span>·</span>
              <span className='font-mono text-xs whitespace-nowrap'>
                {formatAbsoluteDateTimeKo(run.created_at)}
              </span>
              <TriggerSourceBadge source={run.trigger_source} />
              <RunStatusBadge status={run.status} />
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className='flex min-h-0 flex-1 flex-col gap-4 pr-1'>
          {isLoading ? <PageLoadingSpinner variant='compact' /> : null}
          {isError ? (
            <p className='text-destructive text-sm'>상세 정보를 불러오지 못했습니다.</p>
          ) : null}
          {run ? (
            <>
              <dl className='grid shrink-0 grid-cols-2 gap-3 text-sm sm:grid-cols-3'>
                <div>
                  <dt className='text-muted-foreground'>due</dt>
                  <dd className='font-medium tabular-nums'>{run.due_count}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>발송 성공</dt>
                  <dd className='font-medium tabular-nums'>{run.sent_count}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>실패</dt>
                  <dd className='text-destructive font-medium tabular-nums'>{run.failed_count}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>차단</dt>
                  <dd className='font-medium tabular-nums text-amber-600 dark:text-amber-400'>
                    {run.blocked_count}
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>건너뜀</dt>
                  <dd className='font-medium tabular-nums'>{run.skipped_count}</dd>
                </div>
              </dl>

              <section className='flex min-h-0 flex-1 flex-col'>
                <h3 className='mb-2 shrink-0 text-sm font-medium'>
                  수신자 ({run.recipients.length})
                </h3>
                <RecipientsInfiniteTable recipients={run.recipients} runId={run.id} />
              </section>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            data-testid='wallet-balance-email-log-dialog-close'
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
