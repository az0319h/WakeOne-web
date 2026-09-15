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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { DataTableScrollContainer } from '@/components/ui/table/data-table-scroll-container';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { walletBalanceEmailLogDetailQueryOptions } from '../../api/queries';
import { RecipientStatusBadge, RunStatusBadge, TriggerSourceBadge } from './status-badges';

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

        <ScrollArea className='min-h-0 flex-1 pr-3'>
          {isLoading ? <PageLoadingSpinner variant='compact' /> : null}
          {isError ? (
            <p className='text-destructive text-sm'>상세 정보를 불러오지 못했습니다.</p>
          ) : null}
          {run ? (
            <div className='space-y-6 pb-2'>
              <dl className='grid grid-cols-2 gap-3 text-sm sm:grid-cols-3'>
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

              <section>
                <h3 className='mb-2 text-sm font-medium'>수신자 ({run.recipients.length})</h3>
                <DataTableScrollContainer>
                  <Table
                    className='w-max min-w-full'
                    data-testid='wallet-balance-email-log-recipients-table'
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead>수신자</TableHead>
                        <TableHead>user_id</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>발송 시각</TableHead>
                        <TableHead>오류</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {run.recipients.length > 0 ? (
                        run.recipients.map((recipient) => (
                          <TableRow key={recipient.id}>
                            <TableCell className='max-w-[220px]'>
                              <div className='flex min-w-0 flex-col'>
                                <span className='truncate text-sm font-medium'>
                                  {recipient.recipient_full_name ?? '—'}
                                </span>
                                <span className='text-muted-foreground truncate text-xs'>
                                  {recipient.recipient_email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className='max-w-[120px] truncate font-mono text-xs'>
                              {recipient.user_id}
                            </TableCell>
                            <TableCell>
                              <RecipientStatusBadge status={recipient.status} />
                            </TableCell>
                            <TableCell className='font-mono text-xs whitespace-nowrap'>
                              {recipient.sent_at
                                ? formatAbsoluteDateTimeKo(recipient.sent_at)
                                : '—'}
                            </TableCell>
                            <TableCell className='text-destructive max-w-[180px] truncate text-xs'>
                              {recipient.error_message ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className='text-muted-foreground h-16 text-center text-sm'
                          >
                            발송된 수신자가 없습니다.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </DataTableScrollContainer>
              </section>
            </div>
          ) : null}
          <ScrollBar orientation='vertical' />
        </ScrollArea>

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
