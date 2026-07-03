import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function ContractsLoading() {
  return (
    <PageContainer
      pageTitle='계약서 관리'
      pageDescription='계약서 체결 요청 문서와 첨부 상태를 관리합니다.'
    >
      <DataTableSkeleton columnCount={8} rowCount={10} filterCount={3} />
    </PageContainer>
  );
}
