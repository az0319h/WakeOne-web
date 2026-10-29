'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import {
  FormField,
  FormFieldError,
  FormFieldSet,
  scrollToFirstError,
  useAppForm,
  useFieldContext,
  useFormFields
} from '@/components/ui/tanstack-form';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import {
  ledgerFormFields,
  setServerFieldError
} from '@/features/asset-ledger/components/asset-form-fields';
import {
  AssetLedgerErrorAlert,
  AssetLedgerQueryBoundary
} from '@/features/asset-ledger/components/asset-ledger-query-boundary';
import { useAssetLedgerSheet } from '@/features/asset-ledger/components/asset-ledger-sheet-context';
import {
  AssigneePicker,
  assigneePickFromView,
  type AssigneePick
} from '@/features/asset-ledger/components/assignee-picker';
import { ASSET_FIELD_MESSAGES } from '@/features/asset-ledger/schemas/fields';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';
import { SECRET_LIKE_MESSAGE } from '@/lib/secret-like-pattern';
import { createEquipmentMutation, updateEquipmentMutation } from '../api/mutations';
import { equipmentDetailQueryOptions, nextAssetNoQueryOptions } from '../api/queries';
import {
  assetNoPrefix,
  EQUIPMENT_KINDS,
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_PREFIXES_BY_KIND,
  EQUIPMENT_PREFIX_LABELS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  isEquipmentManagerItem,
  LEDGER_ENTITIES,
  LEDGER_ENTITY_LABELS,
  type EquipmentKind,
  type EquipmentManagerItem,
  type EquipmentPayload,
  type EquipmentPrefix
} from '../api/types';
import {
  EQUIPMENT_FIELD_MESSAGES,
  equipmentFieldsSchema,
  isPrefixAllowedForKind
} from '../schemas/equipment';

const FORM_ID = 'asset-ledger-form';

export type EquipmentFormValues = {
  kind: string;
  prefix: string;
  asset_no: string;
  model_serial: string;
  status: string;
  assignee: AssigneePick | null;
  ledger_entity: string;
  ledger_code: string;
  purchase_amount: string;
  purchased_on: string;
  vendor: string;
  manager_memo: string;
};

const {
  LedgerSelectField: SelectField,
  LedgerDateField: DateField,
  LedgerTextareaField: TextareaField
} = ledgerFormFields<EquipmentFormValues>();

const toOptions = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const KIND_OPTIONS = toOptions(EQUIPMENT_KINDS, EQUIPMENT_KIND_LABELS);
const STATUS_OPTIONS = toOptions(EQUIPMENT_STATUSES, EQUIPMENT_STATUS_LABELS);
const LEDGER_OPTIONS = toOptions(LEDGER_ENTITIES, LEDGER_ENTITY_LABELS);

function isEquipmentKind(value: string): value is EquipmentKind {
  return (EQUIPMENT_KINDS as readonly string[]).includes(value);
}

function prefixesFor(kind: string): readonly string[] {
  return isEquipmentKind(kind) ? EQUIPMENT_PREFIXES_BY_KIND[kind] : [];
}

function toFormValues(item: EquipmentManagerItem | null): EquipmentFormValues {
  if (!item) {
    return {
      kind: '',
      prefix: '',
      asset_no: '',
      model_serial: '',
      status: 'in_use',
      assignee: null,
      ledger_entity: '',
      ledger_code: '',
      purchase_amount: '',
      purchased_on: '',
      vendor: '',
      manager_memo: ''
    };
  }
  return {
    kind: item.kind,
    prefix: assetNoPrefix(item.asset_no) ?? EQUIPMENT_PREFIXES_BY_KIND[item.kind][0] ?? '',
    asset_no: item.asset_no,
    model_serial: item.model_serial ?? '',
    status: item.status,
    assignee: item.assignee ? assigneePickFromView(item.assignee) : null,
    ledger_entity: item.ledger_entity ?? '',
    ledger_code: item.ledger_code ?? '',
    purchase_amount: item.purchase_amount === null ? '' : String(item.purchase_amount),
    purchased_on: item.purchased_on ?? '',
    vendor: item.vendor ?? '',
    manager_memo: item.manager_memo ?? ''
  };
}

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

function toNumberOrRaw(value: string): number | string | null {
  const trimmed = value.trim().replaceAll(',', '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

function toPayloadDraft(values: EquipmentFormValues) {
  return {
    asset_no: values.asset_no.trim().toUpperCase(),
    kind: values.kind,
    model_serial: blankToNull(values.model_serial),
    status: values.status,
    assignee: values.assignee
      ? (values.assignee.input as Exclude<EquipmentPayload['assignee'], undefined>)
      : null,
    ledger_entity: values.ledger_entity || null,
    ledger_code: blankToNull(values.ledger_code),
    purchase_amount: toNumberOrRaw(values.purchase_amount),
    purchased_on: values.purchased_on || null,
    vendor: blankToNull(values.vendor),
    manager_memo: blankToNull(values.manager_memo)
  };
}

/** 서버와 같은 Zod + 품목↔앞글자 확인 (form-level → fields) */
function validateEquipmentForm({ value }: { value: EquipmentFormValues }) {
  const { assignee: _assignee, ...fields } = toPayloadDraft(value);
  const result = equipmentFieldsSchema.safeParse(fields);
  const errors: Record<string, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
    }
  }
  if (!errors.asset_no && !errors.kind && isEquipmentKind(fields.kind)) {
    if (!isPrefixAllowedForKind(fields.kind, fields.asset_no)) {
      errors.asset_no = EQUIPMENT_FIELD_MESSAGES.prefixMismatch;
    }
  }
  return Object.keys(errors).length > 0 ? { fields: errors } : undefined;
}

/** 서버 400/409 문구 → 칸 */
const SERVER_FIELD_BY_MESSAGE: Record<string, keyof EquipmentFormValues> = {
  [EQUIPMENT_FIELD_MESSAGES.duplicateAssetNo]: 'asset_no',
  [EQUIPMENT_FIELD_MESSAGES.assetNoFormat]: 'asset_no',
  [EQUIPMENT_FIELD_MESSAGES.prefixMismatch]: 'asset_no',
  [EQUIPMENT_FIELD_MESSAGES.assetNoRequired]: 'asset_no',
  [SECRET_LIKE_MESSAGE]: 'manager_memo',
  [ASSET_FIELD_MESSAGES.memoTooLong]: 'manager_memo',
  [ASSET_MESSAGES.invalidAssignee]: 'assignee'
};

function changedPayload(
  draft: ReturnType<typeof toPayloadDraft>,
  initial: ReturnType<typeof toPayloadDraft>
): Partial<EquipmentPayload> {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof typeof draft)[]) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(initial[key])) {
      changed[key] = draft[key];
    }
  }
  return changed as Partial<EquipmentPayload>;
}

type AssetNoFieldProps = {
  mode: 'create' | 'edit';
  /** 추가 모드에서 자동 제안이 한 번이라도 들어갔는지 */
  autoFilled: boolean;
  suggesting: boolean;
  onManualEdit: () => void;
  onSuggest: () => void;
};

/** 자산번호 — 추가: 품목·앞글자가 바뀌면 다음 번호 자동 · 수정: 「다음 번호」 버튼 (designer §2-7) */
function AssetNoField({ mode, autoFilled, suggesting, onManualEdit, onSuggest }: AssetNoFieldProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (state) => state.value) as string) ?? '';
  const isValid = useStore(field.store, (state) => state.meta.isValid);
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const id = `${field.name}-input`;

  return (
    <FormFieldSet>
      <FormField>
        <FieldLabel htmlFor={id}>자산번호 *</FieldLabel>
        <InputGroup className='h-11 md:h-9'>
          <InputGroupInput
            id={id}
            data-testid='equipment-form-asset-no'
            value={value}
            placeholder='N-001'
            autoCapitalize='characters'
            autoComplete='off'
            spellCheck={false}
            translate='no'
            className='font-mono uppercase'
            aria-invalid={isTouched && !isValid}
            onBlur={field.handleBlur}
            onChange={(event) => {
              onManualEdit();
              field.handleChange(event.target.value.toUpperCase());
            }}
          />
          {suggesting ? (
            <InputGroupAddon align='inline-end'>
              <Spinner className='size-4' aria-label='다음 번호를 찾는 중' />
            </InputGroupAddon>
          ) : mode === 'edit' ? (
            <InputGroupAddon align='inline-end'>
              <InputGroupButton
                type='button'
                size='xs'
                data-testid='equipment-form-suggest-number'
                onClick={onSuggest}
              >
                다음 번호
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {mode === 'create' ? (
          <FieldDescription>
            {autoFilled
              ? '다음 번호를 자동으로 넣었어요. 고칠 수 있어요.'
              : '품목을 고르면 다음 번호를 자동으로 넣어요.'}
          </FieldDescription>
        ) : null}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

function AssigneeSingleField() {
  const field = useFieldContext();
  const value = useStore(field.store, (state) => state.value) as AssigneePick | null;
  const isValid = useStore(field.store, (state) => state.meta.isValid);
  const hasSubmitted = useStore(field.form.store, (state) => state.submissionAttempts > 0);
  return (
    <FormFieldSet>
      <FormField>
        <AssigneePicker
          mode='single'
          value={value ? [value] : []}
          invalid={hasSubmitted && !isValid}
          onChange={(next) => {
            field.handleChange(next[0] ?? null);
            field.handleBlur();
          }}
        />
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

type EquipmentFormBodyProps = {
  item: EquipmentManagerItem | null;
  onClose: () => void;
};

function EquipmentFormBody({ item, onClose }: EquipmentFormBodyProps) {
  const mode = item ? 'edit' : 'create';
  const queryClient = useQueryClient();
  const { FormTextField } = useFormFields<EquipmentFormValues>();
  const [suggesting, setSuggesting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  /** 사용자가 자산번호를 직접 고쳤으면 자동 제안이 덮어쓰지 않는다 */
  const assetNoEditedRef = useRef(false);
  const suggestTokenRef = useRef(0);

  const createMutation = useMutation({
    ...createEquipmentMutation,
    onSuccess: (response) => notifySuccess(response.message || '비품을 추가했어요.'),
    onError: (error) => notifyError(error instanceof Error ? error.message : '비품을 추가하지 못했어요.')
  });
  const updateMutation = useMutation({
    ...updateEquipmentMutation,
    onSuccess: (response) => notifySuccess(response.message || '비품을 저장했어요.'),
    onError: (error) => notifyError(error instanceof Error ? error.message : '비품을 저장하지 못했어요.')
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useAppForm({
    defaultValues: toFormValues(item),
    validators: { onSubmit: validateEquipmentForm },
    onSubmitInvalid: () => scrollToFirstError(),
    onSubmit: async ({ value, formApi }) => {
      const draft = toPayloadDraft(value);
      try {
        if (item) {
          const payload = changedPayload(draft, toPayloadDraft(toFormValues(item)));
          if (Object.keys(payload).length === 0) {
            notifyInfo('바꾼 내용이 없어요.');
            onClose();
            return;
          }
          await updateMutation.mutateAsync({ id: item.id, payload });
          formApi.reset(value);
        } else {
          await createMutation.mutateAsync(draft as EquipmentPayload);
          formApi.reset();
        }
        onClose();
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const field = SERVER_FIELD_BY_MESSAGE[message];
        if (field) {
          setServerFieldError(formApi, field, message);
          scrollToFirstError();
        }
      }
    }
  });

  /** 다음 자산번호 조회 → 칸에 넣기 (가장 마지막 요청만 반영) */
  async function suggestNumber(prefix: string, options: { force: boolean }) {
    if (!prefix) return;
    if (!options.force && assetNoEditedRef.current) return;
    const token = ++suggestTokenRef.current;
    setSuggesting(true);
    try {
      const suggested = await queryClient.fetchQuery(nextAssetNoQueryOptions(prefix as EquipmentPrefix));
      if (token !== suggestTokenRef.current) return;
      if (!options.force && assetNoEditedRef.current) return;
      form.setFieldValue('asset_no', suggested);
      setAutoFilled(true);
      if (options.force) assetNoEditedRef.current = false;
    } catch (error) {
      if (token === suggestTokenRef.current) {
        notifyError(error instanceof Error ? error.message : '다음 자산번호를 찾지 못했어요.');
      }
    } finally {
      if (token === suggestTokenRef.current) setSuggesting(false);
    }
  }

  function handleKindChange(kind: string) {
    const allowed = prefixesFor(kind);
    const current = form.getFieldValue('prefix');
    const nextPrefix = allowed.includes(current) ? current : (allowed[0] ?? '');
    if (nextPrefix !== current) form.setFieldValue('prefix', nextPrefix);
    if (mode === 'create') void suggestNumber(nextPrefix, { force: false });
  }

  function handlePrefixChange(prefix: string) {
    if (mode === 'create') void suggestNumber(prefix, { force: false });
  }

  const kind = useStore(form.store, (state) => state.values.kind);
  const prefix = useStore(form.store, (state) => state.values.prefix);
  const allowedPrefixes = prefixesFor(kind);

  return (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6'>
        <form.AppForm>
          <form.Form id={FORM_ID} className='flex w-full flex-col gap-6'>
            <fieldset className='space-y-4'>
              <legend className='mb-3 text-sm font-semibold'>기본 정보</legend>
              <SelectField
                name='kind'
                label='품목'
                required
                options={KIND_OPTIONS}
                data-testid='equipment-form-kind'
                listeners={{ onChange: ({ value }) => handleKindChange(String(value ?? '')) }}
              />
              {allowedPrefixes.length > 1 ? (
                <SelectField
                  name='prefix'
                  label='앞글자'
                  required
                  options={allowedPrefixes.map((value) => ({
                    value,
                    label: EQUIPMENT_PREFIX_LABELS[value] ?? value
                  }))}
                  data-testid='equipment-form-prefix'
                  listeners={{ onChange: ({ value }) => handlePrefixChange(String(value ?? '')) }}
                />
              ) : allowedPrefixes.length === 1 ? (
                <p className='text-sm text-muted-foreground'>
                  앞글자 <span className='font-mono font-medium text-foreground'>{allowedPrefixes[0]}</span>
                </p>
              ) : null}
              <form.AppField name='asset_no'>
                {() => (
                  <AssetNoField
                    mode={mode}
                    autoFilled={autoFilled}
                    suggesting={suggesting}
                    onManualEdit={() => {
                      assetNoEditedRef.current = true;
                    }}
                    onSuggest={() => void suggestNumber(prefix, { force: true })}
                  />
                )}
              </form.AppField>
              <FormTextField
                name='model_serial'
                label='모델·시리얼'
                maxLength={120}
                autoComplete='off'
                translate='no'
                className='h-11 md:h-9'
                data-testid='equipment-form-model-serial'
              />
              <SelectField
                name='status'
                label='상태'
                required
                options={STATUS_OPTIONS}
                data-testid='equipment-form-status'
              />
            </fieldset>

            <fieldset className='space-y-4'>
              <legend className='mb-3 text-sm font-semibold'>사용자</legend>
              <form.AppField name='assignee'>{() => <AssigneeSingleField />}</form.AppField>
            </fieldset>

            <fieldset className='space-y-4'>
              <legend className='mb-3 text-sm font-semibold'>구입·회계</legend>
              <div className='grid gap-4 md:grid-cols-2'>
                <SelectField
                  name='ledger_entity'
                  label='회계장부'
                  allowEmpty
                  options={LEDGER_OPTIONS}
                  data-testid='equipment-form-ledger-entity'
                />
                <FormTextField
                  name='ledger_code'
                  label='장부코드'
                  maxLength={40}
                  autoComplete='off'
                  className='h-11 font-mono md:h-9'
                  data-testid='equipment-form-ledger-code'
                />
              </div>
              <FormTextField
                name='purchase_amount'
                label='구입 금액 (VAT 포함, 원)'
                inputMode='numeric'
                autoComplete='off'
                className='h-11 tabular-nums md:h-9'
                data-testid='equipment-form-purchase-amount'
              />
              <div className='grid gap-4 md:grid-cols-2'>
                <DateField name='purchased_on' label='구입일' data-testid='equipment-form-purchased-on' />
                <FormTextField
                  name='vendor'
                  label='구입처'
                  maxLength={80}
                  autoComplete='off'
                  className='h-11 md:h-9'
                  data-testid='equipment-form-vendor'
                />
              </div>
            </fieldset>

            <fieldset className='space-y-4'>
              <legend className='mb-3 text-sm font-semibold'>관리 메모</legend>
              <TextareaField
                name='manager_memo'
                label='관리 메모'
                hideLabel
                rows={4}
                maxLength={1000}
                showCount
                description='비밀번호·로그인 정보는 적지 마세요.'
                data-testid='asset-form-memo'
              />
            </fieldset>
          </form.Form>
        </form.AppForm>
      </div>
      <SheetFooter className='shrink-0 flex-row justify-end gap-2 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6'>
        <Button type='button' variant='outline' className='h-11 md:h-9' disabled={isPending} onClick={onClose}>
          취소
        </Button>
        <Button
          type='submit'
          form={FORM_ID}
          className='h-11 md:h-9'
          data-testid='asset-form-submit'
          isLoading={isPending}
        >
          <Icons.check aria-hidden />
          저장
        </Button>
      </SheetFooter>
    </>
  );
}

function EquipmentEditBody({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useSuspenseQuery(equipmentDetailQueryOptions(id));
  if (!isEquipmentManagerItem(data.item)) {
    return (
      <div className='p-4'>
        <AssetLedgerErrorAlert message='권한이 없습니다.' onRetry={onClose} />
      </div>
    );
  }
  return <EquipmentFormBody key={`${data.item.id}-${data.item.updated_at}`} item={data.item} onClose={onClose} />;
}

/**
 * 비품 추가·수정 Sheet (`equipment-form-sheet` · designer §2-7) — 권한자에게만 렌더.
 * 본문만 스크롤 · `SheetFooter`는 form 밖 고정 · 수정은 Dialog를 닫지 않고 위에 연다(AC-18).
 */
export function EquipmentFormSheet() {
  const { state, close } = useAssetLedgerSheet();
  const title = state.open && state.mode === 'edit' ? '비품 수정' : '비품 추가';

  return (
    <Sheet open={state.open} onOpenChange={(next) => (next ? null : close())}>
      <SheetContent
        side='right'
        data-testid='equipment-form-sheet'
        className='flex min-h-0 w-full flex-col gap-0 p-0 sm:max-w-xl'
      >
        <SheetHeader className='shrink-0 border-b px-4 py-4 md:px-6'>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>권한자만 추가·수정할 수 있어요. 별표(*)는 꼭 채워 주세요.</SheetDescription>
        </SheetHeader>
        {state.open ? (
          state.mode === 'edit' ? (
            <AssetLedgerQueryBoundary
              errorMessage='장비 정보를 불러오지 못했어요.'
              resetKey={String(state.id)}
              loadingFallback={<PageLoadingSpinner variant='compact' />}
            >
              <EquipmentEditBody id={state.id} onClose={close} />
            </AssetLedgerQueryBoundary>
          ) : (
            <EquipmentFormBody item={null} onClose={close} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
