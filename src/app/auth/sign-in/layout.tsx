import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { hasMustChangeInitialPasswordCookie } from '@/lib/auth/must-change-cookie';
import { buildSignInJsonLd } from '@/lib/sign-in-json-ld';
import {
  SIGN_IN_DESCRIPTION,
  SIGN_IN_KEYWORDS,
  SIGN_IN_PAGE_TITLE,
  SITE_URL
} from '@/lib/site-metadata';

const signInUrl = `${SITE_URL}/auth/sign-in`;

export const metadata: Metadata = {
  title: {
    absolute: SIGN_IN_PAGE_TITLE
  },
  description: SIGN_IN_DESCRIPTION,
  keywords: SIGN_IN_KEYWORDS,
  alternates: {
    canonical: signInUrl
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
    url: signInUrl,
    title: SIGN_IN_PAGE_TITLE,
    description: SIGN_IN_DESCRIPTION,
    images: [
      {
        url: '/assets/opengraph-image.png',
        width: 1376,
        height: 768,
        alt: 'WakeOne 로그인 — 주식회사 웨이크 임직원 포털'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: SIGN_IN_PAGE_TITLE,
    description: SIGN_IN_DESCRIPTION,
    images: ['/assets/opengraph-image.png']
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

  const jsonLd = buildSignInJsonLd();

  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
