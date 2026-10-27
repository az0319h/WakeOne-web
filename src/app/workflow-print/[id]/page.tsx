import type { Metadata } from 'next';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { getWorkflowDocumentDetail } from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import {
  WorkflowPrintToolbar,
  WorkflowPrintTrigger
} from '@/features/workflow/components/workflow-print-trigger';
import { WorkflowPrintView } from '@/features/workflow/components/workflow-print-view';

export const metadata: Metadata = {
  title: '워크플로우 문서 인쇄',
  robots: { index: false, follow: false }
};

type PageProps = { params: Promise<{ id: string }> };

/** 인쇄 전용 — dashboard layout 밖 (사이드바·Presence track 없음). 열람 판정은 RLS */
export default async function WorkflowPrintPage({ params }: PageProps) {
  const profile = await requireDashboardSession();
  const { id } = await params;
  const document = isUuid(id) ? await getWorkflowDocumentDetail(id, profile.user_id) : null;

  if (!document) {
    return (
      <main className='grid min-h-dvh place-items-center bg-background p-6 text-foreground'>
        <p className='text-sm font-medium'>문서를 찾을 수 없거나 열람 권한이 없습니다.</p>
      </main>
    );
  }

  return (
    <main
      data-testid='workflow-print-page'
      className='mx-auto min-h-dvh w-full max-w-[210mm] bg-background p-6 text-foreground print:p-0 print:bg-white print:text-black'
    >
      <WorkflowPrintToolbar />
      <WorkflowPrintView document={document} />
      <WorkflowPrintTrigger />
    </main>
  );
}
