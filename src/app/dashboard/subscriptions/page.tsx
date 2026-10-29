import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { isAssetManager } from '@/features/auth/api/asset-access.server';
import { getSessionProfile } from '@/features/auth/api/session.server';
import {
  AssetLedgerCreateButton,
  AssetLedgerSheetProvider
} from '@/features/asset-ledger/components/asset-ledger-sheet-context';
import { SubscriptionsPage } from '@/features/subscriptions/components/subscriptions-page';
import { searchParamsCache } from '@/lib/searchparams';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

/**
 * plan 103 — 구독 관리. 동방특송은 proxy allowlist가 막는다(새 규칙 없음) · 일반 직원도 연다.
 * 권한자(admin · 웨이크 인사팀 · 웨이크 회계팀)만 「구독 추가」·관리 정보·수정·삭제가 렌더된다.
 */
export default async function SubscriptionsPageRoute(props: PageProps) {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/auth/sign-in');
  }
  if (profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  searchParamsCache.parse(await props.searchParams);
  const isManager = isAssetManager(profile);

  return (
    <AssetLedgerSheetProvider>
      <PageContainer
        pageTitle='구독 관리'
        pageDescription='회사가 돈을 내는 툴·서비스와, 누가 쓰는지를 한곳에서 봅니다. 줄을 누르면 자세히 보고 요청할 수 있어요.'
        pageHeaderAction={
          isManager ? (
            <AssetLedgerCreateButton label='구독 추가' data-testid='subscription-create-button' />
          ) : undefined
        }
      >
        <SubscriptionsPage isManager={isManager} />
      </PageContainer>
    </AssetLedgerSheetProvider>
  );
}
