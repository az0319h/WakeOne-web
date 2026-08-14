import PageContainer from '@/components/layout/page-container';
import { MyContractsListing } from '@/features/contracts/components/my-contracts-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function MyContractsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const parsed = searchParamsCache.parse(searchParams);
  const filters = {
    page: parsed.page,
    limit: parsed.perPage,
    ...(parsed.from && { from: parsed.from }),
    ...(parsed.to && { to: parsed.to }),
    ...(parsed.search && { search: parsed.search }),
    ...(parsed.attachment_status && {
      attachment_status: parsed.attachment_status as
        | 'missing'
        | 'has_attachment'
        | 'no_attachment_required'
        | 'soft_deleted'
    }),
    ...(parsed.sort && { sort: parsed.sort })
  };

  return (
    <PageContainer
      pageTitle='내 계약서'
      pageDescription='본인 이름으로 작성된 계약서 체결 요청 문서를 확인합니다.'
    >
      <MyContractsListing filters={filters} />
    </PageContainer>
  );
}
