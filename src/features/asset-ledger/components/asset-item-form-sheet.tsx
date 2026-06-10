'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import {
  createAssetItemMutation,
  updateAssetItemMutation
} from '../api/mutations';
import {
  ASSET_DEPARTMENT_NONE_SENTINEL,
  ASSET_ITEM_STATUSES,
  type AssetItem,
  type AssetItemStatus
} from '../api/types';
import { suggestAssetNumber } from '../api/service';
import { assetItemCreateSchema } from '../api/validators';
import { assetLedgerUsersQueryOptions } from '../api/user-queries';
import type { AssetLedgerUser } from '../api/users';
import { assetItemsQueryOptions } from '../api/queries';
import { AssetItemCategoryField } from './asset-item-category-field';

interface AssetItemFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: AssetItem | null;
}

type AssetItemFormValues = {
  asset_number: string;
  asset_name: string;
  status: AssetItemStatus;
  model_number: string;
  actual_user_id: string;
  usage_location: string;
  category: string;
  accounting_ledger: string;
  ledger_code: string;
  purchase_amount: number | undefined;
  purchase_date: string;
  purchase_vendor: string;
  notes: string;
};

type SuggestionMessage = {
  type: 'info' | 'warning';
  text: string;
};

function toFormValues(item?: AssetItem | null): AssetItemFormValues {
  return {
    asset_number: item?.asset_number ?? '',
    asset_name: item?.asset_name ?? '',
    status: item?.status ?? '사용중',
    model_number: item?.model_number ?? '',
    actual_user_id: item?.actual_user_id ?? '',
    usage_location: item?.usage_location?.trim() || ASSET_DEPARTMENT_NONE_SENTINEL,
    category: item?.category ?? '',
    accounting_ledger: item?.accounting_ledger ?? '',
    ledger_code: item?.ledger_code ?? '',
    purchase_amount: item?.purchase_amount ?? undefined,
    purchase_date: item?.purchase_date ?? '',
    purchase_vendor: item?.purchase_vendor ?? '',
    notes: item?.notes ?? ''
  };
}

const EMPTY_ASSET_ITEM_FORM_VALUES = toFormValues(null);

function cleanOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveUsageLocationFromUser(user?: AssetLedgerUser | null): string {
  const department = user?.department?.trim();
  return department ? department : ASSET_DEPARTMENT_NONE_SENTINEL;
}

function formatAssetLedgerUserLabel(user: AssetLedgerUser): string {
  const name = user.name.trim();
  const email = user.email.trim();
  if (!name || name === email) {
    return email;
  }

  return `${name} (${email})`;
}

function buildSubmitSchema() {
  return z.object({
    asset_number: z
      .string()
      .trim()
      .min(1, '자산번호를 입력해 주세요.')
      .regex(/^[A-Z0-9]{1,10}-\d{3}$/, '자산번호 형식은 PREFIX-001 형태여야 합니다.'),
    asset_name: z.string().trim().min(1, '자산명을 입력해 주세요.'),
    status: z.enum(ASSET_ITEM_STATUSES),
    model_number: z.string(),
    actual_user_id: z.string(),
    usage_location: z.string(),
    category: z.string(),
    accounting_ledger: z.string(),
    ledger_code: z.string(),
    purchase_amount: z.union([z.number().int().nonnegative(), z.undefined()]),
    purchase_date: z.string(),
    purchase_vendor: z.string(),
    notes: z.string()
  });
}

export function AssetItemFormSheet({ open, onOpenChange, item }: AssetItemFormSheetProps) {
  const isEdit = Boolean(item);
  const [apiError, setApiError] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [assetNumberManuallyEdited, setAssetNumberManuallyEdited] = useState(
    Boolean(item?.asset_number)
  );
  const [lastSuggestedAssetNumber, setLastSuggestedAssetNumber] = useState<string | null>(null);
  const [suggestionMessage, setSuggestionMessage] = useState<SuggestionMessage | null>(null);
  const suggestRequestIdRef = useRef(0);
  const assetNumberManuallyEditedRef = useRef(assetNumberManuallyEdited);
  const autoSuggestTimerRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const { data: usersData } = useSuspenseQuery(assetLedgerUsersQueryOptions(''));
  const { data: listMeta } = useSuspenseQuery(assetItemsQueryOptions({ page: 1, limit: 1 }));

  const departmentSelectOptions = useMemo(() => {
    const departments = new Set(usersData.departments);
    for (const user of usersData.users) {
      const department = user.department?.trim();
      if (department) {
        departments.add(department);
      }
    }
    if (item?.usage_location?.trim()) {
      departments.add(item.usage_location.trim());
    }

    return [
      { label: '미지정', value: ASSET_DEPARTMENT_NONE_SENTINEL },
      ...Array.from(departments)
        .sort((a, b) => a.localeCompare(b, 'ko'))
        .map((department) => ({
          label: department,
          value: department
        }))
    ];
  }, [item?.usage_location, usersData.departments, usersData.users]);

  const categorySuggestions = useMemo(() => {
    const categories = new Set(listMeta.categoryOptions);
    if (item?.category?.trim()) {
      categories.add(item.category.trim());
    }

    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [item?.category, listMeta.categoryOptions]);

  const createMutation = useMutation({
    ...createAssetItemMutation,
    onSuccess: () => {
      notifySuccess('비품이 등록되었습니다.');
      setApiError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '비품 등록에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const updateMutation = useMutation({
    ...updateAssetItemMutation,
    onSuccess: () => {
      notifySuccess('비품 정보가 수정되었습니다.');
      setApiError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '비품 수정에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const suggestMutation = useMutation({
    mutationFn: (assetName: string) => suggestAssetNumber(assetName),
    onError: () => {
      // 추천 실패는 사용자 입력을 막지 않기 위해 토스트 없이 무시한다.
    }
  });

  useEffect(() => {
    assetNumberManuallyEditedRef.current = assetNumberManuallyEdited;
  }, [assetNumberManuallyEdited]);

  const form = useAppForm({
    defaultValues: toFormValues(item),
    validators: {
      onSubmit: buildSubmitSchema()
    },
    onSubmit: async ({ value }) => {
      setApiError(null);

      const payload = {
        asset_number: value.asset_number.trim().toUpperCase(),
        asset_name: value.asset_name.trim(),
        status: value.status,
        model_number: cleanOptionalText(value.model_number),
        actual_user_id: cleanOptionalText(value.actual_user_id),
        usage_location:
          value.usage_location === ASSET_DEPARTMENT_NONE_SENTINEL
            ? null
            : cleanOptionalText(value.usage_location),
        category: cleanOptionalText(value.category),
        accounting_ledger: cleanOptionalText(value.accounting_ledger),
        ledger_code: cleanOptionalText(value.ledger_code),
        purchase_amount: value.purchase_amount ?? null,
        purchase_date: cleanOptionalText(value.purchase_date),
        purchase_vendor: cleanOptionalText(value.purchase_vendor),
        notes: cleanOptionalText(value.notes)
      };

      const parsed = assetItemCreateSchema.safeParse(payload);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
        setApiError(message);
        notifyError(message);
        return;
      }

      if (isEdit && item) {
        await updateMutation.mutateAsync({ id: item.id, payload: parsed.data });
        await queryClient.invalidateQueries({ queryKey: ['asset-items', 'detail', item.id] });
        form.reset();
        return;
      }

      await createMutation.mutateAsync(parsed.data);
      form.reset(EMPTY_ASSET_ITEM_FORM_VALUES);
      setAssetNumberManuallyEdited(false);
      setLastSuggestedAssetNumber(null);
      setSuggestionMessage(null);
    }
  });

  const { FormTextField, FormSelectField, FormTextareaField } = useFormFields<AssetItemFormValues>();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const SubmitIcon = isEdit ? Icons.edit : Icons.add;

  useEffect(() => {
    if (!open) {
      form.reset(EMPTY_ASSET_ITEM_FORM_VALUES);
      setApiError(null);
      setUserOpen(false);
      setAssetNumberManuallyEdited(false);
      setLastSuggestedAssetNumber(null);
      setSuggestionMessage(null);
      suggestRequestIdRef.current += 1;
      return;
    }

    const nextValues = toFormValues(item);
    form.reset(nextValues);
    setApiError(null);
    setUserOpen(false);
    setAssetNumberManuallyEdited(Boolean(item?.asset_number));
    setLastSuggestedAssetNumber(item?.asset_number ?? null);
    setSuggestionMessage(null);
    suggestRequestIdRef.current += 1;
  }, [open, item, form]);

  const applySuggestedAssetNumber = useCallback(
    async (assetName: string, manualTrigger: boolean) => {
      const trimmedAssetName = assetName.trim();
      if (!trimmedAssetName) {
        setSuggestionMessage(null);
        if (manualTrigger) {
          notifyError('자산명을 먼저 입력해 주세요.');
        }
        return;
      }

      const requestId = ++suggestRequestIdRef.current;
      let suggestedResponse: Awaited<ReturnType<typeof suggestMutation.mutateAsync>> | null = null;
      let requestErrorMessage: string | null = null;
      try {
        suggestedResponse = await suggestMutation.mutateAsync(trimmedAssetName);
      } catch (error) {
        requestErrorMessage =
          error instanceof Error ? error.message : '자산번호 추천 중 오류가 발생했습니다.';
      }

      if (requestId !== suggestRequestIdRef.current) {
        return;
      }

      if (requestErrorMessage) {
        setSuggestionMessage({
          type: 'warning',
          text: '자동 추천에 실패했습니다. 자산번호를 직접 입력해 주세요.'
        });
        if (manualTrigger) {
          notifyError(requestErrorMessage);
        }
        return;
      }

      if (!suggestedResponse?.suggested) {
        setSuggestionMessage({
          type: 'warning',
          text: '추천 가능한 자산번호가 없습니다. 자산번호를 직접 입력해 주세요.'
        });
        if (manualTrigger) {
          notifyError('추천 가능한 자산번호가 없습니다. 자산번호를 직접 입력해 주세요.');
        }
        return;
      }

      if (!manualTrigger && assetNumberManuallyEditedRef.current) {
        return;
      }

      if (form.getFieldValue('asset_number') !== suggestedResponse.suggested) {
        form.setFieldValue('asset_number', suggestedResponse.suggested);
      }
      setLastSuggestedAssetNumber(suggestedResponse.suggested);
      setAssetNumberManuallyEdited(false);
      setSuggestionMessage({
        type: 'info',
        text: `자동 추천 ${suggestedResponse.suggested} 적용됨`
      });

      if (manualTrigger) {
        notifySuccess(`추천 자산번호 ${suggestedResponse.suggested}를 입력했습니다.`);
      }
    },
    [form, suggestMutation]
  );

  const scheduleAutoSuggestion = useCallback(
    (assetName: string) => {
      if (!open || isEdit || assetNumberManuallyEdited) {
        return;
      }

      if (autoSuggestTimerRef.current) {
        window.clearTimeout(autoSuggestTimerRef.current);
      }

      const trimmedAssetName = assetName.trim();
      if (!trimmedAssetName) {
        setSuggestionMessage(null);
        return;
      }

      autoSuggestTimerRef.current = window.setTimeout(() => {
        void applySuggestedAssetNumber(trimmedAssetName, false);
      }, 450);
    },
    [applySuggestedAssetNumber, assetNumberManuallyEdited, isEdit, open]
  );

  useEffect(() => {
    if (!open && autoSuggestTimerRef.current) {
      window.clearTimeout(autoSuggestTimerRef.current);
      autoSuggestTimerRef.current = null;
    }
    return () => {
      if (autoSuggestTimerRef.current) {
        window.clearTimeout(autoSuggestTimerRef.current);
        autoSuggestTimerRef.current = null;
      }
    };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '비품 수정' : '비품 등록'}</SheetTitle>
          <SheetDescription>
            자산번호와 실사용자 정보를 포함해 비품 장부 정보를 입력합니다.
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {apiError}
          </div>
        ) : null}

        <form.AppForm>
          <form.Form id='asset-item-form' className='flex h-full min-h-0 flex-col'>
            <div className='min-h-0 flex-1 space-y-4 overflow-auto py-2 pr-1'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <form.AppField
                  name='asset_name'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          자산명 <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={(event) => {
                            field.handleBlur();
                            if (isEdit || assetNumberManuallyEdited) {
                              return;
                            }
                            if (autoSuggestTimerRef.current) {
                              window.clearTimeout(autoSuggestTimerRef.current);
                              autoSuggestTimerRef.current = null;
                            }
                            void applySuggestedAssetNumber(event.target.value, false);
                          }}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            field.handleChange(nextValue);
                            scheduleAutoSuggestion(nextValue);
                          }}
                          placeholder='예: 노트북(N)'
                          className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                        />
                      </field.Field>
                      <field.FieldDescription>
                        괄호 안에 영문·숫자 접두를 넣어 입력하세요. 예: 노트북(N) → N-001 형태로 자산번호가
                        자동 추천됩니다. 자산번호를 직접 수정하면 이후 자동 추천이 중단됩니다.
                      </field.FieldDescription>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
                <form.AppField
                  name='asset_number'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          자산번호 <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <div className='flex gap-2'>
                          <input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              const nextValue = event.target.value.toUpperCase();
                              field.handleChange(nextValue);
                              setAssetNumberManuallyEdited(nextValue !== lastSuggestedAssetNumber);
                            setSuggestionMessage(null);
                            }}
                            placeholder='예: N-001'
                            className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                          />
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            isLoading={suggestMutation.isPending}
                            onClick={async () => {
                              await applySuggestedAssetNumber(form.getFieldValue('asset_name'), true);
                            }}
                          >
                            추천
                          </Button>
                        </div>
                      </field.Field>
                      <field.FieldDescription>
                        {suggestionMessage?.text ? (
                          <span
                            className={cn(
                              suggestionMessage.type === 'warning'
                                ? 'text-amber-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {suggestionMessage.text}
                          </span>
                        ) : (
                          '자산명 입력 시 자동 추천되며, 직접 수정하면 이후 자동 덮어쓰기를 중단합니다.'
                        )}
                      </field.FieldDescription>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormSelectField
                  name='status'
                  label='상태'
                  required
                  options={ASSET_ITEM_STATUSES.map((status) => ({
                    label: status,
                    value: status
                  }))}
                />

                <form.AppField
                  name='actual_user_id'
                  children={(field) => {
                    const selectedUser = usersData.users.find((user) => user.id === field.state.value);

                    return (
                      <field.FieldSet className='min-w-0'>
                        <field.Field className='min-w-0'>
                          <field.FieldLabel htmlFor={field.name}>실사용자</field.FieldLabel>
                          <Popover open={userOpen} onOpenChange={setUserOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id={field.name}
                                type='button'
                                variant='outline'
                                role='combobox'
                                className='w-full min-w-0 justify-between gap-2'
                              >
                                <span className='min-w-0 flex-1 truncate text-left'>
                                  {selectedUser
                                    ? formatAssetLedgerUserLabel(selectedUser)
                                    : '실사용자를 선택해 주세요.'}
                                </span>
                                <Icons.chevronDown className='h-4 w-4 shrink-0 opacity-50' />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className='w-[360px] p-0' align='start'>
                              <Command>
                                <CommandInput placeholder='이름 또는 이메일 검색' />
                                <CommandList>
                                  <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      onSelect={() => {
                                        field.handleChange('');
                                        form.setFieldValue(
                                          'usage_location',
                                          ASSET_DEPARTMENT_NONE_SENTINEL
                                        );
                                        setUserOpen(false);
                                      }}
                                    >
                                      <Icons.check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          field.state.value ? 'opacity-0' : 'opacity-100'
                                        )}
                                      />
                                      미지정
                                    </CommandItem>
                                    {usersData.users.map((user) => {
                                      const label = formatAssetLedgerUserLabel(user);
                                      return (
                                        <CommandItem
                                          key={user.id}
                                          value={label}
                                          onSelect={() => {
                                            field.handleChange(user.id);
                                            form.setFieldValue(
                                              'usage_location',
                                              resolveUsageLocationFromUser(user)
                                            );
                                            setUserOpen(false);
                                          }}
                                        >
                                          <Icons.check
                                            className={cn(
                                              'mr-2 h-4 w-4',
                                              field.state.value === user.id
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                            )}
                                          />
                                          {label}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </field.Field>
                        <field.FieldError />
                      </field.FieldSet>
                    );
                  }}
                />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormTextField name='model_number' label='품명(모델번호)' placeholder='모델명' />
                <FormSelectField
                  name='usage_location'
                  label='부서'
                  options={departmentSelectOptions}
                  placeholder='부서를 선택해 주세요'
                />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <form.AppField
                  name='category'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>카테고리</field.FieldLabel>
                        <AssetItemCategoryField
                          id={field.name}
                          value={field.state.value}
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                          suggestions={categorySuggestions}
                        />
                      </field.Field>
                      <field.FieldDescription>
                        추천값을 선택하거나 새 카테고리를 입력할 수 있습니다.
                      </field.FieldDescription>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormTextField name='accounting_ledger' label='회계장부' placeholder='회계장부' />
                <FormTextField name='ledger_code' label='장부코드' placeholder='장부코드' />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormTextField
                  name='purchase_amount'
                  label='구입금액(+vat)'
                  type='number'
                  min={0}
                  step={1}
                  placeholder='예: 1200000'
                />
                <form.AppField
                  name='purchase_date'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>구입날짜</field.FieldLabel>
                        <input
                          id={field.name}
                          name={field.name}
                          type='date'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
              </div>

              <FormTextField name='purchase_vendor' label='구입처' placeholder='구입처' />
              <FormTextareaField name='notes' label='비고' rows={4} placeholder='추가 메모' />
            </div>
          </form.Form>
        </form.AppForm>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type='submit' form='asset-item-form' isLoading={isPending}>
            <SubmitIcon className='mr-2 h-4 w-4' />
            {isEdit ? '저장' : '등록'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
