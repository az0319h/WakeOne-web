import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/features/auth/api/session.server';

export default async function Page() {
  const profile = await getSessionProfile();

  if (profile) {
    redirect('/dashboard/overview');
  }

  redirect('/auth/sign-in');
}
