import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { hasMustChangeInitialPasswordCookie } from '@/lib/auth/must-change-cookie';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — 로그인`
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/auth/sign-in`
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },
  openGraph: {
    url: `${SITE_URL}/auth/sign-in`,
    title: `${SITE_NAME} — 로그인`,
    description: SITE_DESCRIPTION
  }
};

export default async function SignInLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();

  if (profile) {
    const cookieStore = await cookies();

    if (hasMustChangeInitialPasswordCookie(cookieStore)) {
      redirect('/auth/force-password-change');
    }

    redirect('/dashboard/overview');
  }

  return children;
}
