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

export const SIGN_IN_PAGE_TITLE =
  'WakeOne 로그인 | 웨이크원 · 주식회사 웨이크 임직원 포털';

export const SIGN_IN_DESCRIPTION =
  'WakeOne(웨이크원)은 주식회사 웨이크(Wake Corp) 임직원을 위한 내부 업무 포털입니다. wakecorp.com 계정으로 wakeone 로그인·웨이크원 로그인·wakecorp 로그인을 통해 대시보드에 접속하세요.';

export const SIGN_IN_KEYWORDS = [
  'WakeOne',
  '웨이크원',
  'wakeone 로그인',
  '웨이크원 로그인',
  'wakecorp 로그인',
  '웨이크 임직원',
  '주식회사 웨이크',
  '(주)웨이크',
  'Wake Corp',
  'wakecorp.com',
  '웨이크원 포털',
  'WakeOne 로그인',
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
  // plan 91 — PWA
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'WakeOne',
    statusBarStyle: 'default'
  },
  // Next 16은 `mobile-web-app-capable`만 출력 — iOS Safari 홈 화면 standalone 판정용 apple 메타를 명시 (AC-03)
  other: {
    'apple-mobile-web-app-capable': 'yes'
  },
  icons: {
    icon: [{ url: '/assets/favicon.ico', type: 'image/x-icon' }],
    shortcut: [{ url: '/assets/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }]
  }
};
