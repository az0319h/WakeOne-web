'use client';

import { useTransition } from 'react';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import GithubSignInButton from './github-auth-button';

const formSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' })
});

interface UserAuthFormProps {
  submitLabel?: string;
  successMessage?: string;
}

export default function UserAuthForm({
  submitLabel = 'Continue With Email',
  successMessage = 'Auth UI is ready. Connect Supabase sign-in next.'
}: UserAuthFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useAppForm({
    defaultValues: {
      email: 'demo@gmail.com'
    },
    validators: {
      onSubmit: formSchema
    },
    onSubmit: () => {
      startTransition(() => {
        toast.success(successMessage);
      });
    }
  });

  return (
    <>
      <form.AppForm>
        <form.Form className='w-full space-y-2'>
          <form.AppField
            name='email'
            children={(field) => (
              <field.FieldSet>
                <field.Field>
                  <field.FieldLabel htmlFor={field.name}>Email</field.FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder='Enter your email...'
                    disabled={isPending}
                    aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  />
                </field.Field>
                <field.FieldError />
              </field.FieldSet>
            )}
          />
          <Button isLoading={isPending} className='mt-2 ml-auto w-full' type='submit'>
            {submitLabel}
          </Button>
        </form.Form>
      </form.AppForm>
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background text-muted-foreground px-2'>Or continue with</span>
        </div>
      </div>
      <GithubSignInButton />
    </>
  );
}
