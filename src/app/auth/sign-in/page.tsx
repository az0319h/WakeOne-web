import type { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: '로그인 | WakeOne',
  description: 'WakeOne 이메일·비밀번호 로그인'
};

export default function SignInPage() {
  return <SignInViewPage />;
}
