'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavAccess } from '@/contexts/nav-access';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { AlertModal } from '@/components/modal/alert-modal';
import { notifyError, notifySuccess } from '@/lib/notify';
import { deleteOfficeSnackCandidateMutation } from '../api/mutations';
import type { OfficeSnackCandidate } from '../api/types';
import { formatWon, OFFICE_SNACK_PLACEHOLDER_IMAGE_URL } from './office-snack-utils';
import { CandidateFormSheet } from './candidate-form-sheet';
import { CandidateProductImage } from './candidate-product-image';

interface CandidatesSectionProps {
  sessionId: number;
  sessionState: 'upcoming' | 'registration' | 'voting' | 'closed';
  candidates: OfficeSnackCandidate[];
  myCandidate: OfficeSnackCandidate | null;
}

interface CandidateCardProps {
  candidate: OfficeSnackCandidate;
  canManage: boolean;
  canMutateCandidates: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function CandidateCard({
  candidate,
  canManage,
  canMutateCandidates,
  isDeleting,
  onEdit,
  onDelete
}: CandidateCardProps) {
  const imageUrl = candidate.image_url?.trim() || OFFICE_SNACK_PLACEHOLDER_IMAGE_URL;
  const ownerLabel = candidate.owner_name ?? candidate.owner_email ?? '알 수 없음';

  return (
    <article className='group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-md'>
      {canManage && canMutateCandidates ? (
        <div className='absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border bg-background/90 p-1 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100'>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='h-7 w-7'
            onClick={onEdit}
            aria-label='후보 수정'
          >
            <Icons.edit className='h-3.5 w-3.5' />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='text-destructive hover:text-destructive h-7 w-7'
            isLoading={isDeleting}
            onClick={onDelete}
            aria-label='후보 삭제'
          >
            <Icons.trash className='h-3.5 w-3.5' />
          </Button>
        </div>
      ) : null}

      <Link
        href={candidate.product_url}
        target='_blank'
        rel='noreferrer'
        className='flex flex-1 flex-col'
      >
        <CandidateProductImage
          src={imageUrl}
          alt={candidate.name}
          className='bg-muted/20 border-b p-4'
        />
        <div className='flex flex-1 flex-col gap-2 p-3'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <Badge variant='secondary' className='text-[11px]'>
              후보
            </Badge>
            <Badge variant='outline' className='text-[11px]'>
              {ownerLabel}
            </Badge>
          </div>

          <p className='line-clamp-2 text-sm font-medium leading-snug'>{candidate.name}</p>

          <div className='mt-auto flex items-center justify-between pt-1'>
            <p className='text-sm font-semibold'>{formatWon(candidate.price)}</p>
            <span className='text-primary text-xs font-medium'>상품 보기</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function CandidatesSection({
  sessionId,
  sessionState,
  candidates,
  myCandidate
}: CandidatesSectionProps) {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<OfficeSnackCandidate | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<OfficeSnackCandidate | null>(null);

  const deleteMutation = useMutation({
    ...deleteOfficeSnackCandidateMutation,
    onSuccess: () => {
      notifySuccess('후보를 삭제했습니다.');
      setCandidateToDelete(null);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '후보 삭제에 실패했습니다.');
    }
  });

  const canMutateCandidates = sessionState === 'registration';

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [candidates]);

  return (
    <>
      <AlertModal
        isOpen={!!candidateToDelete}
        onClose={() => setCandidateToDelete(null)}
        onConfirm={() => {
          if (candidateToDelete) {
            deleteMutation.mutate(candidateToDelete.id);
          }
        }}
        loading={deleteMutation.isPending}
        title='후보를 삭제할까요?'
        description={
          candidateToDelete
            ? `"${candidateToDelete.name}" 후보를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
            : '이 작업은 되돌릴 수 없습니다.'
        }
        confirmLabel='삭제'
        cancelLabel='취소'
      />
      <Card>
        <CardHeader className='flex flex-row items-center justify-between gap-2'>
          <div>
            <CardTitle>후보 목록</CardTitle>
            <p className='text-muted-foreground text-sm'>
              회차당 1인 1후보 등록, 가격 상한 50,000원 규칙이 적용됩니다.
            </p>
          </div>
          {canMutateCandidates ? (
            <Button
              onClick={() => setCreateOpen(true)}
              disabled={!!myCandidate && !isAdmin}
              variant='outline'
            >
              <Icons.add className='mr-2 h-4 w-4' />
              후보 등록
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {sortedCandidates.length === 0 ? (
            <p className='text-muted-foreground text-sm'>아직 등록된 후보가 없습니다.</p>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
              )}
            >
              {sortedCandidates.map((candidate) => {
                const canManage = isAdmin || candidate.owner_user_id === profile?.user_id;

                return (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    canManage={canManage}
                    canMutateCandidates={canMutateCandidates}
                    isDeleting={
                      deleteMutation.isPending && candidateToDelete?.id === candidate.id
                    }
                    onEdit={() => setEditingCandidate(candidate)}
                    onDelete={() => setCandidateToDelete(candidate)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CandidateFormSheet open={createOpen} onOpenChange={setCreateOpen} sessionId={sessionId} />
      <CandidateFormSheet
        open={!!editingCandidate}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCandidate(null);
          }
        }}
        sessionId={sessionId}
        candidate={editingCandidate}
      />
    </>
  );
}
