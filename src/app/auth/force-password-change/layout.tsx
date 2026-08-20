import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { hasMustChangeInitialPasswordCookie } from '@/lib/auth/must-change-cookie';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — 비밀번호 변경`
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/auth/force-password-change`
  },
  robots: {
    index: false,
    follow: false
  }
};

export default async function ForcePasswordChangeLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  const cookieStore = await cookies();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  if (!hasMustChangeInitialPasswordCookie(cookieStore)) {
    redirect('/auth/sign-in');
  }

  return children;
}
