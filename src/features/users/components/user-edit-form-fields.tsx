'use client';

import { useStore } from '@tanstack/react-form';
import { useFormFields } from '@/components/ui/tanstack-form';
import { useFormContext } from '@/components/ui/form-context';
import {
  AFFILIATION_OPTIONS,
  RANK_BY_AFFILIATION,
  SELECT_NONE_OPTION,
  SELECT_NONE_VALUE
} from '@/features/users/constants/organization';
import type {
  CreateUserFormValues,
  UserUpdateFormValues
} from '../schemas/user';
import { SYSTEM_ROLE_OPTIONS } from './users-table/options';

function toSelectOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

const AFFILIATION_SELECT_OPTIONS = [
  SELECT_NONE_OPTION,
  ...AFFILIATION_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label
  }))
];

const REQUIRED_AFFILIATION_SELECT_OPTIONS = AFFILIATION_OPTIONS.map(
  (option) => ({
    value: option.value,
    label: option.label
  })
);

export function UserCreateFormFields() {
  const form = useFormContext();
  const { FormTextField, FormSelectField, FormBirthdayField } =
    useFormFields<CreateUserFormValues>();
  const affiliation = useStore(form.store, (state) => state.values.affiliation);
  const activeAffiliation =
    affiliation === 'wake' ||
    affiliation === 'sans' ||
    affiliation === 'sans_foundry'
      ? affiliation
      : null;

  const rankOptions = activeAffiliation
    ? toSelectOptions(RANK_BY_AFFILIATION[activeAffiliation])
    : [];

  return (
    <div className='space-y-4'>
      <FormTextField
        name='full_name'
        label='이름'
        placeholder='이름'
      />
      <FormTextField
        name='email'
        label='이메일'
        type='email'
        placeholder='user@example.com'
      />
      <FormSelectField
        name='affiliation'
        label='소속'
        options={REQUIRED_AFFILIATION_SELECT_OPTIONS}
        placeholder='소속 선택'
        listeners={{
          onChange: ({ fieldApi }) => {
            fieldApi.form.setFieldValue('rank', '');
          }
        }}
      />
      <FormSelectField
        name='rank'
        label='직급'
        options={rankOptions}
        placeholder={
          activeAffiliation ? '직급 선택' : '소속을 먼저 선택해 주세요'
        }
      />
      <FormSelectField
        name='system_role'
        label='시스템 역할'
        options={SYSTEM_ROLE_OPTIONS}
        placeholder='역할 선택'
      />
      <FormBirthdayField name='birthday' label='생일' />
    </div>
  );
}

export function UserEditFormFields() {
  const form = useFormContext();
  const { FormTextField, FormSelectField, FormBirthdayField } =
    useFormFields<UserUpdateFormValues>();
  const affiliation = useStore(form.store, (state) => state.values.affiliation);
  const activeAffiliation =
    affiliation === 'wake' ||
    affiliation === 'sans' ||
    affiliation === 'sans_foundry'
      ? affiliation
      : null;

  const rankOptions = activeAffiliation
    ? toSelectOptions(RANK_BY_AFFILIATION[activeAffiliation])
    : [];

  return (
    <div className='space-y-4'>
      <FormTextField
        name='full_name'
        label='이름'
        placeholder='이름'
      />
      <FormTextField
        name='avatar_url'
        label='아바타 URL'
        type='url'
        placeholder='https://example.com/avatar.png'
      />
      <FormSelectField
        name='affiliation'
        label='소속'
        options={AFFILIATION_SELECT_OPTIONS}
        placeholder='소속 선택'
        listeners={{
          onChange: ({ fieldApi }) => {
            fieldApi.form.setFieldValue('rank', SELECT_NONE_VALUE);
          }
        }}
      />
      <FormSelectField
        name='rank'
        label='직급'
        options={[SELECT_NONE_OPTION, ...rankOptions]}
        placeholder={
          activeAffiliation ? '직급 선택' : '소속을 먼저 선택해 주세요'
        }
      />
      <FormSelectField
        name='system_role'
        label='시스템 역할'
        options={SYSTEM_ROLE_OPTIONS}
        placeholder='역할 선택'
      />
      <FormBirthdayField name='birthday' label='생일' />
    </div>
  );
}
