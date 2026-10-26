'use client';

import { useEffect, useState } from 'react';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  isIosBannerDismissActive,
  isIosDevice,
  isStandaloneDisplay,
  readIosBannerDismissedAt,
  writeIosBannerDismissedAt
} from '../lib/push-client';
import { IosInstallGuideDialog } from './ios-install-guide-dialog';

/**
 * plan 91 — dashboard 상단 iOS 안내 배너.
 * 조건: iPhone/iPad UA · 홈 화면 미설치(standalone 아님) · 닫기 기록 없음 또는 7일 경과.
 * mount 전에는 null(하이드레이션 안전).
 */
export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!isIosDevice() || isStandaloneDisplay()) return;
    if (isIosBannerDismissActive(readIosBannerDismissedAt())) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    writeIosBannerDismissedAt();
    setVisible(false);
  }

  return (
    <>
      <Alert
        data-testid='ios-install-banner'
        aria-live='polite'
        className='relative mx-4 mt-2 w-auto pr-10'
      >
        <Icons.smartphone aria-hidden />
        <AlertDescription className='w-full gap-2'>
          <p>홈 화면에 추가하면 알림을 받을 수 있어요</p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            data-testid='ios-install-guide-open'
            onClick={() => setGuideOpen(true)}
          >
            방법 보기
          </Button>
        </AlertDescription>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label='닫기'
          data-testid='ios-install-banner-dismiss'
          className='absolute top-2 right-2 size-7'
          onClick={handleDismiss}
        >
          <Icons.close className='size-4' />
        </Button>
      </Alert>
      <IosInstallGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
