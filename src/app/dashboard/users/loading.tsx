import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function UsersLoading() {
  return (
    <PageContainer
      pageTitle='사용자 관리'
      pageDescription='이메일 초대 및 사용자 목록을 관리합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
