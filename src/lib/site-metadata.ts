import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wakeone.site';

export const SITE_NAME = 'WakeOne | Wake Corp';

export const SITE_DESCRIPTION =
  '(주)웨이크 임직원을 위한 내부 시스템. 본인의 식대 잔액과 동료 생일을 빠르게 확인하세요.';

export const SITE_KEYWORDS = [
  'WakeOne',
  'Wake Corp',
  '내부 대시보드',
  '주식회사 웨이크',
  '산스',
  '커피',
  '(주)웨이크',
  '잔액조회',
];

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    absolute: SITE_NAME
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: 'WakeOne Team' }],
  creator: 'Wake Corp',
  publisher: 'Wake Corp',
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/assets/opengraph-image.png',
        width: 1376,
        height: 768,
        alt: `${SITE_NAME} — Wake Corp 내부 업무 대시보드`
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/assets/opengraph-image.png']
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  },
  alternates: {
    canonical: SITE_URL
  },
  icons: {
    icon: [{ url: '/assets/favicon.ico', type: 'image/x-icon' }],
    shortcut: [{ url: '/assets/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/assets/favicon.ico', type: 'image/x-icon' }]
  }
};
