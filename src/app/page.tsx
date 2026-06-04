import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/features/auth/api/session.server';

export default async function Page() {
  const profile = await getSessionProfile();

  if (profile) {
    if (!profile.password_set_at) {
      redirect('/auth/set-password');
    }
    redirect('/dashboard/overview');
  }

  redirect('/auth/sign-in');
}
