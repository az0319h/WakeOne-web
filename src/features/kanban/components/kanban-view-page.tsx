import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { KanbanListing } from './kanban-listing';
import { NewTasklistDialog } from './new-tasklist-dialog';

export default function KanbanViewPage() {
  return (
    <PageContainer
      viewportFill
      pageTitle='칸반'
      pageDescription='Google Tasks 목록을 칸반 보드에서 관리합니다.'
      pageHeaderAction={<NewTasklistDialog />}
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <KanbanListing />
      </Suspense>
    </PageContainer>
  );
}
