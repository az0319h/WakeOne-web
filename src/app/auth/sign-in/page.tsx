import type { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'Authentication | Sign In',
  description: 'Sign In page with preserved WakeOne auth UI shell.'
};

export default function SignInPage() {
  return <SignInViewPage />;
}
