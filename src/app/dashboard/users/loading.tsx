import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function UsersLoading() {
  return (
    <PageContainer
      pageTitle='사용자'
      pageDescription='이메일 초대 및 사용자 목록을 관리합니다.'
    >
      <DataTableSkeleton columnCount={8} rowCount={10} filterCount={2} />
    </PageContainer>
  );
}
