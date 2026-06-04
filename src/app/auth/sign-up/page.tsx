import type { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';

export const metadata: Metadata = {
  title: 'Authentication | Sign Up',
  description: 'Sign Up page with preserved WakeOne auth UI shell.'
};

export default function SignUpPage() {
  return <SignUpViewPage />;
}
