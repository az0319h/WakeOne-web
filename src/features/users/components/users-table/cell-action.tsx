'use client';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useNavAccess } from '@/contexts/nav-access';
import {
  deleteUserMutation,
  reactivateUserMutation,
  rejectUserMutation
} from '../../api/mutations';
import type { User } from '../../api/types';
import { Icons } from '@/components/icons';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifyError, notifySuccess } from '@/lib/notify';
import { UserFormSheet } from '../user-form-sheet';
import { UserApprovalSheet } from '../user-approval-sheet';

interface CellActionProps {
  data: User;
}

export function CellAction({ data }: CellActionProps) {
  const sessionProfile = useNavAccess();
  const currentUserId = sessionProfile?.user_id;
  const isSelf = currentUserId === data.id;
  const isPending = data.status === 'pending_approval';
  const isRejected = data.status === 'rejected';
  const isInactive = data.status === 'inactive';
  const isActive = data.status === 'active';
  const canEdit = isActive && !isSelf;
  const canDeactivate = isActive && !isSelf;
  const canReactivate = isInactive;

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  const deactivateMutation = useMutation({
    ...deleteUserMutation,
    onSuccess: (result) => {
      notifySuccess(result.message ?? '사용자가 비활성화되었습니다.');
      setDeactivateOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '비활성화에 실패했습니다.';
      notifyError(message);
    }
  });

  const reactivateMutation = useMutation({
    ...reactivateUserMutation,
    onSuccess: (result) => {
      notifySuccess(result.message ?? '사용자가 활성화되었습니다.');
      setReactivateOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '활성화에 실패했습니다.';
      notifyError(message);
    }
  });

  const rejectMutation = useMutation({
    ...rejectUserMutation,
    onSuccess: (result) => {
      notifySuccess(result.message ?? '가입 요청이 거절되었습니다.');
      setRejectOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '거절에 실패했습니다.';
      notifyError(message);
    }
  });

  if (isPending) {
    return (
      <>
        <AlertModal
          isOpen={rejectOpen}
          onClose={() => setRejectOpen(false)}
          onConfirm={() => rejectMutation.mutate({ id: data.id })}
          loading={rejectMutation.isPending}
          title='가입 요청을 거절할까요?'
          description={`${data.google_email ?? data.email} 계정의 가입 요청을 거절합니다. 이메일 알림은 발송되지 않습니다.`}
          confirmLabel='거절'
          cancelLabel='취소'
        />
        <UserApprovalSheet
          user={data}
          open={approveOpen}
          onOpenChange={setApproveOpen}
        />
        <div className='flex justify-end gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setRejectOpen(true)}
            disabled={rejectMutation.isPending}
          >
            거절
          </Button>
          <Button size='sm' onClick={() => setApproveOpen(true)}>
            수락
          </Button>
        </div>
      </>
    );
  }

  if (isRejected) {
    return null;
  }

  if (!canEdit && !canDeactivate && !canReactivate) {
    return null;
  }

  return (
    <>
      {canDeactivate ? (
        <AlertModal
          isOpen={deactivateOpen}
          onClose={() => setDeactivateOpen(false)}
          onConfirm={() => deactivateMutation.mutate(data.id)}
          loading={deactivateMutation.isPending}
          title='사용자를 비활성화할까요?'
          description='계정이 비활성화되며 즉시 로그아웃됩니다.'
          confirmLabel='비활성화'
          cancelLabel='취소'
        />
      ) : null}
      {canReactivate ? (
        <AlertModal
          isOpen={reactivateOpen}
          onClose={() => setReactivateOpen(false)}
          onConfirm={() => reactivateMutation.mutate(data.id)}
          loading={reactivateMutation.isPending}
          title='사용자를 활성화할까요?'
          description='계정이 다시 활성화됩니다. Google 로그인으로 접속할 수 있습니다.'
          confirmLabel='활성화'
          cancelLabel='취소'
        />
      ) : null}
      {canEdit ? (
        <UserFormSheet user={data} open={editOpen} onOpenChange={setEditOpen} />
      ) : null}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Open menu</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {canEdit ? (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Icons.edit className='mr-2 h-4 w-4' /> 수정
            </DropdownMenuItem>
          ) : null}
          {canDeactivate ? (
            <DropdownMenuItem onClick={() => setDeactivateOpen(true)}>
              <Icons.trash className='mr-2 h-4 w-4' /> 비활성화
            </DropdownMenuItem>
          ) : null}
          {canReactivate ? (
            <DropdownMenuItem onClick={() => setReactivateOpen(true)}>
              <Icons.userPen className='mr-2 h-4 w-4' /> 활성화
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
