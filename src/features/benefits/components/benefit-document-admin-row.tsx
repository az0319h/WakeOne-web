'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { useIsMobileViewport } from '@/hooks/use-mobile-column-visibility';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  cancelBenefitDocumentMutation,
  restoreBenefitDocumentMutation
} from '../api/mutations';
import type { BenefitDocument, BenefitType } from '../api/types';
import { isBenefitDocumentCancelled } from '../api/types';
import { formatBenefitDocumentDescription } from '../lib/format-benefit-document-description';
import { formatBenefitMoney } from './benefits-admin-utils';

const TYPE_LABEL: Record<BenefitType, string> = {
  book: '도서 신청서',
  fitness: '체력증진비 신청',
  education: '외부교육 신청서'
};

function openBenefitDocument(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface BenefitDocumentAdminRowProps {
  document: BenefitDocument;
}

export function BenefitDocumentAdminRow({ document }: BenefitDocumentAdminRowProps) {
  const cancelled = isBenefitDocumentCancelled(document);
  const hasFlexUrl = Boolean(document.source_document_url);
  const isMobile = useIsMobileViewport();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const cancelMutation = useMutation({
    ...cancelBenefitDocumentMutation,
    onSuccess: () => {
      notifySuccess('복지비 문서를 취소했습니다.');
      setCancelOpen(false);
    }
  });

  const restoreMutation = useMutation({
    ...restoreBenefitDocumentMutation,
    onSuccess: () => {
      notifySuccess('복지비 문서를 복구했습니다.');
      setRestoreOpen(false);
    }
  });

  const typeLabel = TYPE_LABEL[document.benefit_type];

  return (
    <>
      <TableRow
        data-testid='benefit-document-row'
        data-document-number={document.document_number}
        className={cn(
          'group bg-muted/20',
          hasFlexUrl && !cancelled && 'cursor-pointer hover:bg-muted/40',
          !hasFlexUrl && 'hover:bg-muted/30',
          cancelled && 'opacity-70'
        )}
        onClick={() => {
          // 모바일은 행 탭으로 Flex(새 탭)를 열지 않는다 — 「원문」 버튼으로만
          if (hasFlexUrl && !cancelled && !isMobile) {
            openBenefitDocument(document.source_document_url);
          }
        }}
      >
        <TableCell className='pl-6 max-md:whitespace-normal md:pl-14'>
          <p
            className={cn(
              'text-sm font-medium',
              cancelled && 'text-muted-foreground line-through'
            )}
          >
            {typeLabel}
          </p>
          {document.description ? (
            <p
              className={cn(
                'text-xs text-muted-foreground',
                cancelled && 'line-through'
              )}
            >
              {formatBenefitDocumentDescription(
                document.benefit_type,
                document.description
              )}
            </p>
          ) : null}
          {/* 모바일: 숨긴 문서번호·승인일·금액 컬럼을 한 줄로 */}
          <p
            className={cn(
              'mt-0.5 text-xs text-muted-foreground tabular-nums md:hidden',
              cancelled && 'line-through'
            )}
          >
            {document.document_number} · {formatAbsoluteDateKo(document.approved_at)} ·{' '}
            {formatBenefitMoney(document.amount)}
          </p>
        </TableCell>
        <TableCell
          className={cn(
            'font-mono text-xs whitespace-nowrap max-md:hidden',
            cancelled && 'text-muted-foreground line-through'
          )}
        >
          {document.document_number}
        </TableCell>
        <TableCell
          className={cn(
            'font-mono text-xs whitespace-nowrap max-md:hidden',
            cancelled && 'text-muted-foreground line-through'
          )}
        >
          {formatAbsoluteDateKo(document.approved_at)}
        </TableCell>
        <TableCell
          className={cn(
            'text-sm font-medium max-md:hidden',
            cancelled && 'text-muted-foreground line-through'
          )}
        >
          {formatBenefitMoney(document.amount)}
        </TableCell>
        <TableCell
          className={cn('max-md:hidden', cancelled && 'text-muted-foreground line-through')}
        >
          {document.benefit_type === 'book' ? formatBenefitMoney(document.amount) : ''}
        </TableCell>
        <TableCell
          className={cn('max-md:hidden', cancelled && 'text-muted-foreground line-through')}
        >
          {document.benefit_type === 'fitness' ? formatBenefitMoney(document.amount) : ''}
        </TableCell>
        <TableCell
          className={cn('max-md:hidden', cancelled && 'text-muted-foreground line-through')}
        >
          {document.benefit_type === 'education' ? formatBenefitMoney(document.amount) : ''}
        </TableCell>
        <TableCell className='text-right' onClick={(event) => event.stopPropagation()}>
          {cancelled ? (
            <div className='flex items-center justify-end gap-2 max-md:flex-col max-md:items-end max-md:gap-1'>
              <Badge variant='outline' className='whitespace-nowrap text-muted-foreground'>
                취소됨
              </Badge>
              {/* 터치 기기(hover 없음)는 hover 전에도 보이게 */}
              <div className='opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-11 text-muted-foreground md:size-8'
                  aria-label='복지비 문서 복구'
                  title='복지비 문서 복구'
                  isLoading={restoreMutation.isPending}
                  onClick={() => setRestoreOpen(true)}
                >
                  <Icons.rotateClockwise aria-hidden='true' />
                </Button>
              </div>
            </div>
          ) : (
            // 모바일은 「원문」·취소 버튼을 세로로 쌓아 첫 칸 폭을 확보
            <div className='flex items-center justify-end gap-1 max-md:flex-col max-md:items-end'>
              {hasFlexUrl ? (
                <Button
                  asChild
                  variant='outline'
                  size='sm'
                  className='h-11 md:hidden'
                >
                  <a
                    href={document.source_document_url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    원문
                    <Icons.externalLink aria-hidden='true' className='size-3.5' />
                  </a>
                </Button>
              ) : null}
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-11 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 md:size-8 [@media(hover:none)]:opacity-100'
                aria-label='복지비 문서 취소'
                title='복지비 문서 취소'
                isLoading={cancelMutation.isPending}
                onClick={() => setCancelOpen(true)}
              >
                <Icons.close aria-hidden='true' />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      <AlertModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title='복지비 문서를 취소할까요?'
        description={`${typeLabel} · ${document.document_number} · ${formatBenefitMoney(document.amount)} — 월 사용 합계에서 제외됩니다.`}
        confirmLabel='취소하기'
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(document.id)}
      />

      <AlertModal
        isOpen={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title='복지비 문서를 복구할까요?'
        description={`${typeLabel} · ${document.document_number} · ${formatBenefitMoney(document.amount)} — 월 사용 합계에 다시 포함됩니다.`}
        confirmLabel='복구하기'
        loading={restoreMutation.isPending}
        onConfirm={() => restoreMutation.mutate(document.id)}
      />
    </>
  );
}
