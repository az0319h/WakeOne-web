import { ImageResponse } from 'next/og';

import { SITE_NAME } from '@/lib/site-metadata';

export const alt = `${SITE_NAME} — Wake Corp 내부 업무 대시보드`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 24,
            background: '#3b82f6',
            marginBottom: 32,
            fontSize: 48,
            fontWeight: 700
          }}
        >
          W
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.02em' }}>{SITE_NAME}</div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.4
          }}
        >
          Wake Corp 내부 통합 업무 대시보드
        </div>
      </div>
    ),
    { ...size }
  );
}
