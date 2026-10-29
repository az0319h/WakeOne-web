'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { removeQuickRequestParticipantMutation } from '../../api/mutations';
import type { QuickRequestChatViewer, QuickRequestParticipant } from '../../api/types';
import {
  QUICK_CHAT_AUTHOR_ROLES,
  QUICK_CHAT_ROLE_LABELS,
  type QuickChatAuthorRole
} from '../../schemas/quick-request-chat';
import { QUICK_CHAT_PARTICIPANT_MESSAGES } from '../../schemas/quick-request-participant';
import { QuickChatAddParticipant, type QuickChatParticipantsLayout } from './quick-chat-add-participant';
import { quickChatInitial } from './quick-chat-bubble';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';

type PanelMode = 'list' | 'add';

type QuickChatParticipantsPanelProps = {
  requestNo: string;
  layout: QuickChatParticipantsLayout;
  participants: readonly QuickRequestParticipant[];
  viewer: QuickRequestChatViewer;
  /** 제외 ✕ — 부모가 패널을 닫고 `AlertModal`을 띄운다 (Popover 밖 Dialog 포커스로 패널이 닫히는 문제 회피) */
  onRequestRemove: (participant: QuickRequestParticipant) => void;
  /** 본인 「나가기」 */
  onRequestLeave: () => void;
};

/** 섹션 순서: 요청자 → 동방특송 → 관리자 → 참여자 (비면 숨김 · U-2) */
function groupByRole(participants: readonly QuickRequestParticipant[]) {
  const groups = new Map<QuickChatAuthorRole, QuickRequestParticipant[]>();
  for (const role of QUICK_CHAT_AUTHOR_ROLES) groups.set(role, []);
  for (const participant of participants) {
    groups.get(participant.role)?.push(participant);
  }
  return QUICK_CHAT_AUTHOR_ROLES.map((role) => ({ role, members: groups.get(role) ?? [] })).filter(
    (group) => group.members.length > 0
  );
}

/**
 * plan 101 U-2 · U-3 · designer §1 — 참여자 목록(섹션 4 · 역할 Badge · 「초대: {이름} · 시각」 · 제외 ✕ · 본인 「나가기」)
 * + mode 'add'(`QuickChatAddParticipant`). Popover·Drawer 공용 본문 — Drawer 헤더·푸터는 호출자(`QuickChatParticipantsButton`).
 */
export function QuickChatParticipantsPanel({
  requestNo,
  layout,
  participants,
  viewer,
  onRequestRemove,
  onRequestLeave
}: QuickChatParticipantsPanelProps) {
  const [mode, setMode] = useState<PanelMode>('list');
  const canInvite = viewer.canManageParticipants;
  const isDrawer = layout === 'drawer';
  const groups = groupByRole(participants);

  return (
    <div
      data-testid='quick-chat-participants-panel'
      data-mode={mode}
      className='flex min-h-0 flex-1 flex-col'
    >
      {mode === 'add' ? (
        <QuickChatAddParticipant
          requestNo={requestNo}
          layout={layout}
          onBack={() => setMode('list')}
          onInvited={() => setMode('list')}
        />
      ) : (
        <>
          {isDrawer ? (
            canInvite ? (
              <div className='px-4 pb-2'>
                <Button
                  type='button'
                  variant='outline'
                  className='h-11 w-full'
                  data-testid='quick-chat-add-participant'
                  onClick={() => setMode('add')}
                >
                  <Icons.add aria-hidden />
                  {QUICK_CHAT_TEXT.addParticipant}
                </Button>
              </div>
            ) : null
          ) : (
            <div className='flex items-center justify-between gap-2 px-3 py-2'>
              <h3 className='text-sm font-semibold'>{quickChatText.participantsLabel(participants.length)}</h3>
              {canInvite ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-9'
                  data-testid='quick-chat-add-participant'
                  onClick={() => setMode('add')}
                >
                  <Icons.add aria-hidden />
                  {QUICK_CHAT_TEXT.addParticipant}
                </Button>
              ) : null}
            </div>
          )}
          <div
            className={cn(
              'min-h-0 overflow-y-auto overscroll-contain',
              isDrawer ? 'flex-1 border-t px-4' : 'max-h-[60dvh] border-t'
            )}
          >
            <ul aria-label={QUICK_CHAT_TEXT.participantsListAriaLabel} className='pb-2'>
              {groups.map((group) => (
                <ParticipantSection
                  key={group.role}
                  role={group.role}
                  members={group.members}
                  viewer={viewer}
                  canInvite={canInvite}
                  isDrawer={isDrawer}
                  onRequestRemove={onRequestRemove}
                  onRequestLeave={onRequestLeave}
                />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

type ParticipantSectionProps = {
  role: QuickChatAuthorRole;
  members: readonly QuickRequestParticipant[];
  viewer: QuickRequestChatViewer;
  canInvite: boolean;
  isDrawer: boolean;
  onRequestRemove: (participant: QuickRequestParticipant) => void;
  onRequestLeave: () => void;
};

function ParticipantSection({
  role,
  members,
  viewer,
  canInvite,
  isDrawer,
  onRequestRemove,
  onRequestLeave
}: ParticipantSectionProps) {
  return (
    <>
      <li
        role='presentation'
        className={cn(
          'pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase',
          isDrawer ? 'px-0' : 'px-3'
        )}
      >
        {QUICK_CHAT_ROLE_LABELS[role]}
      </li>
      {members.map((participant) => {
        const isMe = participant.userId === viewer.userId;
        const showLeave = isMe && viewer.role === 'participant';
        const showRemove = !showLeave && participant.role === 'participant' && canInvite;
        return (
          <li
            key={participant.userId}
            data-testid={`quick-chat-participant-${participant.userId}`}
            data-role={participant.role}
            className={cn('flex min-h-11 items-center gap-2 py-1', isDrawer ? 'px-0' : 'px-3')}
          >
            <Avatar className='size-7 shrink-0'>
              <AvatarFallback className='bg-primary/10 text-xs font-medium text-primary'>
                {quickChatInitial(participant.name)}
              </AvatarFallback>
            </Avatar>
            <div className='flex min-w-0 flex-1 flex-col'>
              <div className='flex min-w-0 items-center gap-1.5'>
                <span className='truncate text-sm'>
                  {participant.name}
                  {isMe ? <span className='ml-1 text-muted-foreground'>{QUICK_CHAT_TEXT.me}</span> : null}
                </span>
                <Badge variant='secondary' className='shrink-0 font-normal'>
                  {QUICK_CHAT_ROLE_LABELS[participant.role]}
                </Badge>
              </div>
              {participant.role === 'participant' && participant.invitedBy && participant.invitedAt ? (
                <span className='truncate text-xs text-muted-foreground tabular-nums'>
                  {quickChatText.invitedBy(participant.invitedBy.name, formatAbsoluteDateTimeKo(participant.invitedAt))}
                </span>
              ) : null}
            </div>
            {/* trailing — 고정 폭으로 정렬 유지 (권한 없으면 비워 둔다) */}
            <div className={cn('flex shrink-0 items-center justify-end', isDrawer ? 'min-w-11' : 'min-w-9')}>
              {showRemove ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className={cn('text-muted-foreground hover:text-destructive', isDrawer ? 'size-11' : 'size-9')}
                  aria-label={quickChatText.removeAria(participant.name)}
                  data-testid={`quick-chat-participant-remove-${participant.userId}`}
                  onClick={() => onRequestRemove(participant)}
                >
                  <Icons.close aria-hidden />
                </Button>
              ) : null}
              {showLeave ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className={cn('text-muted-foreground', isDrawer ? 'h-11' : 'h-9')}
                  data-testid='quick-chat-participant-leave'
                  onClick={onRequestLeave}
                >
                  <Icons.logout aria-hidden />
                  {QUICK_CHAT_TEXT.leave}
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// 제외 · 나가기 확인 (plan 14 · U-4) — AlertModal 2종 + `removeQuickRequestParticipantMutation`
// ---------------------------------------------------------------------------

export type QuickChatParticipantConfirmTarget =
  | { kind: 'remove'; participant: QuickRequestParticipant }
  | { kind: 'leave' }
  | null;

type QuickChatParticipantConfirmProps = {
  requestNo: string;
  viewer: QuickRequestChatViewer;
  target: QuickChatParticipantConfirmTarget;
  onClose: () => void;
  /** 본인 나가기 200 뒤 — 그 건은 404가 되므로 호출자가 목록으로 이동한다 */
  onLeft: () => void;
};

export function QuickChatParticipantConfirm({
  requestNo,
  viewer,
  target,
  onClose,
  onLeft
}: QuickChatParticipantConfirmProps) {
  const remove = useMutation({
    ...removeQuickRequestParticipantMutation,
    onSuccess: (data, variables) => {
      onClose();
      if (data.self) {
        notifySuccess(quickChatText.left());
        onLeft();
        return;
      }
      const name =
        target?.kind === 'remove' && target.participant.userId === variables.userId
          ? target.participant.name
          : null;
      if (name) notifySuccess(quickChatText.removed(name));
    },
    onError: (error) => {
      notifyError(
        error instanceof Error && error.message ? error.message : QUICK_CHAT_PARTICIPANT_MESSAGES.removeFailed
      );
    }
  });

  const isRemove = target?.kind === 'remove';
  const isLeave = target?.kind === 'leave';

  return (
    <>
      <AlertModal
        isOpen={isRemove}
        onClose={onClose}
        loading={remove.isPending}
        title={QUICK_CHAT_TEXT.removeTitle}
        description={isRemove ? quickChatText.removeDescription(target.participant.name) : ''}
        confirmLabel={QUICK_CHAT_TEXT.removeConfirm}
        cancelLabel={QUICK_CHAT_TEXT.cancel}
        onConfirm={() => {
          if (!isRemove) return;
          remove.mutate({ requestNo, userId: target.participant.userId });
        }}
      />
      <AlertModal
        isOpen={isLeave}
        onClose={onClose}
        loading={remove.isPending}
        title={QUICK_CHAT_TEXT.leaveTitle}
        description={QUICK_CHAT_TEXT.leaveDescription}
        confirmLabel={QUICK_CHAT_TEXT.leaveConfirm}
        cancelLabel={QUICK_CHAT_TEXT.cancel}
        onConfirm={() => {
          if (!isLeave) return;
          remove.mutate({ requestNo, userId: viewer.userId });
        }}
      />
    </>
  );
}
