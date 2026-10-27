'use client';

import { useEffect, useRef } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

/** 마운트 후 window.print() 1회 (StrictMode 중복 방지 ref 가드) */
export function WorkflowPrintTrigger() {
  const printedRef = useRef(false);
  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

/** 화면 전용 툴바 (인쇄 시 숨김) */
export function WorkflowPrintToolbar() {
  return (
    <div className='mb-6 flex justify-end gap-2 print:hidden'>
      <Button type='button' variant='outline' className='h-10' onClick={() => window.close()}>
        닫기
      </Button>
      <Button type='button' className='h-10' onClick={() => window.print()}>
        <Icons.printer aria-hidden />
        인쇄
      </Button>
    </div>
  );
}
