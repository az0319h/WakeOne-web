import PageContainer from '@/components/layout/page-container';
import { requireAssetLedgerPage } from '@/features/auth/api/session.server';
import { AssetLedgerListing } from '@/features/asset-ledger/components/asset-ledger-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';

export const metadata = {
  title: 'Dashboard: 비품 대장'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const profile = await requireAssetLedgerPage();
  const searchParams = await props.searchParams;
  const parsed = searchParamsCache.parse(searchParams);
  const filters = {
    page: parsed.page,
    limit: parsed.perPage,
    ...(parsed.search && { search: parsed.search }),
    ...(parsed.status && { status: parsed.status as '사용중' | '미사용' | '분실' | 'all' }),
    ...(parsed.category && { category: parsed.category }),
    ...(parsed.sort && { sort: parsed.sort })
  };

  return (
    <PageContainer
      pageTitle='비품 대장'
      pageDescription='웨이크 비품 자산 정보를 등록, 조회, 수정, 삭제합니다.'
    >
      <AssetLedgerListing
        currentUserId={profile.user_id}
        isAdmin={profile.system_role === 'admin'}
        filters={filters}
      />
    </PageContainer>
  );
}
