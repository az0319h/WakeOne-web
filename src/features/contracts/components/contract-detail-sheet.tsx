'use client';

import { Suspense, useState } from 'react';
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
import { openAttachmentLightbox } from '@/features/attachments/components/attachment-lightbox-provider';
import { canOpenContractAttachment, downloadContractAttachment } from '../api/service';
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
  attachment,
  allAttachments
}: {
  contractId: number;
  attachment: ContractAttachmentSummary;
  allAttachments: ContractAttachmentSummary[];
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const isActive = attachment.status === 'active';
  const canOpen = canOpenContractAttachment(attachment);

  async function handleDownload() {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
    }
  }

  function handleOpen() {
    openAttachmentLightbox({
      source: { kind: 'contract', parentId: contractId },
      parentId: contractId,
      attachments: allAttachments,
      initialAttachmentId: attachment.id
    });
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between',
        !isActive && 'border-destructive/30 bg-destructive/5'
      )}
    >
      <div className='min-w-0'>
        <div className='flex items-start gap-2'>
          <Icons.paperclip className='mt-0.5 h-4 w-4 shrink-0' />
          {/* 긴 파일명은 잘라내지 않고 줄바꿈 */}
          <span className='text-sm font-medium break-all' title={attachment.file_name}>
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
      <div className='flex shrink-0 gap-2'>
        {canOpen ? (
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-11 md:size-9'
            disabled={!isActive}
            aria-label={`${attachment.file_name} 열기`}
            title='열기'
            onClick={handleOpen}
          >
            <Icons.eye className='h-4 w-4' />
            <span className='sr-only'>열기</span>
          </Button>
        ) : null}
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-11 md:size-9'
          isLoading={isDownloading}
          disabled={!isActive}
          aria-label={`${attachment.file_name} 다운로드`}
          title='다운로드'
          onClick={() => void handleDownload()}
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
      <div className='min-h-0 flex-1 space-y-6 overflow-auto py-2 pr-1'>
        {/* 모바일(640px 미만)은 Sheet 안 카드 테두리·안쪽 여백을 빼서 본문 폭 확보 */}
        <section className='sm:rounded-lg sm:border sm:p-4'>
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
                  <Button
                    asChild
                    variant='link'
                    className='h-11 gap-1 px-0 has-[>svg]:px-0 md:h-auto md:py-0'
                  >
                    <a href={contract.source_document_url} target='_blank' rel='noreferrer'>
                      Flex 문서 열기 <Icons.externalLink className='size-3' />
                    </a>
                  </Button>
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
                  allAttachments={contract.attachments}
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

      {/* 스크롤 영역 바깥 — 첨부가 많아도 「수정」이 항상 보이게 */}
      <SheetFooter className='border-t pt-4 sm:flex-row sm:justify-end'>
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
      <SheetContent className='flex min-h-0 w-full flex-col px-4 sm:max-w-3xl sm:px-6'>
        <SheetHeader>
          <SheetTitle>계약서 상세</SheetTitle>
          <SheetDescription>
            계약 문서와 첨부파일 상태를 확인합니다.
          </SheetDescription>
        </SheetHeader>
        {contract ? (
          <Suspense
            fallback={
              <div className='min-h-0 flex-1'>
                <PageLoadingSpinner variant='compact' />
              </div>
            }
          >
            {/* 본문(스크롤)과 SheetFooter(고정)를 함께 렌더 */}
            <ContractDetailContent
              key={contract.id}
              contractId={contract.id}
              onEdit={onEdit}
            />
          </Suspense>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
