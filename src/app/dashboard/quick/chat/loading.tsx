import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  QUICK_CHAT_PAGE_DESCRIPTION,
  QUICK_CHAT_PAGE_TITLE
} from '@/features/quick-request/components/chat/quick-chat-constants';

export default function Loading() {
  return (
    <PageContainer
      mobileHeader='hidden'
      pageTitle={QUICK_CHAT_PAGE_TITLE}
      pageDescription={QUICK_CHAT_PAGE_DESCRIPTION}
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
