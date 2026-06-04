import { redirect } from 'next/navigation';
import { getSessionUser } from '@/features/auth/api/session.server';

export default async function Page() {
  const user = await getSessionUser();

  if (user) {
    redirect('/dashboard/overview');
  }

  redirect('/auth/sign-in');
}
