'use client';

import { useMemo, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavAccess } from '@/contexts/nav-access';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { officeSnackSessionDetailQueryOptions } from '../api/queries';
import { CandidatesSection } from './candidates-section';
import { ClosedResultTable } from './closed-result-table';
import { SessionFormSheet } from './session-form-sheet';
import { OfficeSnackInfoSheet } from './office-snack-info-sheet';
import { OfficeSnackVoteSheet } from './office-snack-vote-sheet';
import {
  getSessionPeriodEndDescription,
  getSessionPeriodStartDescription,
  getSessionStateLabel
} from './office-snack-utils';

interface OfficeSnackDetailClientProps {
  sessionId: number;
}

export function OfficeSnackDetailClient({ sessionId }: OfficeSnackDetailClientProps) {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';
  const [sessionEditOpen, setSessionEditOpen] = useState(false);
  const [sessionInfoOpen, setSessionInfoOpen] = useState(false);
  const [voteSheetOpen, setVoteSheetOpen] = useState(false);
  const { data } = useSuspenseQuery(officeSnackSessionDetailQueryOptions(sessionId));

  const sessionDescription = data.session.description?.trim();
  const periodStartDescription = getSessionPeriodStartDescription(data.session);
  const periodEndDescription = getSessionPeriodEndDescription(data.session);
  const showPeriodEndLine =
    !!sessionDescription || data.session.state === 'upcoming' || data.session.state === 'registration' || data.session.state === 'voting';

  const voteButtonConfig = (() => {
    if (data.session.state === 'upcoming') {
      return { label: '투표 시작 전', disabled: true };
    }
    if (data.session.state === 'registration') {
      return { label: '등록 진행 중', disabled: true };
    }
    if (data.session.state === 'closed') {
      return { label: '투표 종료', disabled: true };
    }
    if (data.my_vote) {
      return { label: '투표 완료', disabled: true };
    }
    return { label: '투표하기', disabled: false };
  })();

  const myVoteSummary = useMemo(() => {
    if (!data.my_vote) {
      return null;
    }

    const candidateNameById = new Map(
      data.candidates.map((candidate) => [candidate.id, candidate.name])
    );

    return [
      { label: '1순위', candidateId: data.my_vote.rank1_candidate_id },
      { label: '2순위', candidateId: data.my_vote.rank2_candidate_id },
      { label: '3순위', candidateId: data.my_vote.rank3_candidate_id }
    ].map((item) => ({
      ...item,
      name: candidateNameById.get(item.candidateId) ?? `#${item.candidateId}`
    }));
  }, [data.candidates, data.my_vote]);

  return (
    <div className='space-y-6'>
      <Card className='rounded-2xl border-border/60 shadow-sm'>
        <CardHeader className='space-y-4 pb-3'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='space-y-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 className='text-xl font-semibold tracking-tight'>{data.session.title}</h2>
                <Badge variant='outline'>{getSessionStateLabel(data.session.state)}</Badge>
              </div>
              <p className='text-muted-foreground text-sm'>
                {sessionDescription || periodStartDescription}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={() => setSessionInfoOpen(true)}
                aria-label='회차 정보 보기'
              >
                <Icons.info className='h-4 w-4' />
              </Button>
              <Button
                type='button'
                onClick={() => setVoteSheetOpen(true)}
                disabled={voteButtonConfig.disabled}
              >
                {voteButtonConfig.label}
              </Button>
              {isAdmin ? (
                <Button type='button' variant='outline' onClick={() => setSessionEditOpen(true)}>
                  <Icons.edit className='mr-2 h-4 w-4' />
                  회차 수정
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        {showPeriodEndLine ? (
          <CardContent className='pt-0'>
            <p className='text-muted-foreground text-sm'>{periodEndDescription}</p>
          </CardContent>
        ) : null}
      </Card>

      <CandidatesSection
        sessionId={sessionId}
        sessionState={data.session.state}
        candidates={data.candidates}
        myCandidate={data.my_candidate}
      />

      {myVoteSummary ? (
        <Card className='border-border/60 shadow-sm'>
          <CardHeader className='pb-3'>
            <div className='space-y-1'>
              <h3 className='text-base font-semibold'>내 투표 내역</h3>
              <p className='text-muted-foreground text-sm'>
                제출한 투표는 수정할 수 없으며, 아래 순위로 집계됩니다.
              </p>
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <div className='flex flex-wrap gap-2'>
              {myVoteSummary.map((item) => (
                <Badge key={item.label} variant='outline'>
                  {item.label} {item.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.session.state === 'closed' ? <ClosedResultTable results={data.results} /> : null}

      <SessionFormSheet
        open={sessionEditOpen}
        onOpenChange={setSessionEditOpen}
        session={data.session}
      />
      <OfficeSnackInfoSheet
        open={sessionInfoOpen}
        onOpenChange={setSessionInfoOpen}
        session={data.session}
      />
      <OfficeSnackVoteSheet
        open={voteSheetOpen}
        onOpenChange={setVoteSheetOpen}
        sessionId={sessionId}
        candidates={data.candidates}
        myVote={data.my_vote}
        canVote={data.session.state === 'voting'}
      />
    </div>
  );
}
