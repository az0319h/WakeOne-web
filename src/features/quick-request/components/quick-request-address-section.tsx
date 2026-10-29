'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { emptyStopoverLocation } from '../lib/default-form-values';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestLocationSection } from './quick-request-location-section';
import { QuickRequestSectionShell } from './quick-request-section-shell';
import { QuickRequestRouteDot, type QuickRequestRouteKind } from './quick-request-summary-content';

type QuickRequestRouteBlockProps = {
  kind: QuickRequestRouteKind;
  title: string;
  action?: ReactNode;
  isLast?: boolean;
  children: ReactNode;
};

function QuickRequestRouteBlock({
  kind,
  title,
  action,
  isLast,
  children
}: QuickRequestRouteBlockProps) {
  return (
    <div className='min-w-0'>
      <div className='flex min-h-11 items-center gap-3'>
        <QuickRequestRouteDot kind={kind} />
        <h4 className='text-sm font-semibold text-foreground'>{title}</h4>
        {action}
      </div>
      <div
        className={cn(
          'ml-1 min-w-0 border-l-2 pl-5',
          isLast ? 'border-transparent' : 'border-border pb-4'
        )}
      >
        {children}
      </div>
    </div>
  );
}

type QuickRequestAddressSectionProps = {
  form: QuickRequestOrderForm;
  /** 주소 검색 Dialog 「최근 이용 내역」 탭 (기본 true · plan 89 수정 Sheet는 false) */
  showRecentAddresses?: boolean;
  /** plan 99 — 주소 검색 Dialog 「장소 검색」 탭 (기본 false · 수정 Sheet는 전달하지 않음) */
  placeSearchEnabled?: boolean;
};

export function QuickRequestAddressSection({
  form,
  showRecentAddresses = true,
  placeSearchEnabled = false
}: QuickRequestAddressSectionProps) {
  return (
    <form.AppField name='stopovers' mode='array'>
      {(field) => {
        const stopovers = field.state.value as QuickRequestFormValues['stopovers'];
        return (
          <QuickRequestSectionShell
            id='quick-request-section-address'
            title='주소 정보'
            action={
              <Button
                type='button'
                variant='outline'
                className='min-h-11 rounded-full px-4'
                data-testid='quick-request-add-stopover'
                onClick={() => field.pushValue(emptyStopoverLocation())}
              >
                <Icons.add className='size-4' aria-hidden />
                경유지 추가
              </Button>
            }
          >
            <Card className='min-w-0 gap-0 p-4 shadow-none sm:p-5'>
              <QuickRequestRouteBlock kind='origin' title='출발지'>
                <QuickRequestLocationSection
                  form={form}
                  fieldPrefix='origin'
                  idPrefix='quick-request-origin'
                  showRecent={showRecentAddresses}
                  placeSearchEnabled={placeSearchEnabled}
                />
              </QuickRequestRouteBlock>

              {stopovers.map((_, index) => (
                <QuickRequestRouteBlock
                  key={index}
                  kind='stopover'
                  title={`경유지 ${index + 1}`}
                  action={
                    <Button
                      type='button'
                      variant='ghost'
                      className='ml-auto min-h-11'
                      aria-label={`경유지 ${index + 1} 삭제`}
                      data-testid={`quick-request-stopover-remove-${index}`}
                      onClick={() => field.removeValue(index)}
                    >
                      <Icons.trash className='size-4' aria-hidden />
                      삭제
                    </Button>
                  }
                >
                  <QuickRequestLocationSection
                    form={form}
                    fieldPrefix={`stopovers[${index}]`}
                    idPrefix={`quick-request-stopover-${index}`}
                    showRecent={showRecentAddresses}
                    placeSearchEnabled={placeSearchEnabled}
                  />
                </QuickRequestRouteBlock>
              ))}

              <QuickRequestRouteBlock kind='destination' title='도착지' isLast>
                <QuickRequestLocationSection
                  form={form}
                  fieldPrefix='destination'
                  idPrefix='quick-request-destination'
                  showRecent={showRecentAddresses}
                  placeSearchEnabled={placeSearchEnabled}
                />
              </QuickRequestRouteBlock>
            </Card>
          </QuickRequestSectionShell>
        );
      }}
    </form.AppField>
  );
}
