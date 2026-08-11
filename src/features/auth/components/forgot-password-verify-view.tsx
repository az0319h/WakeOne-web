import Link from 'next/link';
import { ForgotPasswordVerifyForm } from './forgot-password-verify-form';
import { InteractiveGridPattern } from './interactive-grid';
import { cn } from '@/lib/utils';

interface ForgotPasswordVerifyViewProps {
  email: string;
}

export function ForgotPasswordVerifyView({ email }: ForgotPasswordVerifyViewProps) {
  return (
    <div className='bg-background relative min-h-screen overflow-hidden lg:grid lg:grid-cols-2'>
      <div className='relative hidden h-full min-h-screen flex-col p-10 lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-sidebar' />
        <div className='text-sidebar-foreground relative z-20 flex items-center text-lg font-medium'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='mr-2 h-6 w-6'
          >
            <path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' />
          </svg>
          WakeOne
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
        <div className='text-sidebar-foreground relative z-20 mt-auto'>
          <blockquote className='space-y-2'>
            <p className='text-lg'>
              &ldquo;이메일로 받은 6자리 인증번호를 입력해 주세요.&rdquo;
            </p>
            <footer className='text-sidebar-foreground/70 text-sm'>WakeOne Team</footer>
          </blockquote>
        </div>
      </div>
      <div className='flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
        <div className='flex w-full max-w-sm flex-col items-center justify-center space-y-6 sm:max-w-md'>
          <div className='w-full space-y-2 text-center'>
            <h1 className='text-2xl font-semibold tracking-tight'>인증번호 확인</h1>
            <p className='text-muted-foreground text-sm'>
              {email}로 보낸 6자리 인증번호를 입력해 주세요.
            </p>
            <p className='text-muted-foreground text-xs'>
              메일이 보이지 않으면 스팸함(정크 메일)도 확인해 주세요.
            </p>
          </div>
          <ForgotPasswordVerifyForm email={email} />
          <p className='text-center text-sm'>
            <Link
              href='/auth/sign-in'
              className='text-muted-foreground hover:text-primary underline-offset-4 hover:underline'
            >
              로그인으로 돌아가기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
