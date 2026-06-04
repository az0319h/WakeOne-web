import type { Metadata } from 'next';
import Link from 'next/link';
import SetPasswordForm from '@/features/auth/components/set-password-form';

export const metadata: Metadata = {
  title: '비밀번호 설정 | WakeOne',
  description: '초대 계정의 최초 비밀번호를 설정합니다.'
};

export default function SetPasswordPage() {
  return (
    <div className='flex min-h-screen items-center justify-center px-4 py-12'>
      <div className='flex w-full max-w-sm flex-col items-center space-y-6'>
        <div className='w-full space-y-2 text-center'>
          <h1 className='text-2xl font-semibold tracking-tight'>비밀번호 설정</h1>
          <p className='text-muted-foreground text-sm'>
            초대를 수락하셨습니다. 대시보드 이용을 위해 비밀번호를 설정해 주세요.
          </p>
        </div>
        <SetPasswordForm />
        <p className='text-muted-foreground text-center text-sm'>
          이미 비밀번호를 설정하셨나요?{' '}
          <Link href='/auth/sign-in' className='hover:text-primary underline underline-offset-4'>
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
