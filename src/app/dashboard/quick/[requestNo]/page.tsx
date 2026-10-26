import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { QuickRequestDetailPage } from '@/features/quick-request/components/detail/quick-request-detail-page';
import { QuickRequestNotFound } from '@/features/quick-request/components/detail/quick-request-not-found';
import { quickInfoContent } from '@/features/quick-request/info-content';
import { isQuickRequestNo } from '@/features/quick-request/schemas/quick-request-workflow';

type PageProps = {
  params: Promise<{ requestNo: string }>;
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** plan 89 — 퀵 요청 상세. 번호 형식이 틀리면 API를 부르지 않고 404 화면 (designer K6) */
export default async function QuickRequestDetailRoute({ params }: PageProps) {
  await requireDashboardSession();
  const requestNo = safeDecode((await params).requestNo);

  return (
    <PageContainer
      pageTitle='퀵 요청 상세'
      pageDescription='진행 상황과 배차 정보를 확인합니다.'
      infoContent={quickInfoContent}
      pageHeaderAction={
        <Button variant='ghost' className='h-11 md:h-10' asChild>
          <Link href='/dashboard/quick'>
            <Icons.chevronLeft aria-hidden />
            목록으로
          </Link>
        </Button>
      }
    >
      {isQuickRequestNo(requestNo) ? (
        <QuickRequestDetailPage requestNo={requestNo} />
      ) : (
        <div data-testid='quick-detail' className='flex min-w-0 flex-1 flex-col'>
          <QuickRequestNotFound />
        </div>
      )}
    </PageContainer>
  );
}
