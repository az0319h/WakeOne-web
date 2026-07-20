'use client';

import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { notifyError } from '@/lib/notify';
import { formatAbsoluteDateKoOrPlaceholder } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { contractByIdQueryOptions } from '../api/queries';
import {
  canOpenContractAttachment,
  downloadContractAttachment,
  openContractAttachment
} from '../api/service';
import type { ContractAttachmentSummary, ContractDocument } from '../api/types';
import { CONTRACT_ATTACHMENT_STATUS_LABELS } from './contracts-table/options';

interface ContractDetailSheetProps {
  contract: ContractDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (contract: ContractDocument) => void;
}

function formatAmount(value: number | null): string {
  if (value === null) {
    return '-';
  }
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(value);
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value}B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function DetailItem({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className='space-y-1'>
      <dt className='text-muted-foreground text-xs font-medium'>{label}</dt>
      <dd className='text-sm'>{value || '-'}</dd>
    </div>
  );
}

function AttachmentRow({
  contractId,
  attachment
}: {
  contractId: number;
  attachment: ContractAttachmentSummary;
}) {
  const isActive = attachment.status === 'active';
  const canOpen = canOpenContractAttachment(attachment);

  async function handleDownload() {
    try {
      const blob = await downloadContractAttachment(contractId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '첨부파일 다운로드에 실패했습니다.';
      notifyError(message);
    }
  }

  function handleOpen() {
    if (!openContractAttachment(contractId, attachment.id)) {
      notifyError('첨부파일을 새 탭으로 열 수 없습니다.');
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between',
        !isActive && 'border-destructive/30 bg-destructive/5'
      )}
    >
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          <Icons.paperclip className='h-4 w-4 shrink-0' />
          <span className='truncate text-sm font-medium'>
            {attachment.file_name}
          </span>
          {!isActive ? (
            <Badge variant='destructive' className='shrink-0'>
              삭제됨
            </Badge>
          ) : null}
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {formatBytes(attachment.file_size)} ·{' '}
          {formatAbsoluteDateKoOrPlaceholder(attachment.created_at)}
        </p>
      </div>
      <div className='flex gap-2'>
        {canOpen ? (
          <Button
            type='button'
            variant='outline'
            size='icon'
            disabled={!isActive}
            aria-label={`${attachment.file_name} 열기`}
            title='열기'
            onClick={handleOpen}
          >
            <Icons.externalLink className='h-4 w-4' />
            <span className='sr-only'>열기</span>
          </Button>
        ) : null}
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={!isActive}
          aria-label={`${attachment.file_name} 다운로드`}
          title='다운로드'
          onClick={handleDownload}
        >
          <Icons.download className='h-4 w-4' />
          <span className='sr-only'>다운로드</span>
        </Button>
      </div>
    </div>
  );
}

function ContractDetailContent({
  contractId,
  onEdit
}: {
  contractId: number;
  onEdit: (contract: ContractDocument) => void;
}) {
  const { data: contract } = useSuspenseQuery(
    contractByIdQueryOptions(contractId)
  );

  return (
    <>
      <div className='space-y-6'>
        <section className='rounded-lg border p-4'>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
            <div>
              <h3 className='text-base font-semibold'>
                {contract.document_number}
              </h3>
              <p className='text-muted-foreground text-sm'>
                {contract.contract_target}
              </p>
            </div>
            <Badge variant='outline'>
              {CONTRACT_ATTACHMENT_STATUS_LABELS[contract.attachment_status]}
            </Badge>
          </div>
          <dl className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <DetailItem
              label='문서승인일'
              value={formatAbsoluteDateKoOrPlaceholder(contract.approved_at)}
            />
            <DetailItem
              label='문서 생성일'
              value={formatAbsoluteDateKoOrPlaceholder(contract.document_created_at)}
            />
            <DetailItem
              label='작성자'
              value={`${contract.author_name}${contract.author_email ? ` (${contract.author_email})` : ''}`}
            />
            <DetailItem
              label='계약 시작일'
              value={formatAbsoluteDateKoOrPlaceholder(contract.contract_start_date)}
            />
            <DetailItem
              label='계약 종료일'
              value={formatAbsoluteDateKoOrPlaceholder(contract.contract_end_date)}
            />
            <DetailItem label='금액' value={formatAmount(contract.amount)} />
            <DetailItem label='출처' value={contract.source_type} />
          </dl>
          <div className='mt-4 space-y-4'>
            <DetailItem label='계약 내용' value={contract.contract_summary} />
            <DetailItem label='비고' value={contract.notes ?? '-'} />
            {contract.source_document_url ? (
              <DetailItem
                label='원문 URL'
                value={
                  <a
                    href={contract.source_document_url}
                    target='_blank'
                    rel='noreferrer'
                    className='text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline'
                  >
                    Flex 문서 열기 <Icons.externalLink className='h-3 w-3' />
                  </a>
                }
              />
            ) : null}
          </div>
        </section>

        <section className='space-y-3'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h3 className='text-base font-semibold'>첨부파일</h3>
              <p className='text-muted-foreground text-sm'>
                첨부파일 상태를 조회합니다. 업로드와 삭제 처리는 수정 화면에서만
                가능합니다.
              </p>
            </div>
          </div>

          {contract.attachments.length > 0 ? (
            <div className='space-y-2'>
              {contract.attachments.map((attachment) => (
                <AttachmentRow
                  key={attachment.id}
                  contractId={contract.id}
                  attachment={attachment}
                />
              ))}
            </div>
          ) : (
            <div className='border-border bg-card/50 rounded-lg border border-dashed p-4 text-sm'>
              등록된 첨부파일이 없습니다.
            </div>
          )}

          <div className='rounded-lg border p-3'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <p className='text-sm font-medium'>첨부파일 없음 예외</p>
                <p className='text-muted-foreground mt-1 text-sm'>
                  {contract.no_attachment_required
                    ? contract.no_attachment_reason ||
                      '첨부파일 없음으로 지정되어 독촉 대상에서 제외됩니다.'
                    : '첨부파일 없음 예외가 지정되지 않았습니다.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <SheetFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onEdit(contract)}
        >
          <Icons.edit className='mr-2 h-4 w-4' />
          수정
        </Button>
      </SheetFooter>
    </>
  );
}

export function ContractDetailSheet({
  contract,
  open,
  onOpenChange,
  onEdit
}: ContractDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-3xl'>
        <SheetHeader>
          <SheetTitle>계약서 상세</SheetTitle>
          <SheetDescription>
            계약 문서와 첨부파일 상태를 확인합니다.
          </SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 overflow-auto py-2 pr-1'>
          {contract ? (
            <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
              <ContractDetailContent
                key={contract.id}
                contractId={contract.id}
                onEdit={onEdit}
              />
            </Suspense>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
