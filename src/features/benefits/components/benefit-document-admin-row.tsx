'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  cancelBenefitDocumentMutation,
  restoreBenefitDocumentMutation
} from '../api/mutations';
import type { BenefitDocument, BenefitType } from '../api/types';
import { isBenefitDocumentCancelled } from '../api/types';
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
        className={cn(
          'group bg-muted/20',
          hasFlexUrl && !cancelled && 'cursor-pointer hover:bg-muted/40',
          !hasFlexUrl && 'hover:bg-muted/30',
          cancelled && 'opacity-70'
        )}
        onClick={() => {
          if (hasFlexUrl && !cancelled) {
            openBenefitDocument(document.source_document_url);
          }
        }}
      >
        <TableCell className='pl-14'>
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
              {document.description}
            </p>
          ) : null}
        </TableCell>
        <TableCell
          className={cn(
            'font-mono text-xs whitespace-nowrap',
            cancelled && 'text-muted-foreground line-through'
          )}
        >
          {document.document_number}
        </TableCell>
        <TableCell
          className={cn(
            'font-mono text-xs whitespace-nowrap',
            cancelled && 'text-muted-foreground line-through'
          )}
        >
          {formatAbsoluteDateKo(document.approved_at)}
        </TableCell>
        <TableCell
          className={cn(
            'text-sm font-medium',
            cancelled && 'text-muted-foreground line-through'
          )}
        >
          {formatBenefitMoney(document.amount)}
        </TableCell>
        <TableCell className={cancelled ? 'text-muted-foreground line-through' : ''}>
          {document.benefit_type === 'book' ? formatBenefitMoney(document.amount) : ''}
        </TableCell>
        <TableCell className={cancelled ? 'text-muted-foreground line-through' : ''}>
          {document.benefit_type === 'fitness' ? formatBenefitMoney(document.amount) : ''}
        </TableCell>
        <TableCell className={cancelled ? 'text-muted-foreground line-through' : ''}>
          {document.benefit_type === 'education' ? formatBenefitMoney(document.amount) : ''}
        </TableCell>
        <TableCell className='text-right' onClick={(event) => event.stopPropagation()}>
          {cancelled ? (
            <div className='flex items-center justify-end gap-2'>
              <Badge variant='outline' className='whitespace-nowrap text-muted-foreground'>
                취소됨
              </Badge>
              <div className='opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-8 text-muted-foreground'
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
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-8 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100'
              aria-label='복지비 문서 취소'
              title='복지비 문서 취소'
              isLoading={cancelMutation.isPending}
              onClick={() => setCancelOpen(true)}
            >
              <Icons.close aria-hidden='true' />
            </Button>
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
