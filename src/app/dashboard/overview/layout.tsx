import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { BirthdayCelebrantsSection } from '@/features/birthday-celebrants/components/birthday-celebrants-section';
import { BirthdayCelebrantsBannerSkeleton } from '@/features/birthday-celebrants/components/birthday-celebrants-banner-skeleton';
import { AnnouncementsOverviewSection } from '@/features/announcements/components/announcements-overview-section';
import { AnnouncementsOverviewSkeleton } from '@/features/announcements/components/announcements-overview-skeleton';
import { WalletSummaryOverviewCardSkeleton } from '@/features/wallet/components/wallet-summary-overview-card-skeleton';
import { WalletSummaryOverviewSection } from '@/features/wallet/components/wallet-summary-overview-section';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { MockDataOverlay } from '@/features/overview/components/mock-data-overlay';
import React from 'react';

export default function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
}) {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>안녕하세요, 다시 오셨군요 👋</h2>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 [&_[data-slot=card]]:bg-gradient-to-t [&_[data-slot=card]]:from-primary/5 [&_[data-slot=card]]:to-card [&_[data-slot=card]]:shadow-xs dark:[&_[data-slot=card]]:bg-card'>
          <MockDataOverlay>
            <Card className='@container/card'>
            <CardHeader>
              <CardDescription>총 매출</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                $1,250.00
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                이번 달 상승세 <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>최근 6개월 방문자 현황</div>
            </CardFooter>
            </Card>
          </MockDataOverlay>
          <MockDataOverlay>
            <Card className='@container/card'>
            <CardHeader>
              <CardDescription>신규 고객</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                1,234
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingDown />
                  -20%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                이번 기간 20% 감소 <Icons.trendingDown className='size-4' />
              </div>
              <div className='text-muted-foreground'>고객 획득 현황 주의 필요</div>
            </CardFooter>
            </Card>
          </MockDataOverlay>
          <MockDataOverlay>
            <Card className='@container/card'>
            <CardHeader>
              <CardDescription>활성 계정</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                45,678
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                높은 사용자 유지율 <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>목표 참여율 초과 달성</div>
            </CardFooter>
            </Card>
          </MockDataOverlay>
          <MockDataOverlay>
            <Card className='@container/card'>
            <CardHeader>
              <CardDescription>성장률</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                4.5%
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +4.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                꾸준한 성과 증가세 <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>성장 예측치 달성 중</div>
            </CardFooter>
            </Card>
          </MockDataOverlay>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-4 flex flex-col gap-4 md:col-span-3'>
            <Suspense fallback={<BirthdayCelebrantsBannerSkeleton />}>
              <BirthdayCelebrantsSection />
            </Suspense>
            <Suspense fallback={<AnnouncementsOverviewSkeleton />}>
              <AnnouncementsOverviewSection />
            </Suspense>
            <Suspense fallback={<WalletSummaryOverviewCardSkeleton />}>
              <WalletSummaryOverviewSection />
            </Suspense>
          </div>
          <div className='col-span-4'>
            <MockDataOverlay className='h-full [&_[data-slot=card]]:h-full'>
              {bar_stats}
            </MockDataOverlay>
          </div>
          <div className='col-span-4 md:col-span-3'>
            <MockDataOverlay className='h-full [&_[data-slot=card]]:h-full'>{sales}</MockDataOverlay>
          </div>
          <div className='col-span-4'>
            <MockDataOverlay className='h-full [&_[data-slot=card]]:h-full'>
              {area_stats}
            </MockDataOverlay>
          </div>
          <div className='col-span-4 min-h-0 md:col-span-3'>
            <MockDataOverlay className='h-full [&_[data-slot=card]]:h-full'>
              {pie_stats}
            </MockDataOverlay>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
