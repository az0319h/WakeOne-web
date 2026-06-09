'use client';

import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavAccess } from '@/contexts/nav-access';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { officeSnackSessionsQueryOptions } from '../api/queries';
import { SessionFormSheet } from './session-form-sheet';
import { SessionsListSections } from './sessions-list-sections';

export function OfficeSnacksListClient() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const { data: sessions } = useSuspenseQuery(officeSnackSessionsQueryOptions());

  return (
    <>
      {isAdmin ? (
        <div className='mb-4 flex justify-end'>
          <Button onClick={() => setSessionSheetOpen(true)}>
            <Icons.add className='mr-2 h-4 w-4' />
            회차 생성
          </Button>
        </div>
      ) : null}
      <SessionsListSections sessions={sessions} onCreateSession={() => setSessionSheetOpen(true)} />

      <SessionFormSheet open={sessionSheetOpen} onOpenChange={setSessionSheetOpen} />
    </>
  );
}
