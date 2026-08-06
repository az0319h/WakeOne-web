import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wakeone.site';

export const SITE_NAME = 'WakeOne - 내부 통합 업무 대시보드';

export const SITE_DESCRIPTION =
  'WakeOne은 Wake Corp 팀을 위한 내부 통합 업무 대시보드입니다. ' +
  '계약서·첨부 관리, 사용자 및 권한(RBAC), 활동 감사 로그, 실시간 알림, ' +
  '독촉 이메일 발송 이력, 지갑·생일 등 운영에 필요한 기능을 ' +
  '하나의 웹에서 안전하게 이용할 수 있습니다. ' +
  '관리자가 등록한 계정으로 로그인하여 조직 업무를 효율적으로 수행하세요.';

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
