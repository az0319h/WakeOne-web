import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/features/auth/api/session.server';

export default async function ForgotPasswordLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  if (profile) {
    redirect('/dashboard/overview');
  }

  return children;
}
