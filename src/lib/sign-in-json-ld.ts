import { SIGN_IN_DESCRIPTION, SITE_URL } from '@/lib/site-metadata';

export function buildSignInJsonLd(siteUrl: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: '주식회사 웨이크',
        alternateName: ['Wake Corp', 'WakeOne', '웨이크원'],
        url: siteUrl,
        logo: `${siteUrl}/assets/opengraph-image.png`
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'WakeOne',
        description: SIGN_IN_DESCRIPTION,
        publisher: { '@id': `${siteUrl}/#organization` },
        inLanguage: 'ko-KR'
      }
    ]
  };
}
