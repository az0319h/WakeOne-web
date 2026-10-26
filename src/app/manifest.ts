import type { MetadataRoute } from 'next';
import { META_THEME_COLORS } from '@/components/themes/theme-color-sync';

/** plan 91 — PWA manifest (`/manifest.webmanifest`). 아이콘은 designer 산출 `public/icons/*`. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'WakeOne',
    short_name: 'WakeOne',
    description: '(주)웨이크 임직원을 위한 내부 시스템',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ko',
    theme_color: META_THEME_COLORS.light,
    background_color: META_THEME_COLORS.light,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
