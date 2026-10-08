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
import { notifyError, notifySuccess } from '@/lib/notify';
import { createUserMutation } from '../api/mutations';
import {
  normalizeLeaderRole,
  SELECT_NONE_VALUE,
  type Affiliation
} from '../constants/organization';
import {
  approveUserSchema,
  type ApproveUserFormValues
} from '../schemas/user';
import { UserApprovalOrgFormFields } from './user-org-form-fields';

const EMPTY_DEFAULT_VALUES: ApproveUserFormValues = {
  email: '',
  full_name: '',
  affiliation: '',
  rank: '',
  position_level: '',
  leader_role: SELECT_NONE_VALUE,
  system_role: '',
  birthday: null,
  phone: ''
};

interface UserProvisionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProvisionSheet({
  open,
  onOpenChange
}: UserProvisionSheetProps) {
  const createMutation = useMutation({
    ...createUserMutation,
    onSuccess: () => {
      notifySuccess('사용자가 추가되었습니다.');
      form.reset(EMPTY_DEFAULT_VALUES);
      onOpenChange(false);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '사용자 추가에 실패했습니다.';
      notifyError(message);
    }
  });

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULT_VALUES,
    validators: {
      onSubmit: approveUserSchema
    },
    onSubmit: async ({ value }) => {
      if (value.system_role === 'admin') {
        await createMutation.mutateAsync({
          email: value.email.trim().toLowerCase(),
          full_name: value.full_name.trim(),
          phone: value.phone,
          system_role: 'admin',
          birthday: null
        });
        return;
      }

      await createMutation.mutateAsync({
        email: value.email.trim().toLowerCase(),
        full_name: value.full_name.trim(),
        affiliation: value.affiliation as Affiliation,
        rank: value.rank?.trim() ?? '',
        position_level: value.position_level ?? '',
        leader_role: normalizeLeaderRole(value.leader_role),
        system_role: 'user',
        birthday: value.birthday ?? null,
        phone: value.phone
      });
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col'>
        <SheetHeader>
          <SheetTitle>사용자 추가</SheetTitle>
          <SheetDescription>
            등록한 이메일로 Google 로그인하면 바로 대시보드에 접속할 수 있습니다.
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 space-y-6 overflow-auto'>
          <form.AppForm>
            <form.Form id='user-provision-sheet' className='space-y-4'>
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
            form='user-provision-sheet'
            isLoading={createMutation.isPending}
            data-testid='user-provision-submit'
          >
            <Icons.add className='mr-2 h-4 w-4' />
            추가
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
