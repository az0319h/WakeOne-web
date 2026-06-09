'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { notifyError, notifySuccess } from '@/lib/notify';
import { submitOfficeSnackVoteMutation } from '../api/mutations';
import type { OfficeSnackCandidate, OfficeSnackVote } from '../api/types';

interface VoteRankPanelProps {
  sessionId: number;
  candidates: OfficeSnackCandidate[];
  myVote: OfficeSnackVote | null;
  canVote: boolean;
  variant?: 'card' | 'plain';
}

type RankKey = 'rank1' | 'rank2' | 'rank3';
type RankSelection = Record<RankKey, number | null>;

const RANKS: { key: RankKey; label: string }[] = [
  { key: 'rank1', label: '1순위 (5점)' },
  { key: 'rank2', label: '2순위 (3점)' },
  { key: 'rank3', label: '3순위 (1점)' }
];

export function VoteRankPanel({
  sessionId,
  candidates,
  myVote,
  canVote,
  variant = 'card'
}: VoteRankPanelProps) {
  const [selection, setSelection] = useState<RankSelection>({
    rank1: null,
    rank2: null,
    rank3: null
  });

  const voteMutation = useMutation({
    ...submitOfficeSnackVoteMutation,
    onSuccess: () => {
      notifySuccess('투표를 제출했습니다. 재투표는 불가능합니다.');
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '투표 제출에 실패했습니다.');
    }
  });

  const selectedIds = useMemo(
    () => [selection.rank1, selection.rank2, selection.rank3].filter((id): id is number => !!id),
    [selection]
  );
  const hasDuplicate = new Set(selectedIds).size !== selectedIds.length;
  const isComplete = selectedIds.length === 3;
  const canSubmit = canVote && !myVote && isComplete && !hasDuplicate;
  const candidateNameById = useMemo(() => {
    return new Map(candidates.map((candidate) => [candidate.id, candidate.name]));
  }, [candidates]);

  const panelInner = myVote ? (
    <>
      <div className='space-y-2'>
        <h3 className='text-base font-semibold'>내 투표</h3>
        <p className='text-muted-foreground text-sm'>
          이미 투표를 제출했습니다. 회차당 재투표는 허용되지 않습니다.
        </p>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Badge variant='outline'>
          1순위 {candidateNameById.get(myVote.rank1_candidate_id) ?? `#${myVote.rank1_candidate_id}`}
        </Badge>
        <Badge variant='outline'>
          2순위 {candidateNameById.get(myVote.rank2_candidate_id) ?? `#${myVote.rank2_candidate_id}`}
        </Badge>
        <Badge variant='outline'>
          3순위 {candidateNameById.get(myVote.rank3_candidate_id) ?? `#${myVote.rank3_candidate_id}`}
        </Badge>
      </div>
    </>
  ) : (
    <>
      <div className='space-y-1'>
        <h3 className='text-base font-semibold'>3순위 투표</h3>
        <p className='text-muted-foreground text-sm'>
          1·2·3순위를 모두 선택해야 제출할 수 있으며, 같은 후보를 중복 선택할 수 없습니다.
        </p>
      </div>
      {RANKS.map((rank) => (
        <div key={rank.key} className='space-y-1'>
          <p className='text-sm font-medium'>{rank.label}</p>
          <Select
            value={selection[rank.key] ? String(selection[rank.key]) : ''}
            onValueChange={(value) => {
              setSelection((prev) => ({
                ...prev,
                [rank.key]: Number(value)
              }));
            }}
            disabled={!canVote}
          >
            <SelectTrigger>
              <SelectValue placeholder='후보를 선택해 주세요.' />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.id} value={String(candidate.id)}>
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {!canVote ? <p className='text-muted-foreground text-sm'>현재 투표 기간이 아닙니다.</p> : null}
      {hasDuplicate ? (
        <p className='text-destructive text-sm'>1·2·3순위는 서로 다른 후보를 선택해야 합니다.</p>
      ) : null}
      {!isComplete ? (
        <p className='text-muted-foreground text-sm'>정확히 3개의 후보를 모두 선택해 주세요.</p>
      ) : null}

      <Button
        className='w-full sm:w-auto'
        disabled={!canSubmit}
        isLoading={voteMutation.isPending}
        onClick={async () => {
          if (!canSubmit) return;
          await voteMutation.mutateAsync({
            sessionId,
            payload: {
              rank1_candidate_id: selection.rank1!,
              rank2_candidate_id: selection.rank2!,
              rank3_candidate_id: selection.rank3!
            }
          });
        }}
      >
        투표 제출
      </Button>
    </>
  );

  if (variant === 'plain') {
    return <div className='space-y-4'>{panelInner}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{myVote ? '내 투표' : '3순위 투표'}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {panelInner}
      </CardContent>
    </Card>
  );
}
