'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  createOfficeSnackCandidateMutation,
  updateOfficeSnackCandidateMutation
} from '../api/mutations';
import type { OfficeSnackCandidate } from '../api/types';
import {
  officeSnackCandidateSchema,
  type OfficeSnackCandidateFormValues
} from '../schemas/office-snack';
import { formatWon, OFFICE_SNACK_PLACEHOLDER_IMAGE_URL } from './office-snack-utils';
import { CandidateProductImage } from './candidate-product-image';

interface CandidateFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  candidate?: OfficeSnackCandidate | null;
}

function buildDisplayUrl(productUrl: string): string {
  try {
    const parsed = new URL(productUrl);
    const path = parsed.pathname.length > 1 ? parsed.pathname : '';
    return `${parsed.hostname}${path}`;
  } catch {
    return productUrl;
  }
}

export function CandidateFormSheet({
  open,
  onOpenChange,
  sessionId,
  candidate
}: CandidateFormSheetProps) {
  const isEdit = !!candidate;
  const [apiError, setApiError] = useState<string | null>(null);

  const createMutation = useMutation({
    ...createOfficeSnackCandidateMutation,
    onSuccess: () => {
      notifySuccess('후보를 등록했습니다.');
      onOpenChange(false);
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '후보 등록에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const updateMutation = useMutation({
    ...updateOfficeSnackCandidateMutation,
    onSuccess: () => {
      notifySuccess('후보를 수정했습니다.');
      onOpenChange(false);
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '후보 수정에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const defaultValues = useMemo<OfficeSnackCandidateFormValues>(
    () => ({
      product_url: candidate?.product_url ?? '',
      name: candidate?.name ?? '',
      price: candidate?.price ?? 0,
      image_url: candidate?.image_url ?? ''
    }),
    [candidate]
  );

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: officeSnackCandidateSchema
    },
    onSubmit: async ({ value }) => {
      setApiError(null);
      const imageUrl = value.image_url.trim();
      const payload = {
        name: value.name.trim(),
        product_url: value.product_url.trim(),
        image_url: imageUrl.length > 0 ? imageUrl : null,
        price: value.price,
        source_type: 'manual' as const
      };

      if (isEdit && candidate) {
        await updateMutation.mutateAsync({ candidateId: candidate.id, payload });
        return;
      }

      await createMutation.mutateAsync({ sessionId, payload });
    }
  });

  const { FormTextField } = useFormFields<OfficeSnackCandidateFormValues>();
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '후보 수정' : '후보 등록'}</SheetTitle>
          <SheetDescription>
            쿠팡 상품 URL, 상품명, 가격을 직접 입력해 등록합니다. 이미지 URL은 선택 사항입니다.
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {apiError}
          </div>
        ) : null}

        <form.AppForm>
          <form.Form id='office-snack-candidate-form' className='flex h-full min-h-0 flex-col'>
            <div className='min-h-0 flex-1 space-y-4 overflow-auto py-2 pr-1'>
              <FormTextField
                name='product_url'
                label='상품 URL'
                required
                placeholder='https://www.coupang.com/vp/products/...'
              />
              <FormTextField name='name' label='상품명' required placeholder='상품명을 입력해 주세요.' />
              <FormTextField
                name='price'
                label='가격(원)'
                required
                type='number'
                min={1}
                step={1}
                placeholder='예: 12900'
              />
              <FormTextField
                name='image_url'
                label='이미지 URL'
                placeholder='https://... (선택)'
              />

              <form.Subscribe
                selector={(state) => state.values}
                children={(values) => {
                  const previewImage =
                    values.image_url.trim() || OFFICE_SNACK_PLACEHOLDER_IMAGE_URL;
                  const previewName = values.name.trim() || '상품명을 입력해 주세요.';
                  const previewPrice = values.price > 0 ? formatWon(values.price) : '가격을 입력해 주세요.';

                  return (
                    <Card>
                      <CardContent className='space-y-3 p-4'>
                        <p className='text-sm font-medium'>등록 미리보기</p>
                        <div className='max-w-[200px] overflow-hidden rounded-xl border bg-card shadow-sm'>
                          <CandidateProductImage src={previewImage} alt={previewName} />
                          <div className='space-y-1 p-3'>
                            <p className='line-clamp-2 text-sm font-medium leading-snug'>
                              {previewName}
                            </p>
                            <p className='text-sm font-semibold'>{previewPrice}</p>
                            <p className='text-muted-foreground truncate text-xs'>
                              {values.product_url.trim()
                                ? buildDisplayUrl(values.product_url.trim())
                                : '상품 URL을 입력하면 주소가 표시됩니다.'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }}
              />

              <div className='flex items-center justify-between rounded-md border p-3 text-sm'>
                <p className='text-muted-foreground'>가격 정책</p>
                <Badge variant='outline'>최대 {formatWon(50000)}</Badge>
              </div>
            </div>
          </form.Form>
        </form.AppForm>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type='submit' form='office-snack-candidate-form' isLoading={isPending}>
            <Icons.check className='mr-2 h-4 w-4' />
            {isEdit ? '저장' : '등록'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
