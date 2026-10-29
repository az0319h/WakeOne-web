'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
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
import { createSubscriptionMutation, updateSubscriptionMutation } from '../api/mutations';
import { subscriptionDetailQueryOptions } from '../api/queries';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  isSubscriptionManagerItem,
  PAYER_ENTITIES,
  PAYER_ENTITY_LABELS,
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_CATEGORY_LABELS,
  SUBSCRIPTION_CURRENCIES,
  SUBSCRIPTION_CURRENCY_LABELS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionManagerItem,
  type SubscriptionPayload
} from '../api/types';
import { SUBSCRIPTION_FIELD_MESSAGES, subscriptionFieldsSchema } from '../schemas/subscription';

const FORM_ID = 'asset-ledger-form';

export type SubscriptionFormValues = {
  category: string;
  name: string;
  plan_name: string;
  purpose: string;
  status: string;
  expires_on: string;
  assignees: AssigneePick[];
  payer_entity: string;
  card_last4: string;
  billing_cycle: string;
  billing_day: string;
  billing_date: string;
  amount: string;
  currency: string;
  amount_varies: boolean;
  started_on: string;
  owner_account: string;
  manager_memo: string;
};

const {
  LedgerSelectField: SelectField,
  LedgerDateField: DateField,
  LedgerCheckboxField: CheckboxField,
  LedgerTextareaField: TextareaField
} = ledgerFormFields<SubscriptionFormValues>();

const toOptions = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const CATEGORY_OPTIONS = toOptions(SUBSCRIPTION_CATEGORIES, SUBSCRIPTION_CATEGORY_LABELS);
const STATUS_OPTIONS = toOptions(SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_LABELS);
const PAYER_OPTIONS = toOptions(PAYER_ENTITIES, PAYER_ENTITY_LABELS);
const CYCLE_OPTIONS = toOptions(BILLING_CYCLES, BILLING_CYCLE_LABELS);
const CURRENCY_OPTIONS = toOptions(SUBSCRIPTION_CURRENCIES, SUBSCRIPTION_CURRENCY_LABELS);

function toFormValues(item: SubscriptionManagerItem | null): SubscriptionFormValues {
  if (!item) {
    return {
      category: '',
      name: '',
      plan_name: '',
      purpose: '',
      status: 'active',
      expires_on: '',
      assignees: [],
      payer_entity: '',
      card_last4: '',
      billing_cycle: '',
      billing_day: '',
      billing_date: '',
      amount: '',
      currency: 'KRW',
      amount_varies: false,
      started_on: '',
      owner_account: '',
      manager_memo: ''
    };
  }
  return {
    category: item.category,
    name: item.name,
    plan_name: item.plan_name ?? '',
    purpose: item.purpose ?? '',
    status: item.status,
    expires_on: item.expires_on ?? '',
    assignees: item.assignees
      .map(assigneePickFromView)
      .filter((pick): pick is AssigneePick => pick !== null),
    payer_entity: item.payer_entity ?? '',
    card_last4: item.card_last4 ?? '',
    billing_cycle: item.billing_cycle ?? '',
    billing_day: item.billing_day === null ? '' : String(item.billing_day),
    billing_date: item.billing_date ?? '',
    amount: item.amount === null ? '' : String(item.amount),
    currency: item.currency ?? 'KRW',
    amount_varies: item.amount_varies,
    started_on: item.started_on ?? '',
    owner_account: item.owner_account ?? '',
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

/** 폼 값 → 서버 본문(결제일은 주기에 맞는 것만 · 「매월 다름」이면 금액 비움) */
function toPayloadDraft(values: SubscriptionFormValues) {
  const yearly = values.billing_cycle === 'yearly';
  return {
    category: values.category,
    name: values.name.trim(),
    plan_name: blankToNull(values.plan_name),
    purpose: blankToNull(values.purpose),
    status: values.status,
    expires_on: values.expires_on || null,
    payer_entity: values.payer_entity || null,
    card_last4: blankToNull(values.card_last4),
    billing_cycle: values.billing_cycle || null,
    billing_day: yearly ? null : toNumberOrRaw(values.billing_day),
    billing_date: yearly ? values.billing_date || null : null,
    amount: values.amount_varies ? null : toNumberOrRaw(values.amount),
    currency: values.currency || null,
    amount_varies: values.amount_varies,
    started_on: values.started_on || null,
    owner_account: blankToNull(values.owner_account),
    manager_memo: blankToNull(values.manager_memo),
    assignees: values.assignees.map((pick) => pick.input)
  };
}

/** 서버와 같은 Zod로 칸별 첫 오류 (form-level → fields) */
function validateSubscriptionForm({ value }: { value: SubscriptionFormValues }) {
  const { assignees: _assignees, ...fields } = toPayloadDraft(value);
  const result = subscriptionFieldsSchema.safeParse(fields);
  if (result.success) return undefined;
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return { fields: errors };
}

/** 서버 400/409 문구 → 칸 (응답 `field`는 api-client가 버리므로 문구로 매칭) */
const SERVER_FIELD_BY_MESSAGE: Record<string, keyof SubscriptionFormValues> = {
  [SECRET_LIKE_MESSAGE]: 'manager_memo',
  [ASSET_FIELD_MESSAGES.memoTooLong]: 'manager_memo',
  [ASSET_FIELD_MESSAGES.invalidEmail]: 'owner_account',
  [ASSET_MESSAGES.invalidAssignee]: 'assignees',
  [ASSET_MESSAGES.duplicateAssignee]: 'assignees',
  [SUBSCRIPTION_FIELD_MESSAGES.nameRequired]: 'name',
  [SUBSCRIPTION_FIELD_MESSAGES.nameTooLong]: 'name',
  [SUBSCRIPTION_FIELD_MESSAGES.cardInvalid]: 'card_last4',
  [SUBSCRIPTION_FIELD_MESSAGES.billingDayInvalid]: 'billing_day'
};

function changedPayload(
  draft: ReturnType<typeof toPayloadDraft>,
  initial: ReturnType<typeof toPayloadDraft>
): Partial<SubscriptionPayload> {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof typeof draft)[]) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(initial[key])) {
      changed[key] = draft[key];
    }
  }
  return changed as Partial<SubscriptionPayload>;
}

function AssigneesField() {
  const field = useFieldContext();
  const value = useStore(field.store, (state) => state.value) as AssigneePick[];
  const isValid = useStore(field.store, (state) => state.meta.isValid);
  const hasSubmitted = useStore(field.form.store, (state) => state.submissionAttempts > 0);
  return (
    <FormFieldSet>
      <FormField>
        <AssigneePicker
          mode='multiple'
          value={value}
          invalid={hasSubmitted && !isValid}
          onChange={(next) => {
            field.handleChange(next);
            field.handleBlur();
          }}
        />
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

type SubscriptionFormBodyProps = {
  item: SubscriptionManagerItem | null;
  onClose: () => void;
};

function SubscriptionFormBody({ item, onClose }: SubscriptionFormBodyProps) {
  const { FormTextField } = useFormFields<SubscriptionFormValues>();

  const createMutation = useMutation({
    ...createSubscriptionMutation,
    onSuccess: (response) => notifySuccess(response.message || '구독을 추가했어요.'),
    onError: (error) => notifyError(error instanceof Error ? error.message : '구독을 추가하지 못했어요.')
  });
  const updateMutation = useMutation({
    ...updateSubscriptionMutation,
    onSuccess: (response) => notifySuccess(response.message || '구독을 저장했어요.'),
    onError: (error) => notifyError(error instanceof Error ? error.message : '구독을 저장하지 못했어요.')
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useAppForm({
    defaultValues: toFormValues(item),
    validators: { onSubmit: validateSubscriptionForm },
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
          await createMutation.mutateAsync(draft as SubscriptionPayload);
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

  const billingCycle = useStore(form.store, (state) => state.values.billing_cycle);
  const amountVaries = useStore(form.store, (state) => state.values.amount_varies);

  return (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6'>
        <form.AppForm>
          <form.Form id={FORM_ID} className='flex w-full flex-col gap-6'>
            <fieldset className='space-y-4'>
              <legend className='mb-3 text-sm font-semibold'>기본 정보</legend>
              <SelectField
                name='category'
                label='구분'
                required
                options={CATEGORY_OPTIONS}
                data-testid='subscription-form-category'
              />
              <FormTextField
                name='name'
                label='구독명'
                required
                maxLength={80}
                translate='no'
                autoComplete='off'
                className='h-11 md:h-9'
                data-testid='subscription-form-name'
              />
              <FormTextField
                name='plan_name'
                label='플랜'
                maxLength={80}
                autoComplete='off'
                className='h-11 md:h-9'
                data-testid='subscription-form-plan'
              />
              <FormTextField
                name='purpose'
                label='사용 목적'
                maxLength={200}
                autoComplete='off'
                className='h-11 md:h-9'
                data-testid='subscription-form-purpose'
              />
              <SelectField
                name='status'
                label='상태'
                required
                options={STATUS_OPTIONS}
                data-testid='subscription-form-status'
              />
              <DateField name='expires_on' label='만료·갱신일' data-testid='subscription-form-expires-on' />
            </fieldset>

            <fieldset className='space-y-4'>
              <legend className='mb-3 text-sm font-semibold'>대상자</legend>
              <form.AppField name='assignees'>{() => <AssigneesField />}</form.AppField>
            </fieldset>

            <fieldset className='space-y-4'>
              <legend className='mb-3 text-sm font-semibold'>결제 정보</legend>
              <SelectField
                name='payer_entity'
                label='결제 법인'
                allowEmpty
                options={PAYER_OPTIONS}
                data-testid='subscription-form-payer'
              />
              <FormTextField
                name='card_last4'
                label='카드 끝 4자리'
                inputMode='numeric'
                maxLength={4}
                autoComplete='off'
                className='h-11 font-mono md:h-9'
                data-testid='subscription-form-card'
              />
              <div className='grid gap-4 md:grid-cols-2'>
                <SelectField
                  name='billing_cycle'
                  label='결제 주기'
                  allowEmpty
                  options={CYCLE_OPTIONS}
                  data-testid='subscription-form-cycle'
                />
                {billingCycle === 'yearly' ? (
                  <DateField
                    name='billing_date'
                    label='결제일(연)'
                    data-testid='subscription-form-billing-date'
                  />
                ) : (
                  <FormTextField
                    name='billing_day'
                    label='결제일(매월)'
                    inputMode='numeric'
                    placeholder='1~31'
                    autoComplete='off'
                    className='h-11 md:h-9'
                    data-testid='subscription-form-billing-day'
                  />
                )}
              </div>
              <div className='grid gap-4 md:grid-cols-[1fr_8rem]'>
                <FormTextField
                  name='amount'
                  label='금액'
                  inputMode='decimal'
                  autoComplete='off'
                  disabled={amountVaries}
                  className='h-11 tabular-nums md:h-9'
                  data-testid='subscription-form-amount'
                />
                <SelectField
                  name='currency'
                  label='통화'
                  allowEmpty
                  options={CURRENCY_OPTIONS}
                  data-testid='subscription-form-currency'
                />
              </div>
              <CheckboxField
                name='amount_varies'
                label='매월 다름'
                description='금액이 매달 바뀌면 체크해 주세요.'
                data-testid='subscription-form-amount-varies'
              />
              <DateField name='started_on' label='시작일' data-testid='subscription-form-started-on' />
              <FormTextField
                name='owner_account'
                label='주계정'
                type='email'
                spellCheck={false}
                autoComplete='off'
                translate='no'
                className='h-11 md:h-9'
                data-testid='subscription-form-owner-account'
              />
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

function SubscriptionEditBody({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useSuspenseQuery(subscriptionDetailQueryOptions(id));
  if (!isSubscriptionManagerItem(data.item)) {
    return (
      <div className='p-4'>
        <AssetLedgerErrorAlert message='권한이 없습니다.' onRetry={onClose} />
      </div>
    );
  }
  return <SubscriptionFormBody key={`${data.item.id}-${data.item.updated_at}`} item={data.item} onClose={onClose} />;
}

/**
 * 구독 추가·수정 Sheet (`subscription-form-sheet` · designer §2-7) — 권한자에게만 렌더.
 * 본문만 스크롤 · `SheetFooter`는 form 밖 고정(모바일 CTA) · 수정은 Dialog를 닫지 않고 위에 연다(AC-18).
 */
export function SubscriptionFormSheet() {
  const { state, close } = useAssetLedgerSheet();
  const isEdit = state.open && state.mode === 'edit';
  const title = isEdit ? '구독 수정' : '구독 추가';

  return (
    <Sheet open={state.open} onOpenChange={(next) => (next ? null : close())}>
      <SheetContent
        side='right'
        data-testid='subscription-form-sheet'
        className='flex min-h-0 w-full flex-col gap-0 p-0 sm:max-w-xl'
      >
        <SheetHeader className='shrink-0 border-b px-4 py-4 md:px-6'>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>권한자만 추가·수정할 수 있어요. 별표(*)는 꼭 채워 주세요.</SheetDescription>
        </SheetHeader>
        {state.open ? (
          state.mode === 'edit' ? (
            <AssetLedgerQueryBoundary
              errorMessage='구독 정보를 불러오지 못했어요.'
              resetKey={String(state.id)}
              loadingFallback={<PageLoadingSpinner variant='compact' />}
            >
              <SubscriptionEditBody id={state.id} onClose={close} />
            </AssetLedgerQueryBoundary>
          ) : (
            <SubscriptionFormBody item={null} onClose={close} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
