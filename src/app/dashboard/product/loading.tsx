import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function AssetLedgerLoading() {
  return (
    <PageContainer
      pageTitle='비품 대장'
      pageDescription='웨이크 비품 자산 정보를 등록, 조회, 수정, 삭제합니다.'
    >
      <DataTableSkeleton columnCount={16} rowCount={10} filterCount={4} />
    </PageContainer>
  );
}
