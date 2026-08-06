import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wakeone.site';

export const SITE_NAME = 'WakeOne — 웨이크 팀 업무 포털';

export const SITE_DESCRIPTION =
  'WakeOne은 웨이크(Wake Corp) 팀원이 일상 업무를 한곳에서 처리하는 업무 포털입니다. ' +
  '첨부 파일 관리, 업무 알림, 지갑·프로필 확인 등 ' +
  '필요한 기능을 웹에서 편리하게 이용할 수 있습니다. ' +
  '등록된 계정으로 로그인해 팀 업무를 시작하세요.';

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
        alt: `${SITE_NAME} 미리보기 이미지`
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
