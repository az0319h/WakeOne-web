'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { pushPreferencesQueryOptions } from '../api/push-queries';
import { usePushDeviceStatus } from '../hooks/use-push-device-status';
import {
  PUSH_STATUS_DENIED_TEXT,
  PUSH_STATUS_NOT_CONFIGURED_TEXT
} from './push-status-texts';

const PROFILE_PUSH_HREF = '/dashboard/profile#push';
const LINK_CLASS = 'text-foreground font-medium underline underline-offset-4';

function PushStatusBannerContent() {
  const { data } = useSuspenseQuery(pushPreferencesQueryOptions());
  const { status } = usePushDeviceStatus(data);

  if (status === 'loading') return null;

  let message: string;
  let link: { href: string; label: string } | null = null;

  switch (status) {
    case 'on':
      message = '휴대폰 알림이 켜져 있어요';
      link = { href: PROFILE_PUSH_HREF, label: '프로필에서 관리' };
      break;
    case 'denied':
      message = PUSH_STATUS_DENIED_TEXT;
      break;
    case 'not_configured':
      message = PUSH_STATUS_NOT_CONFIGURED_TEXT;
      break;
    default:
      message = '휴대폰 알림을 켜면 사이트를 열지 않아도 알림을 받을 수 있어요';
      link = { href: PROFILE_PUSH_HREF, label: '켜기' };
  }

  return (
    <Alert data-testid='push-status-banner' aria-live='polite' className='bg-muted/50'>
      <Icons.notification aria-hidden />
      <AlertDescription className='flex w-full flex-row flex-wrap items-center gap-x-3 gap-y-1'>
        <span>{message}</span>
        {link ? (
          <Link href={link.href} className={LINK_CLASS} data-testid='push-status-banner-link'>
            {link.label}
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** plan 91 — 알림 페이지 툴바 위 상태 배너(본인 조회 시만 · 닫기 없음). mount 전·로딩 중 null. */
export function PushStatusBanner() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <PushStatusBannerContent />
    </Suspense>
  );
}
