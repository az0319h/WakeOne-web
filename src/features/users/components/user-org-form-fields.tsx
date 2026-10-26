'use client';

import { useStore } from '@tanstack/react-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { useFormFields } from '@/components/ui/tanstack-form';
import { useFormContext } from '@/components/ui/form-context';
import { FormPhoneField } from '@/features/auth/components/phone-field';
import {
  AFFILIATION_OPTIONS,
  isDongbangAffiliation,
  LEADER_ROLE_OPTIONS,
  ORG_AFFILIATION_OPTIONS,
  POSITION_LEVEL_BY_AFFILIATION,
  ranksForUserSelect,
  resolveRankFromPositionLevel,
  SELECT_NONE_OPTION,
  SELECT_NONE_VALUE
} from '@/features/users/constants/organization';
import type {
  ApproveUserFormValues,
  CreateUserFormValues,
  UserUpdateFormValues
} from '../schemas/user';
import { SYSTEM_ROLE_OPTIONS } from './users-table/options';

function toSelectOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

const REQUIRED_AFFILIATION_SELECT_OPTIONS = AFFILIATION_OPTIONS.map(
  (option) => ({
    value: option.value,
    label: option.label
  })
);

const AFFILIATION_SELECT_OPTIONS = [
  SELECT_NONE_OPTION,
  ...REQUIRED_AFFILIATION_SELECT_OPTIONS
];

/** dev 사전 생성 — 조직 체계 소속만 (동방특송은 승인·수정 Sheet에서만 지정) */
const CREATE_AFFILIATION_SELECT_OPTIONS = ORG_AFFILIATION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label
}));

const DONGBANG_SYSTEM_ROLE_DESCRIPTION = '동방특송은 일반 사용자 역할만 가능합니다.';

/** plan 89 U-9 — 동방특송은 부서·직급·리더·생일 칸을 DOM에서 빼고 안내만 보인다 */
function DongbangNotice() {
  return (
    <Alert data-testid='user-dongbang-notice'>
      <Icons.info aria-hidden />
      <AlertDescription>동방특송은 퀵 화면만 이용할 수 있습니다.</AlertDescription>
    </Alert>
  );
}

function useIsDongbangSelected() {
  const form = useFormContext();
  const affiliation = useStore(form.store, (state) => state.values.affiliation);
  return isDongbangAffiliation(typeof affiliation === 'string' ? affiliation : null);
}

type OrgFieldResetApi = {
  form: { setFieldValue: (name: never, value: never) => void };
};

/**
 * 소속 변경 시 조직 필드 초기화. 동방특송이면 부서·직급·리더·생일을 비우고 system_role을 user로 맞춘다.
 * `noneValue`: 승인 Sheet는 `''`, 수정 Sheet는 SELECT_NONE_VALUE.
 */
function resetOrgFieldsOnAffiliationChange(
  value: unknown,
  fieldApi: OrgFieldResetApi,
  noneValue: string
) {
  const setFieldValue = fieldApi.form.setFieldValue as (name: string, value: unknown) => void;
  setFieldValue('rank', noneValue);
  setFieldValue('position_level', noneValue);
  setFieldValue('leader_role', SELECT_NONE_VALUE);
  if (isDongbangAffiliation(typeof value === 'string' ? value : null)) {
    setFieldValue('birthday', null);
    setFieldValue('system_role', 'user');
  }
}

const LEADER_ROLE_SELECT_OPTIONS = [
  SELECT_NONE_OPTION,
  ...LEADER_ROLE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label
  }))
];

function useActiveAffiliation() {
  const form = useFormContext();
  const affiliation = useStore(form.store, (state) => state.values.affiliation);
  return affiliation === 'wake' ||
    affiliation === 'sans' ||
    affiliation === 'sans_foundry'
    ? affiliation
    : null;
}

export function UserOrgPositionFields() {
  const { FormSelectField } = useFormFields<
    UserUpdateFormValues | ApproveUserFormValues | CreateUserFormValues
  >();
  const activeAffiliation = useActiveAffiliation();

  const rankOptions = activeAffiliation
    ? toSelectOptions(ranksForUserSelect(activeAffiliation))
    : [];

  const positionOptions = activeAffiliation
    ? toSelectOptions(POSITION_LEVEL_BY_AFFILIATION[activeAffiliation])
    : [];

  return (
    <>
      <FormSelectField
        name='rank'
        label='부서/사업장'
        options={rankOptions}
        placeholder={
          activeAffiliation ? '부서/사업장 선택' : '소속을 먼저 선택해 주세요'
        }
      />
      <FormSelectField
        name='position_level'
        label='직급'
        options={positionOptions}
        placeholder={
          activeAffiliation ? '직급 선택' : '소속을 먼저 선택해 주세요'
        }
        listeners={{
          onChange: ({ value, fieldApi }) => {
            const autoRank = resolveRankFromPositionLevel(String(value ?? ''));
            if (autoRank) {
              fieldApi.form.setFieldValue('rank', autoRank);
            }
          }
        }}
      />
      <FormSelectField
        name='leader_role'
        label='리더 역할'
        options={LEADER_ROLE_SELECT_OPTIONS}
        placeholder='선택 안 함'
      />
    </>
  );
}

export function UserCreateOrgFormFields() {
  const { FormTextField, FormSelectField, FormBirthdayField } =
    useFormFields<CreateUserFormValues>();

  return (
    <div className='space-y-4'>
      <FormTextField name='full_name' label='이름' placeholder='이름' />
      <FormTextField
        name='email'
        label='이메일'
        type='email'
        placeholder='user@example.com'
      />
      <FormPhoneField
        name='phone'
        label='연락처'
        placeholder='010-0000-0000'
      />
      <FormSelectField
        name='affiliation'
        label='소속'
        options={CREATE_AFFILIATION_SELECT_OPTIONS}
        placeholder='소속 선택'
        listeners={{
          onChange: ({ fieldApi }) => {
            fieldApi.form.setFieldValue('rank', '');
            fieldApi.form.setFieldValue('position_level', '');
            fieldApi.form.setFieldValue('leader_role', SELECT_NONE_VALUE);
          }
        }}
      />
      <UserOrgPositionFields />
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

export function UserApprovalOrgFormFields() {
  const form = useFormContext();
  const { FormTextField, FormSelectField, FormBirthdayField } =
    useFormFields<ApproveUserFormValues>();
  const systemRole = useStore(form.store, (state) => state.values.system_role);
  const isAdminTarget = systemRole === 'admin';
  const isDongbangSelected = useIsDongbangSelected();

  return (
    <div className='space-y-4'>
      <FormTextField name='full_name' label='이름' placeholder='이름' />
      <FormTextField
        name='email'
        label='이메일'
        type='email'
        placeholder='user@example.com'
      />
      <FormPhoneField
        name='phone'
        label='연락처'
        placeholder='010-0000-0000'
      />
      <FormSelectField
        name='system_role'
        label='시스템 역할'
        options={SYSTEM_ROLE_OPTIONS}
        placeholder='역할 선택'
      />
      {!isAdminTarget ? (
        <>
          <FormSelectField
            name='affiliation'
            label='소속'
            options={REQUIRED_AFFILIATION_SELECT_OPTIONS}
            placeholder='소속 선택'
            listeners={{
              onChange: ({ value, fieldApi }) =>
                resetOrgFieldsOnAffiliationChange(value, fieldApi, '')
            }}
          />
          {isDongbangSelected ? (
            <DongbangNotice />
          ) : (
            <>
              <UserOrgPositionFields />
              <FormBirthdayField name='birthday' label='생일' allowUnsetToggle />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export function UserEditOrgFormFields() {
  const { FormTextField, FormSelectField, FormBirthdayField } =
    useFormFields<UserUpdateFormValues>();
  const isDongbangSelected = useIsDongbangSelected();

  return (
    <div className='space-y-4'>
      <FormTextField name='full_name' label='이름' placeholder='이름' />
      <FormPhoneField
        name='phone'
        label='연락처'
        placeholder='010-0000-0000'
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
          onChange: ({ value, fieldApi }) =>
            resetOrgFieldsOnAffiliationChange(value, fieldApi, SELECT_NONE_VALUE)
        }}
      />
      {isDongbangSelected ? <DongbangNotice /> : <UserOrgPositionFields />}
      <FormSelectField
        name='system_role'
        label='시스템 역할'
        options={SYSTEM_ROLE_OPTIONS}
        placeholder='역할 선택'
        disabled={isDongbangSelected}
        description={isDongbangSelected ? DONGBANG_SYSTEM_ROLE_DESCRIPTION : undefined}
      />
      {isDongbangSelected ? null : <FormBirthdayField name='birthday' label='생일' />}
    </div>
  );
}
