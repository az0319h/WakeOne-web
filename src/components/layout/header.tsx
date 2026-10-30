import React from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';
import { Breadcrumbs } from '../breadcrumbs';
import SearchInput from '../search-input';
import { ThemeSelector } from '../themes/theme-selector';
import { ThemeModeToggle } from '../themes/theme-mode-toggle';
import { NotificationCenter } from '@/features/notifications/components/notification-center';
import { QuickMobileBackButton } from '@/features/quick-request/components/mobile/quick-mobile-back-button';

/**
 * 앱 공통 상단바.
 * - plan 106 D-3 — lg 미만(휴대폰·태블릿 터치)에서 사이드바·테마·알림 버튼 44px (lg 이상 크기 불변 · ui 수정 없이 className만).
 * - plan 106 D-1 「태블릿 768~1023 = 휴대폰 규칙」 — lg 미만은 검색칸·테마 프리셋 선택을 숨기고 breadcrumb는 마지막 항목만
 *   한 줄 말줄임(`Breadcrumbs`) → 사이드바를 펼친 T768에서도 상단바가 넘치지 않는다. lg 이상은 그대로.
 * - plan 106 D-4 — 퀵 하위 화면(요청 폼·상세)은 lg 미만에서 「뒤로」 슬롯(`QuickMobileBackButton`)이 붙는다.
 * - `data-app-header`: 퀵 전체 화면 대화(`data-quick-fullscreen`)에서 전역 CSS가 숨긴다(globals.css).
 * - `role='banner'`: `SidebarInset`이 `<main>`이라 `<header>`의 암묵 banner 역할이 사라지므로 명시한다.
 */
export default function Header() {
  return (
    <header
      role='banner'
      data-app-header
      className='bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 backdrop-blur-md md:h-14'
    >
      <div className='flex items-center gap-2 px-4 max-lg:min-w-0'>
        <SidebarTrigger className='-ml-1 size-11 lg:size-7' />
        <Separator orientation='vertical' className='mr-2 h-4' />
        <QuickMobileBackButton />
        <Breadcrumbs />
      </div>

      <div className='flex items-center gap-2 px-4'>
        <div className='hidden lg:flex'>
          <SearchInput />
        </div>
        <ThemeModeToggle />
        <div className='hidden lg:block'>
          <ThemeSelector />
        </div>
        <NotificationCenter />
      </div>
    </header>
  );
}
