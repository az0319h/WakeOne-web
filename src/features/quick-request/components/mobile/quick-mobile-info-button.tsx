'use client';

import { InfoButton } from '@/components/ui/info-button';
import { cn } from '@/lib/utils';
import { quickInfoContent } from '../../info-content';
import { QUICK_MOBILE_TEXT } from './quick-mobile-constants';

type QuickMobileInfoButtonProps = {
  /** 위치 보정용 (예: `ml-auto` · `-mr-2`). 크기·lg 숨김은 컴포넌트가 정한다 */
  className?: string;
};

/**
 * plan 106 D-2 · U-2 · designer §2.4 — 휴대폰 ⓘ 「퀵 권한 안내」 (lg 미만에서만 보임 · 44px).
 * 큰 제목이 숨으므로 본문 첫 줄(내역 메타바 오른쪽 · 상세 상태 카드 오른쪽 위 · 대화 목록 머리 오른쪽)에 둔다.
 * 상단바에는 두지 않는다 — `InfobarProvider`가 본문만 감싸서 패널 context가 없다(plan F-3).
 * PC(lg 이상)는 `PageContainer` 제목 옆 기존 ⓘ 그대로.
 */
export function QuickMobileInfoButton({ className }: QuickMobileInfoButtonProps) {
  return (
    <InfoButton
      content={quickInfoContent}
      aria-label={QUICK_MOBILE_TEXT.infoButton}
      data-testid='quick-mobile-info-button'
      className={cn('size-11 touch-manipulation lg:hidden', className)}
    />
  );
}
