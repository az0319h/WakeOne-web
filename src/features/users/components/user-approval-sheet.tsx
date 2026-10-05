'use client';

import { useAppForm } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { approveUserMutation } from '../api/mutations';
import {
  normalizeLeaderRole,
  SELECT_NONE_VALUE,
  type Affiliation
} from '../constants/organization';
import type { User } from '../api/types';
import {
  approveUserSchema,
  type ApproveUserFormValues
} from '../schemas/user';
import { UserApprovalOrgFormFields } from './user-org-form-fields';

interface UserApprovalSheetProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildApproveDefaultValues(user: User): ApproveUserFormValues {
  return {
    email: (user.google_email ?? user.email).trim().toLowerCase(),
    full_name: '',
    affiliation: '',
    rank: '',
    position_level: '',
    leader_role: SELECT_NONE_VALUE,
    system_role: '',
    birthday: null,
    phone: ''
  };
}

export function UserApprovalSheet({
  user,
  open,
  onOpenChange
}: UserApprovalSheetProps) {
  const approveMutation = useMutation({
    ...approveUserMutation,
    onSuccess: () => {
      notifySuccess('사용자가 승인되었습니다.');
      form.reset(buildApproveDefaultValues(user));
      onOpenChange(false);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '승인에 실패했습니다.';
      notifyError(message);
    }
  });

  const form = useAppForm({
    defaultValues: buildApproveDefaultValues(user),
    validators: {
      onSubmit: approveUserSchema
    },
    onSubmit: async ({ value }) => {
      if (value.system_role === 'admin') {
        await approveMutation.mutateAsync({
          id: user.id,
          values: {
            email: value.email.trim().toLowerCase(),
            full_name: value.full_name.trim(),
            phone: value.phone,
            system_role: 'admin',
            birthday: null
          }
        });
        return;
      }

      await approveMutation.mutateAsync({
        id: user.id,
        values: {
          email: value.email.trim().toLowerCase(),
          full_name: value.full_name.trim(),
          affiliation: value.affiliation as Affiliation,
          rank: value.rank?.trim() ?? '',
          position_level: value.position_level ?? '',
          leader_role: normalizeLeaderRole(value.leader_role),
          system_role: 'user',
          birthday: value.birthday ?? null,
          phone: value.phone
        }
      });
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col'>
        <SheetHeader>
          <SheetTitle>가입 요청 승인</SheetTitle>
          <SheetDescription>
            Google 계정 정보는 참고용입니다. WakeOne 업무 프로필을 확정한 뒤
            승인해 주세요.
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 space-y-6 overflow-auto'>
          <div className='bg-muted/40 space-y-2 rounded-lg border p-4 text-sm'>
            <p className='text-muted-foreground text-xs font-medium uppercase tracking-wide'>
              Google 참고 정보
            </p>
            <div className='grid gap-2 sm:grid-cols-2'>
              <div>
                <p className='text-muted-foreground text-xs'>Google 이메일</p>
                <p className='font-mono text-xs'>{user.google_email ?? '—'}</p>
              </div>
              <div>
                <p className='text-muted-foreground text-xs'>Google 표시 이름</p>
                <p>{user.google_display_name ?? '—'}</p>
              </div>
            </div>
            {user.approval_requested_at ? (
              <p className='text-muted-foreground text-xs'>
                요청 시각{' '}
                <span className='font-mono'>
                  {formatAbsoluteDateTimeKo(user.approval_requested_at)}
                </span>
              </p>
            ) : null}
          </div>

          <form.AppForm>
            <form.Form id='user-approval-sheet' className='space-y-4'>
              <UserApprovalOrgFormFields />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type='submit'
            form='user-approval-sheet'
            isLoading={approveMutation.isPending}
          >
            <Icons.check className='mr-2 h-4 w-4' />
            승인
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
