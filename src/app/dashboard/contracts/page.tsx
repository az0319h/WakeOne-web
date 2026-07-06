import PageContainer from '@/components/layout/page-container';
import { requireAdminPage } from '@/features/auth/api/session.server';
import { ContractListing } from '@/features/contracts/components/contract-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';

export const metadata = {
  title: 'Dashboard: 계약서 관리'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function ContractsPage(props: PageProps) {
  await requireAdminPage();

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
      pageTitle='계약서 관리'
      pageDescription='계약서 체결 요청 문서와 첨부 상태를 관리합니다.'
    >
      <ContractListing filters={filters} />
    </PageContainer>
  );
}
