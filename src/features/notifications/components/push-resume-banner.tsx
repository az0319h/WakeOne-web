'use client';

import { useId } from 'react';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PUSH_RESUME_BANNER_TEXT, PUSH_RESUME_ENABLE_LABEL } from './push-status-texts';

interface PushResumeBannerProps {
  /** 「다시 켜기」 진행 중 — 버튼 Spinner · 닫기 disabled */
  isPending: boolean;
  /** onClick 안에서 바로 mutate()를 부른다(사용자 제스처 유지 · await·Dialog 금지) */
  onEnable: () => void;
  onDismiss: () => void;
}

/**
 * plan 105 — 자동 복구 실패 시 dashboard 상단 안내 줄 (표시 전용 · 판정은 `PushResumeSync`).
 * `IosInstallBanner`와 같은 Alert 모양 + 모바일 44px 터치 · `text-card-foreground`(WCAG AA) · `md:mx-6`(본문 좌우선).
 */
export function PushResumeBanner({ isPending, onEnable, onDismiss }: PushResumeBannerProps) {
  const messageId = useId();

  return (
    <Alert
      data-testid='push-resume-banner'
      aria-live='polite'
      className='relative mx-4 mt-2 w-auto pr-12 md:mx-6 md:pr-10'
    >
      <Icons.notification aria-hidden />
      <AlertDescription className='text-card-foreground w-full gap-2'>
        <p id={messageId} className='text-balance break-keep wrap-break-word'>
          {PUSH_RESUME_BANNER_TEXT}
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-11 md:h-8'
          data-testid='push-resume-enable'
          aria-describedby={messageId}
          isLoading={isPending}
          onClick={onEnable}
        >
          {PUSH_RESUME_ENABLE_LABEL}
        </Button>
      </AlertDescription>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label='닫기'
        data-testid='push-resume-dismiss'
        disabled={isPending}
        className='absolute top-0.5 right-0.5 size-11 md:top-2 md:right-2 md:size-7'
        onClick={onDismiss}
      >
        <Icons.close aria-hidden className='size-4' />
      </Button>
    </Alert>
  );
}
