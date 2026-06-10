'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavAccess } from '@/contexts/nav-access';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import { deleteOfficeSnackSessionMutation } from '../api/mutations';
import type { OfficeSnackSession } from '../api/types';
import { canAdminDeleteOfficeSnackSession } from './office-snack-utils';
import { SessionTransferRow } from './session-transfer-row';

interface SessionsListSectionsProps {
  sessions: OfficeSnackSession[];
  onCreateSession?: () => void;
}

type SessionTab = 'ongoing' | 'upcoming' | 'history';

const TAB_CONFIG: { value: SessionTab; label: string }[] = [
  { value: 'ongoing', label: '진행중' },
  { value: 'upcoming', label: '예정' },
  { value: 'history', label: '히스토리' }
];

const EMPTY_MESSAGES: Record<SessionTab, string> = {
  ongoing: '진행 중인 회차가 없습니다.',
  upcoming: '예정된 회차가 없습니다.',
  history: '종료된 회차가 없습니다.'
};

function SessionListPanel({
  sessions,
  tab,
  isAdmin,
  onCreateSession,
  onDeleteSession,
  deletingSessionId
}: {
  sessions: OfficeSnackSession[];
  tab: SessionTab;
  isAdmin: boolean;
  onCreateSession?: () => void;
  onDeleteSession?: (session: OfficeSnackSession) => void;
  deletingSessionId?: number | null;
}) {
  if (sessions.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center'>
        <p className='text-muted-foreground text-sm'>{EMPTY_MESSAGES[tab]}</p>
        {tab === 'ongoing' && isAdmin && onCreateSession ? (
          <>
            <p className='text-muted-foreground text-xs'>
              회차를 생성해 간식 등록과 투표를 시작하세요.
            </p>
            <Button type='button' size='sm' onClick={onCreateSession}>
              <Icons.add className='mr-2 h-4 w-4' />
              회차 생성
            </Button>
          </>
        ) : null}
        {tab === 'ongoing' && !isAdmin ? (
          <p className='text-muted-foreground text-xs'>
            관리자가 회차를 생성하면 등록과 투표에 참여할 수 있습니다.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Card className='overflow-hidden py-0'>
      <div className='divide-y'>
        {sessions.map((session) => (
          <SessionTransferRow
            key={session.id}
            session={session}
            isAdmin={isAdmin}
            isDeleting={deletingSessionId === session.id}
            onDelete={
              isAdmin && canAdminDeleteOfficeSnackSession(session.state)
                ? onDeleteSession
                : undefined
            }
          />
        ))}
      </div>
    </Card>
  );
}

export function SessionsListSections({ sessions, onCreateSession }: SessionsListSectionsProps) {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';
  const [sessionToDelete, setSessionToDelete] = useState<OfficeSnackSession | null>(null);

  const deleteMutation = useMutation({
    ...deleteOfficeSnackSessionMutation,
    onSuccess: () => {
      notifySuccess('회차를 삭제했습니다.');
      setSessionToDelete(null);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '회차 삭제에 실패했습니다.');
    }
  });

  const grouped = useMemo(() => {
    return {
      ongoing: sessions.filter(
        (session) => session.state === 'registration' || session.state === 'voting'
      ),
      upcoming: sessions.filter((session) => session.state === 'upcoming'),
      history: sessions.filter((session) => session.state === 'closed')
    };
  }, [sessions]);

  const defaultTab: SessionTab =
    grouped.ongoing.length > 0
      ? 'ongoing'
      : grouped.upcoming.length > 0
        ? 'upcoming'
        : 'history';

  function handleDeleteSession(session: OfficeSnackSession) {
    setSessionToDelete(session);
  }

  return (
    <>
      <AlertModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={() => {
          if (sessionToDelete) {
            deleteMutation.mutate(sessionToDelete.id);
          }
        }}
        loading={deleteMutation.isPending}
        title='회차를 삭제할까요?'
        description={
          sessionToDelete
            ? `"${sessionToDelete.title}" 회차와 등록된 후보·투표가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
            : '이 작업은 되돌릴 수 없습니다.'
        }
        confirmLabel='삭제'
        cancelLabel='취소'
      />
    <Tabs defaultValue={defaultTab} className='w-full gap-4'>
      <TabsList
        className='flex h-10 w-full justify-start gap-1 rounded-xl p-1'
        aria-label='회차 상태 필터'
      >
        {TAB_CONFIG.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className='h-auto flex-none shrink-0 rounded-lg px-3 py-1.5 text-sm'
          >
            {tab.label}
            <span className='text-muted-foreground ml-1 text-xs'>({grouped[tab.value].length})</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {TAB_CONFIG.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className='mt-0'>
          <SessionListPanel
            sessions={grouped[tab.value]}
            tab={tab.value}
            isAdmin={isAdmin}
            onCreateSession={onCreateSession}
            onDeleteSession={handleDeleteSession}
            deletingSessionId={
              deleteMutation.isPending ? sessionToDelete?.id ?? null : null
            }
          />
        </TabsContent>
      ))}
    </Tabs>
    </>
  );
}
