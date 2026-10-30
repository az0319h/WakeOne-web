'use client';

import { usePathname } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { isQuickSubPagePath, QUICK_LIST_PATH } from '../../lib/quick-mobile-routes';
import { QUICK_MOBILE_TEXT } from './quick-mobile-constants';
import { useQuickBack } from './use-quick-back';

/**
 * plan 106 D-4 · designer §2.2 — 공통 상단바 「뒤로」 슬롯 (`Header` 안 · lg 미만만 보임).
 * 요청 폼·상세에서만 그린다. 둘 다 부모는 「퀵 내역」 — 바로 들어온 화면이면 `/dashboard/quick`으로 replace (§7).
 */
export function QuickMobileBackButton() {
  const pathname = usePathname();

  if (!isQuickSubPagePath(pathname)) return null;

  return <QuickMobileBackButtonInner />;
}

function QuickMobileBackButtonInner() {
  const goBack = useQuickBack(QUICK_LIST_PATH);

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      aria-label={QUICK_MOBILE_TEXT.back}
      data-testid='quick-mobile-back'
      className='-mr-1 -ml-2 size-11 touch-manipulation lg:hidden'
      onClick={goBack}
    >
      <Icons.chevronLeft aria-hidden className='size-5' />
    </Button>
  );
}
