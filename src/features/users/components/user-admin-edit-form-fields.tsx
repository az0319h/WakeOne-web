'use client';

import { useFormFields } from '@/components/ui/tanstack-form';
import { ReadOnlyField } from '@/features/auth/components/profile-display';
import type { AdminUserUpdateFormValues } from '../schemas/user';
import { SYSTEM_ROLE_OPTIONS } from './users-table/options';

interface UserAdminEditFormFieldsProps {
  fullName: string;
}

export function UserAdminEditFormFields({ fullName }: UserAdminEditFormFieldsProps) {
  const { FormTextField, FormSelectField } =
    useFormFields<AdminUserUpdateFormValues>();

  return (
    <div className='space-y-4'>
      <ReadOnlyField label='이름' value={fullName} />
      <FormTextField
        name='avatar_url'
        label='아바타 URL'
        type='url'
        placeholder='https://example.com/avatar.png'
      />
      <FormSelectField
        name='system_role'
        label='시스템 역할'
        options={SYSTEM_ROLE_OPTIONS}
        placeholder='역할 선택'
      />
    </div>
  );
}
