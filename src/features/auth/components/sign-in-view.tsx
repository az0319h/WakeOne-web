import Link from 'next/link';
import { Icons } from '@/components/icons';
import {
  SIGN_IN_DESKTOP_PANEL_FOOTER,
  SIGN_IN_INTRO_HEADING,
  SIGN_IN_INTRO_PARAGRAPHS
} from '@/features/auth/constants/sign-in-intro-copy';
import { cn } from '@/lib/utils';
import { InteractiveGridPattern } from './interactive-grid';
import UserAuthForm from './user-auth-form';

function SignInIntroCopy({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <h2 className='text-base font-semibold tracking-tight lg:text-lg'>{SIGN_IN_INTRO_HEADING}</h2>
      {SIGN_IN_INTRO_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph} className='text-muted-foreground text-sm leading-relaxed lg:text-base'>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export default function SignInViewPage() {
  return (
    <main className='bg-background relative min-h-screen overflow-hidden lg:grid lg:grid-cols-2'>
      <section
        aria-label='WakeOne 소개'
        className='relative hidden h-full min-h-screen flex-col p-10 lg:flex dark:border-r'
      >
        <div className='absolute inset-0 bg-sidebar' />
        <div className='text-sidebar-foreground relative z-20 flex items-center text-lg font-medium'>
          <Icons.logo className='mr-2 h-6 w-6' />
          WakeOne
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
        <div className='text-sidebar-foreground relative z-20 mt-auto space-y-3'>
          <SignInIntroCopy className='[&_p]:text-sidebar-foreground/90 [&_h2]:text-sidebar-foreground' />
          <footer className='text-sidebar-foreground/70 text-sm'>
            {SIGN_IN_DESKTOP_PANEL_FOOTER}
          </footer>
        </div>
      </section>
      <div className='flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
        <div className='flex w-full max-w-sm flex-col items-center justify-center space-y-6 sm:max-w-md'>
          <section aria-label='WakeOne 소개' className='w-full lg:hidden'>
            <SignInIntroCopy />
          </section>
          <section aria-label='로그인 폼' className='flex w-full flex-col items-center space-y-6'>
            <div className='w-full space-y-2 text-center'>
              <h1 className='text-2xl font-semibold tracking-tight'>로그인</h1>
              <p className='text-muted-foreground text-sm'>
                아이디와 비밀번호로 로그인하세요.
              </p>
            </div>
            <UserAuthForm />
            <p className='text-muted-foreground px-2 text-center text-sm sm:px-8'>
              계속하면{' '}
              <Link
                href='/terms-of-service'
                className='hover:text-primary underline underline-offset-4'
              >
                이용약관
              </Link>{' '}
              및{' '}
              <Link
                href='/privacy-policy'
                className='hover:text-primary underline underline-offset-4'
              >
                개인정보처리방침
              </Link>
              에 동의하는 것으로 간주합니다.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
