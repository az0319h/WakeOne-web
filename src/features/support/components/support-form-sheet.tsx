'use client';

import { useMutation } from '@tanstack/react-query';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useNavAccess } from '@/contexts/nav-access';
import { notifyError, notifySuccess } from '@/lib/notify';
import { createSupportRequestMutation } from '../api/mutations';
import {
  emptySupportFormValues,
  supportFormSchema,
  type SupportFormValues
} from '../schemas/support-form';

interface SupportFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportFormSheet({ open, onOpenChange }: SupportFormSheetProps) {
  const profile = useNavAccess();

  const createMutation = useMutation({
    ...createSupportRequestMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '문의가 접수되었습니다.');
      form.reset(emptySupportFormValues);
      onOpenChange(false);
    },
    onError: (error) => {
      notifyError(
        error instanceof Error ? error.message : '문의 등록에 실패했습니다.'
      );
    }
  });

  const { FormTextField, FormTextareaField } = useFormFields<SupportFormValues>();

  const form = useAppForm({
    defaultValues: emptySupportFormValues,
    validators: {
      onSubmit: supportFormSchema
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        title: value.title.trim(),
        body: value.body.trim()
      });
    }
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !createMutation.isPending) {
      onOpenChange(false);
    } else if (nextOpen) {
      onOpenChange(true);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='flex min-h-0 flex-col' data-testid='support-form-sheet'>
        <SheetHeader>
          <SheetTitle>문의하기</SheetTitle>
          <SheetDescription>
            문의 내용을 입력해 주세요. 접수 후 목록에서 진행 상태를 확인할 수 있습니다.
          </SheetDescription>
        </SheetHeader>

        <form.AppForm>
          <form.Form className='flex min-h-0 flex-1 flex-col'>
            <div className='min-h-0 flex-1 space-y-4 overflow-auto py-4 pr-1'>
              <div className='space-y-2'>
                <Label htmlFor='support-form-name'>이름</Label>
                <Input
                  id='support-form-name'
                  value={profile?.full_name ?? ''}
                  disabled
                  readOnly
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='support-form-email'>이메일</Label>
                <Input
                  id='support-form-email'
                  value={profile?.email ?? ''}
                  disabled
                  readOnly
                />
              </div>
              <FormTextField
                name='title'
                label='제목'
                required
                placeholder='문의 제목 (2자 이상)'
              />
              <FormTextareaField
                name='body'
                label='본문'
                required
                rows={8}
                placeholder='문의 내용을 입력하세요. (10자 이상)'
              />
            </div>

            <SheetFooter className='gap-2 border-t pt-4'>
              <Button
                type='button'
                variant='outline'
                disabled={createMutation.isPending}
                onClick={() => handleOpenChange(false)}
              >
                취소
              </Button>
              <Button type='submit' isLoading={createMutation.isPending}>
                저장
              </Button>
            </SheetFooter>
          </form.Form>
        </form.AppForm>
      </SheetContent>
    </Sheet>
  );
}
