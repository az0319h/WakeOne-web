import { ImageResponse } from 'next/og';

import { SITE_NAME } from '@/lib/site-metadata';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          borderRadius: 36,
          color: '#ffffff',
          fontSize: 96,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif'
        }}
        aria-label={SITE_NAME}
      >
        W
      </div>
    ),
    { ...size }
  );
}
