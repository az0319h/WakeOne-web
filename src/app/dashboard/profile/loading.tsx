import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function ProfileLoading() {
  return (
    <PageContainer
      pageTitle='프로필'
      pageDescription='계정 정보와 보안 설정을 관리합니다.'
    >
      <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col'>
        <PageLoadingSpinner variant='fill' />
      </div>
    </PageContainer>
  );
}
