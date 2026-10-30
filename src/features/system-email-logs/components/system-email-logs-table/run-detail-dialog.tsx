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
import { DataTableScrollContainer } from '@/components/ui/table/data-table-scroll-container';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobileViewport } from '@/hooks/use-mobile-column-visibility';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { systemEmailLogDetailQueryOptions } from '../../api/queries';
import { RecipientStatusBadge, RunStatusBadge, TriggerSourceBadge, UnmatchedReasonBadge } from './status-badges';

type RunDetailDialogProps = {
  runId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DocumentNumbersCell({ documentNumbers }: { documentNumbers: string[] }) {
  const label = documentNumbers.join(', ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='block max-w-[220px] truncate text-xs'>{label || '—'}</span>
      </TooltipTrigger>
      <TooltipContent className='max-w-sm break-all'>{label || '—'}</TooltipContent>
    </Tooltip>
  );
}

export function RunDetailDialog({ runId, open, onOpenChange }: RunDetailDialogProps) {
  const { data, isLoading, isError } = useQuery({
    ...systemEmailLogDetailQueryOptions(runId ?? 0),
    enabled: open && runId !== null
  });

  const run = data?.run;
  const isMobile = useIsMobileViewport();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='flex max-h-[85vh] flex-col p-4 sm:max-w-3xl sm:p-6'
        data-testid='system-email-log-detail-dialog'
      >
        <DialogHeader>
          <DialogTitle>독촉 run 상세</DialogTitle>
          {run ? (
            <DialogDescription className='flex flex-wrap items-center gap-2 pt-1'>
              <span className='font-mono text-xs break-all'>{run.run_key}</span>
              <span>·</span>
              <span className='font-mono text-xs whitespace-nowrap'>
                {formatAbsoluteDateTimeKo(run.created_at)}
              </span>
              <TriggerSourceBadge source={run.trigger_source} />
              <RunStatusBadge status={run.status} />
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto pr-3'>
          {isLoading ? <PageLoadingSpinner variant='compact' /> : null}
          {isError ? (
            <p className='text-destructive text-sm'>상세 정보를 불러오지 못했습니다.</p>
          ) : null}
          {run ? (
            <div className='space-y-6 pb-2'>
              <dl className='grid grid-cols-2 gap-3 text-sm sm:grid-cols-4'>
                <div>
                  <dt className='text-muted-foreground'>대상 수</dt>
                  <dd className='font-medium tabular-nums'>{run.target_count}</dd>
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
                  <dt className='text-muted-foreground'>미매칭</dt>
                  <dd className='font-medium tabular-nums text-amber-600 dark:text-amber-400'>
                    {run.unmatched_count}
                  </dd>
                </div>
              </dl>

              <section>
                <h3 className='mb-2 text-sm font-medium'>수신자 ({run.recipients.length})</h3>
                <DataTableScrollContainer>
                  <Table className='w-max min-w-full' data-testid='system-email-log-recipients-table'>
                    <TableHeader>
                      <TableRow>
                        <TableHead>수신자</TableHead>
                        {isMobile ? null : (
                          <>
                            <TableHead>작성자</TableHead>
                            <TableHead>문서번호</TableHead>
                          </>
                        )}
                        <TableHead>상태</TableHead>
                        {isMobile ? null : <TableHead>오류</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {run.recipients.length > 0 ? (
                        run.recipients.map((recipient) =>
                          isMobile ? (
                            // 모바일: 수신자 셀 안에 작성자·문서번호·오류를 줄바꿈으로 — 상태는 옆 컬럼
                            <TableRow key={recipient.id}>
                              <TableCell className='max-w-[200px] text-xs'>
                                <div className='flex min-w-0 flex-col gap-0.5'>
                                  <span className='truncate'>{recipient.recipient_email}</span>
                                  <span className='text-muted-foreground truncate'>
                                    {recipient.author_name}
                                    {recipient.document_numbers.length > 0
                                      ? ` · ${recipient.document_numbers.join(', ')}`
                                      : ''}
                                  </span>
                                  {recipient.error_message ? (
                                    <span className='text-destructive break-all whitespace-normal'>
                                      {recipient.error_message}
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className='align-top'>
                                <RecipientStatusBadge status={recipient.status} />
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={recipient.id}>
                              <TableCell className='max-w-[160px] truncate text-xs'>
                                {recipient.recipient_email}
                              </TableCell>
                              <TableCell>{recipient.author_name}</TableCell>
                              <TableCell>
                                <DocumentNumbersCell documentNumbers={recipient.document_numbers} />
                              </TableCell>
                              <TableCell>
                                <RecipientStatusBadge status={recipient.status} />
                              </TableCell>
                              <TableCell className='text-destructive max-w-[180px] truncate text-xs'>
                                {recipient.error_message ?? '—'}
                              </TableCell>
                            </TableRow>
                          )
                        )
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={isMobile ? 2 : 5}
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

              {run.unmatched_targets.length > 0 ? (
                <section>
                  <h3 className='mb-2 text-sm font-medium'>미매칭 ({run.unmatched_targets.length})</h3>
                  <DataTableScrollContainer>
                    <Table className='w-max min-w-full' data-testid='system-email-log-unmatched-table'>
                      <TableHeader>
                        <TableRow>
                          <TableHead>작성자</TableHead>
                          <TableHead>문서번호</TableHead>
                          <TableHead>사유</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {run.unmatched_targets.map((target) => (
                          <TableRow key={`${target.author_name}-${target.document_numbers.join('-')}`}>
                            <TableCell>{target.author_name}</TableCell>
                            <TableCell>
                              <DocumentNumbersCell documentNumbers={target.document_numbers} />
                            </TableCell>
                            <TableCell>
                              <UnmatchedReasonBadge />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </DataTableScrollContainer>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            data-testid='system-email-log-dialog-close'
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
