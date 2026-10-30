'use client';

import { useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FormField,
  FormFieldError,
  FormFieldSet,
  scrollToFirstError,
  useAppForm,
  useFieldContext
} from '@/components/ui/tanstack-form';
import { ledgerFormFields } from '@/features/asset-ledger/components/asset-form-fields';
import {
  LedgerDialogBody,
  LedgerDialogFooter,
  LedgerDialogHeader,
  LedgerDialogTitle
} from '@/features/asset-ledger/components/asset-ledger-dialog-frame';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { createAssetRequestMutation, updateAssetRequestMutation } from '../api/mutations';
import {
  ASSET_REQUEST_BODY_MAX,
  requestTypeLabel,
  requestTypesFor,
  type AssetRequestDetail,
  type AssetRequestType,
  type AssetTargetType
} from '../api/types';
import { assetRequestFormSchema, type AssetRequestFormValues } from '../schemas/asset-request';

const BODY_PLACEHOLDER: Record<AssetTargetType, string> = {
  equipment: '무슨 일이 있는지 적어 주세요. 예) 화면에 줄이 생겨요.',
  subscription: '무엇을 바꾸거나 해지할지 적어 주세요. 예) 다음 달부터 안 써요.'
};

const EMPTY_VALUES: AssetRequestFormValues = { request_type: '', body: '' };

const { LedgerTextareaField: TypedTextarea } = ledgerFormFields<AssetRequestFormValues>();

type RequestTypeFieldProps = { targetType: AssetTargetType };

/** 종류 RadioGroup — 항목별 testid(`asset-request-type-{code}`)가 필요해 직접 렌더 (designer §14-17) */
function RequestTypeField({ targetType }: RequestTypeFieldProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (state) => state.value) as string) ?? '';
  const isValid = useStore(field.store, (state) => state.meta.isValid);
  const legendId = `${field.formItemId}-legend`;

  return (
    <FormFieldSet>
      <FormField>
        <div id={legendId} className='text-sm leading-snug font-medium'>
          종류 *
        </div>
        <RadioGroup
          value={value}
          aria-labelledby={legendId}
          aria-required
          aria-invalid={!isValid}
          onValueChange={(next) => {
            field.handleChange(next);
            field.handleBlur();
          }}
          className='grid grid-cols-2 gap-2 sm:grid-cols-3'
        >
          {requestTypesFor(targetType).map((code) => {
            const id = `${field.formItemId}-${code}`;
            return (
              <Label
                key={code}
                htmlFor={id}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-normal text-foreground',
                  'has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent'
                )}
              >
                <RadioGroupItem id={id} value={code} data-testid={`asset-request-type-${code}`} />
                {requestTypeLabel(targetType, code)}
              </Label>
            );
          })}
        </RadioGroup>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

type UseRequestFormOptions = {
  targetType: AssetTargetType;
  defaultValues: AssetRequestFormValues;
  submit: (values: { request_type: AssetRequestType; body: string }) => Promise<boolean>;
};

function useRequestForm({ targetType, defaultValues, submit }: UseRequestFormOptions) {
  return useAppForm({
    defaultValues,
    validators: { onSubmit: assetRequestFormSchema(targetType) },
    onSubmitInvalid: () => scrollToFirstError(),
    onSubmit: async ({ value, formApi }) => {
      const ok = await submit({
        request_type: value.request_type as AssetRequestType,
        body: value.body.trim()
      });
      // 서버 전송 성공 시에만 reset (실패 시 입력 유지)
      if (ok) formApi.reset();
    }
  });
}

type RequestFormFieldsProps = {
  targetType: AssetTargetType;
  form: ReturnType<typeof useRequestForm>;
  formId: string;
  'data-testid'?: string;
  autoFocusBody?: boolean;
};

function RequestFormFields({ targetType, form, formId, autoFocusBody, ...rest }: RequestFormFieldsProps) {
  return (
    <form.AppForm>
      <form.Form id={formId} data-testid={rest['data-testid']} className='flex w-full flex-col gap-5'>
        <form.AppField name='request_type'>{() => <RequestTypeField targetType={targetType} />}</form.AppField>
        <TypedTextarea
          name='body'
          label='내용'
          required
          rows={6}
          maxLength={ASSET_REQUEST_BODY_MAX}
          showCount
          autoFocus={autoFocusBody}
          placeholder={BODY_PLACEHOLDER[targetType]}
          data-testid='asset-request-body'
        />
      </form.Form>
    </form.AppForm>
  );
}

type AssetRequestComposeScreenProps = {
  targetType: AssetTargetType;
  targetId: number;
  /** 대상 이름 「N-012 · MacBook Air 13」 */
  targetLabel: string;
  onDone: () => void;
  onCancel: () => void;
};

const COMPOSE_FORM_ID = 'asset-request-form';

/** Dialog 화면 2 — 요청 폼 (designer §2-5-2) · 제출 버튼은 미리 비활성화하지 않는다(누르면 인라인 오류 + 첫 오류 칸 포커스) */
export function AssetRequestComposeScreen({
  targetType,
  targetId,
  targetLabel,
  onDone,
  onCancel
}: AssetRequestComposeScreenProps) {
  const mutation = useMutation({
    ...createAssetRequestMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '요청을 보냈어요.');
      onDone();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '요청을 보내지 못했어요.');
    }
  });

  const form = useRequestForm({
    targetType,
    defaultValues: EMPTY_VALUES,
    submit: async (values) => {
      try {
        await mutation.mutateAsync({ target_type: targetType, target_id: targetId, ...values });
        return true;
      } catch {
        return false;
      }
    }
  });

  return (
    <>
      <LedgerDialogHeader>
        <div className='min-w-0 flex-1 space-y-1'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='-ml-2 h-9'
            data-testid='asset-request-form-back'
            onClick={onCancel}
          >
            <Icons.chevronLeft aria-hidden />
            돌아가기
          </Button>
          <LedgerDialogTitle>요청하기</LedgerDialogTitle>
          <DialogDescription className='text-sm text-muted-foreground' translate='no'>
            {targetLabel}
          </DialogDescription>
        </div>
      </LedgerDialogHeader>
      <LedgerDialogBody>
        <RequestFormFields
          targetType={targetType}
          form={form}
          formId={COMPOSE_FORM_ID}
          data-testid='asset-request-form'
        />
      </LedgerDialogBody>
      <LedgerDialogFooter className='flex justify-end gap-2'>
        <Button
          type='button'
          variant='outline'
          className='h-11 md:h-9'
          data-testid='asset-request-form-cancel'
          onClick={onCancel}
        >
          취소
        </Button>
        <Button
          type='submit'
          form={COMPOSE_FORM_ID}
          className='h-11 md:h-9'
          data-testid='asset-request-submit'
          isLoading={mutation.isPending}
        >
          <Icons.send aria-hidden />
          등록
        </Button>
      </LedgerDialogFooter>
    </>
  );
}

type AssetRequestEditFormProps = {
  targetType: AssetTargetType;
  request: AssetRequestDetail;
  onDone: () => void;
  onCancel: () => void;
};

const EDIT_FORM_ID = 'asset-request-edit-form';

/** 요청 화면 안 인라인 수정 (요청자 + 접수대기) — 성공 시 최신 값으로 reset 후 카드로 돌아감 */
export function AssetRequestEditForm({ targetType, request, onDone, onCancel }: AssetRequestEditFormProps) {
  const mutation = useMutation({
    ...updateAssetRequestMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '요청을 수정했어요.');
      onDone();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '요청을 수정하지 못했어요.');
    }
  });

  const form = useRequestForm({
    targetType,
    defaultValues: { request_type: request.request_type, body: request.body },
    submit: async (values) => {
      try {
        await mutation.mutateAsync({ id: request.id, payload: values });
        return true;
      } catch {
        return false;
      }
    }
  });

  return (
    <div className='space-y-3 rounded-lg border p-4'>
      <RequestFormFields targetType={targetType} form={form} formId={EDIT_FORM_ID} autoFocusBody />
      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' size='sm' className='h-11 md:h-9' onClick={onCancel}>
          취소
        </Button>
        <Button
          type='submit'
          form={EDIT_FORM_ID}
          size='sm'
          className='h-11 md:h-9'
          data-testid='asset-request-submit'
          isLoading={mutation.isPending}
        >
          저장
        </Button>
      </div>
    </div>
  );
}
