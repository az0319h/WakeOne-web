'use client';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { OfficeSnackCandidate, OfficeSnackVote } from '../api/types';
import { VoteRankPanel } from './vote-rank-panel';

interface OfficeSnackVoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  candidates: OfficeSnackCandidate[];
  myVote: OfficeSnackVote | null;
  canVote: boolean;
}

export function OfficeSnackVoteSheet({
  open,
  onOpenChange,
  sessionId,
  candidates,
  myVote,
  canVote
}: OfficeSnackVoteSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>투표하기</SheetTitle>
          <SheetDescription>회차당 1회 투표할 수 있으며, 제출 후 재투표는 불가능합니다.</SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-auto py-2 pr-1'>
          <VoteRankPanel
            sessionId={sessionId}
            candidates={candidates}
            myVote={myVote}
            canVote={canVote}
            variant='plain'
          />
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
