'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  CONTRACT_BULK_DOWNLOAD_MAX_MB,
  type ContractBulkDownloadPreview
} from '../api/types';
import {
  downloadContractAttachmentsBulk,
  getContractBulkDownloadPreview
} from '../api/service';

interface ContractBulkDownloadButtonProps {
  from: string | null;
  to: string | null;
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

function getBlockMessage(preview: ContractBulkDownloadPreview): string | null {
  if (preview.block_reason === 'no_targets') {
    return '선택 기간에 첨부완료 계약이 없습니다.';
  }

  if (preview.block_reason === 'too_many_contracts') {
    return `선택 기간 첨부완료 ${preview.contract_count}건 (최대 ${preview.max_contract_count}건). 기간을 줄여 주세요.`;
  }

  if (preview.block_reason === 'too_large') {
    return `총 용량 ${formatBytes(preview.total_bytes)} (최대 ${CONTRACT_BULK_DOWNLOAD_MAX_MB}MB). 기간을 줄여 주세요.`;
  }

  return null;
}

function ContractBulkDownloadDialog({
  open,
  from,
  to,
  onOpenChange
}: {
  open: boolean;
  from: string;
  to: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [preview, setPreview] = useState<ContractBulkDownloadPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      setIsDownloading(false);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);

    void getContractBulkDownloadPreview(from, to)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setPreview(response.preview);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPreviewError(
          error instanceof Error ? error.message : '첨부 ZIP 미리보기를 불러오지 못했습니다.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [from, open, to]);

  const handleDownload = useCallback(async () => {
    if (!preview?.can_download) {
      return;
    }

    setIsDownloading(true);
    try {
      const { blob, fileName } = await downloadContractAttachmentsBulk(from, to);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      notifySuccess(`ZIP 다운로드가 시작되었습니다. (${preview.contract_count}건)`);
      onOpenChange(false);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '첨부 ZIP 다운로드에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  }, [from, onOpenChange, preview, to]);

  const blockMessage = preview ? getBlockMessage(preview) : null;

  return (
    <Modal
      title='첨부 ZIP을 다운로드할까요?'
      description='아래 기간의 첨부완료 계약 첨부파일을 ZIP으로 받습니다.'
      isOpen={open}
      onClose={() => {
        if (!isDownloading) {
          onOpenChange(false);
        }
      }}
    >
      <div className='space-y-4'>
        <div className='bg-muted/40 space-y-2 rounded-md border p-3 text-sm'>
          {isPreviewLoading ? (
            <PageLoadingSpinner variant='compact' />
          ) : previewError ? (
            <p className='text-destructive'>{previewError}</p>
          ) : preview ? (
            <>
              <div className='flex justify-between gap-3'>
                <span className='text-muted-foreground shrink-0'>문서승인일</span>
                <span className='text-right font-medium'>
                  {formatAbsoluteDateKo(from)} ~ {formatAbsoluteDateKo(to)}
                </span>
              </div>
              <div className='flex justify-between gap-3'>
                <span className='text-muted-foreground shrink-0'>대상</span>
                <span className='text-right font-medium'>
                  첨부완료 {preview.contract_count}건 · 파일 {preview.file_count}개
                </span>
              </div>
              <div className='flex justify-between gap-3'>
                <span className='text-muted-foreground shrink-0'>예상 용량</span>
                <span className='text-right font-medium'>
                  약 {formatBytes(preview.total_bytes)} ({CONTRACT_BULK_DOWNLOAD_MAX_MB}MB 이하)
                </span>
              </div>
              {blockMessage ? (
                <p className={cn('pt-1 text-sm', preview.can_download ? '' : 'text-destructive')}>
                  {blockMessage}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <p className='text-muted-foreground text-xs'>
          ZIP 파일명: {preview?.zip_file_name ?? `contracts-${from}_${to}.zip`}
          <br />
          구조: {'{문서번호}/원본파일명'}
        </p>

        <div className='flex w-full items-center justify-end space-x-2 pt-2'>
          <Button
            type='button'
            variant='outline'
            disabled={isDownloading}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type='button'
            isLoading={isDownloading}
            disabled={!preview?.can_download || isPreviewLoading}
            onClick={() => void handleDownload()}
          >
            <Icons.download className='h-4 w-4' />
            다운로드
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ContractBulkDownloadButton({ from, to }: ContractBulkDownloadButtonProps) {
  const [open, setOpen] = useState(false);
  const hasDateRange = Boolean(from && to);

  const button = (
    <Button
      type='button'
      variant='outline'
      size='sm'
      disabled={!hasDateRange}
      onClick={() => setOpen(true)}
    >
      <Icons.download className='h-4 w-4' />
      첨부 ZIP 다운로드
    </Button>
  );

  return (
    <>
      {!hasDateRange ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='inline-flex'>{button}</span>
          </TooltipTrigger>
          <TooltipContent>문서승인일 기간을 먼저 선택하세요.</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      {hasDateRange && from && to ? (
        <ContractBulkDownloadDialog open={open} from={from} to={to} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
