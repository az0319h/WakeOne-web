import PageContainer from '@/components/layout/page-container';
import FormCardSkeleton from '@/components/form-card-skeleton';

export default function ProfileLoading() {
  return (
    <PageContainer
      pageTitle='프로필'
      pageDescription='계정 정보와 보안 설정을 관리합니다.'
    >
      <div className='mx-auto w-full max-w-3xl'>
        <FormCardSkeleton />
      </div>
    </PageContainer>
  );
}
