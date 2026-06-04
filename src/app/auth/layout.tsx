import { redirect } from 'next/navigation';
import { getSessionUser } from '@/features/auth/api/session.server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (user) {
    redirect('/dashboard/overview');
  }

  return <div className='bg-background min-h-screen'>{children}</div>;
}
