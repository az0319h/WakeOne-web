'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { emptyStopoverLocation } from '../lib/default-form-values';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { useQuickRequestFormLayout } from './quick-request-form-layout';
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

/**
 * 출발·경유·도착 블록 (점 + 세로선 타임라인).
 * plan 106 D-10 ④ · K13 — 요청 폼 lg 미만: 제목 줄 32px(경유지는 삭제 버튼 때문에 44 유지) ·
 * 들여쓰기 26→22px → 주소 칸 폭 M375 321px(≥ 300 · AC-23). 수정 Sheet·PC는 지금 그대로.
 */
function QuickRequestRouteBlock({
  kind,
  title,
  action,
  isLast,
  children
}: QuickRequestRouteBlockProps) {
  const isPage = useQuickRequestFormLayout() === 'page';
  return (
    <div className='min-w-0'>
      <div
        className={cn(
          'flex min-h-11 items-center gap-3',
          isPage && action == null && 'max-lg:min-h-8'
        )}
      >
        <QuickRequestRouteDot kind={kind} />
        <h4 className='text-sm font-semibold text-foreground'>{title}</h4>
        {action}
      </div>
      <div
        className={cn(
          'ml-1 min-w-0 border-l-2 pl-5',
          isPage && 'max-lg:pl-4',
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
  const isPage = useQuickRequestFormLayout() === 'page';
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
            {/* plan 106 K13 — 요청 폼 lg 미만은 카드 테두리·안쪽 여백 없이 평면(다른 섹션과 같은 결) · lg 이상 그대로 */}
            <Card
              className={cn(
                'min-w-0 gap-0 shadow-none',
                isPage
                  ? 'p-0 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent lg:p-5'
                  : 'p-4 sm:p-5'
              )}
            >
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
