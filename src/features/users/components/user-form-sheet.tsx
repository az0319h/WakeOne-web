'use client';

import { useMemo, useState } from 'react';
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
import { Icons } from '@/components/icons';
import { useMutation } from '@tanstack/react-query';
import { createUserMutation, updateUserMutation } from '../api/mutations';
import type { User } from '../api/types';
import { toast } from 'sonner';
import * as z from 'zod';
import { userSchema, type UserFormValues } from '../schemas/user';
import {
  DEPARTMENT_OPTIONS_BY_ORG,
  INVITE_STATUS_OPTIONS,
  ORG_ROLE_OPTIONS,
  ORGANIZATION_OPTIONS,
  SYSTEM_ROLE_OPTIONS
} from './users-table/options';
import { useStore } from '@tanstack/react-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldLabel } from '@/components/ui/field';

interface UserFormSheetProps {
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const isEdit = !!user;
  const [apiError, setApiError] = useState<string | null>(null);

  const createMutation = useMutation({
    ...createUserMutation,
    onSuccess: () => {
      toast.success('User created successfully');
      onOpenChange(false);
      form.reset();
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      setApiError(message);
      toast.error(message);
    }
  });

  const updateMutation = useMutation({
    ...updateUserMutation,
    onSuccess: () => {
      toast.success('User updated successfully');
      onOpenChange(false);
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      setApiError(message);
      toast.error(message);
    }
  });

  const form = useAppForm({
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      system_role: user?.system_role ?? 'user',
      organization: user?.organization ?? 'wake',
      department: user?.department ?? '',
      org_role: user?.org_role ?? 'member',
      invite_status: user?.invite_status ?? 'pending'
    } as UserFormValues,
    validators: {
      onSubmit: userSchema
    },
    onSubmit: async ({ value }) => {
      setApiError(null);
      if (isEdit) {
        await updateMutation.mutateAsync({ id: user.id, values: value });
      } else {
        await createMutation.mutateAsync(value);
      }
    }
  });

  const { FormTextField, FormSelectField } = useFormFields<UserFormValues>();
  const organization = useStore(form.store, (state) => state.values.organization);
  const departmentOptions = useMemo(() => {
    return DEPARTMENT_OPTIONS_BY_ORG[organization] ?? [];
  }, [organization]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit User' : 'New User'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the user details below.'
              : 'Fill in the details to create a new user.'}
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600'>
            {apiError}
          </div>
        ) : null}

        <div className='flex-1 overflow-auto'>
          <form.AppForm>
            <form.Form id='user-form-sheet' className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <FormTextField
                  name='first_name'
                  label='First Name'
                  required
                  placeholder='John'
                  validators={{
                    onBlur: z.string().min(2, 'First name must be at least 2 characters')
                  }}
                />
                <FormTextField
                  name='last_name'
                  label='Last Name'
                  required
                  placeholder='Doe'
                  validators={{
                    onBlur: z.string().min(2, 'Last name must be at least 2 characters')
                  }}
                />
              </div>

              <FormTextField
                name='email'
                label='Email'
                required
                type='email'
                placeholder='john@example.com'
                validators={{
                  onBlur: z.string().email('Please enter a valid email')
                }}
              />

              <FormTextField
                name='phone'
                label='Phone'
                required
                type='tel'
                placeholder='(555) 123-4567'
                validators={{
                  onBlur: z.string().min(1, 'Phone number is required')
                }}
              />

              <FormSelectField
                name='system_role'
                label='System Role'
                required
                options={SYSTEM_ROLE_OPTIONS}
                placeholder='Select system role'
                validators={{
                  onBlur: z.string().min(1, 'Please select a system role')
                }}
              />

              <FormSelectField
                name='organization'
                label='Organization'
                required
                options={ORGANIZATION_OPTIONS}
                placeholder='Select organization'
                validators={{
                  onBlur: z.string().min(1, 'Please select an organization')
                }}
              />

              <form.AppField
                name='department'
                validators={{
                  onBlur: z.string().min(1, 'Please select a department')
                }}
              >
                {(field) => (
                  <div className='space-y-2'>
                    <FieldLabel htmlFor='department'>
                      Department <span>*</span>
                    </FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      onOpenChange={(open) => {
                        if (!open) field.handleBlur();
                      }}
                      disabled={departmentOptions.length === 0}
                    >
                      <SelectTrigger id='department' aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                        <SelectValue
                          placeholder={
                            departmentOptions.length === 0
                              ? 'No department available'
                              : 'Select department'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.state.meta.errors.length > 0 ? (
                      <p className='text-destructive text-sm'>{String(field.state.meta.errors[0])}</p>
                    ) : null}
                  </div>
                )}
              </form.AppField>

              <FormSelectField
                name='org_role'
                label='Organization Role'
                required
                options={ORG_ROLE_OPTIONS}
                placeholder='Select organization role'
                validators={{
                  onBlur: z.string().min(1, 'Please select an organization role')
                }}
              />

              <FormSelectField
                name='invite_status'
                label='Invite Status'
                required
                options={INVITE_STATUS_OPTIONS}
                placeholder='Select invite status'
                validators={{
                  onBlur: z.string().min(1, 'Please select an invite status')
                }}
              />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='submit' form='user-form-sheet' isLoading={isPending}>
            <Icons.check /> {isEdit ? 'Update User' : 'Create User'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function UserFormSheetTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Add User
      </Button>
      <UserFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
