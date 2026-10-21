'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';
import { QuickRequestSummaryContent } from './quick-request-summary-content';

type QuickRequestConfirmBoardProps = {
  values: QuickRequestFormValues;
  isSubmitting: boolean;
  onRegister: () => void;
};

/** 데스크톱(lg↑) 우측 요약 패널 — 본문 내부 스크롤 · 하단 CTA 고정 */
export function QuickRequestConfirmBoard({
  values,
  isSubmitting,
  onRegister
}: QuickRequestConfirmBoardProps) {
  return (
    <aside
      aria-labelledby='quick-request-summary-title'
      className='hidden min-h-0 lg:flex lg:max-h-full lg:flex-col lg:self-start'
    >
      <Card
        data-testid='quick-request-summary'
        className='min-h-0 gap-0 overflow-hidden py-0'
      >
        <CardHeader className='border-b px-5 py-4 [.border-b]:pb-4'>
          <h3 id='quick-request-summary-title' className='text-base font-semibold text-foreground'>
            요청 요약
          </h3>
        </CardHeader>
        <CardContent className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4'>
          <QuickRequestSummaryContent values={values} />
        </CardContent>
        <CardFooter className='border-t p-5 [.border-t]:pt-5'>
          <Button
            type='button'
            size='lg'
            className='h-12 w-full'
            isLoading={isSubmitting}
            data-testid='quick-request-register-button'
            onClick={onRegister}
          >
            퀵 요청 등록하기
          </Button>
        </CardFooter>
      </Card>
    </aside>
  );
}
