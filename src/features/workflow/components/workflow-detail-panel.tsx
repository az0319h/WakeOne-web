'use client';

import { useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { cancelWorkflowDocumentMutation, setWorkflowStarMutation } from '../api/mutations';
import { workflowDocumentQueryOptions } from '../api/queries';
import { isWorkflowApiError } from '../api/service';
import type { WorkflowDocumentDetail } from '../api/types';
import { WorkflowApprovalLineDialog } from './workflow-approval-line-dialog';
import { WorkflowApprovalLineView } from './workflow-approval-line-view';
import { WorkflowAttachmentList } from './workflow-attachment-list';
import { WorkflowCommentForm } from './workflow-comment-form';
import { useWorkflowCompose } from './workflow-compose-context';
import { WorkflowDecisionDialog } from './workflow-decision-dialogs';
import { WorkflowFieldTable } from './workflow-field-table';
import { WorkflowErrorAlert, WorkflowQueryBoundary } from './workflow-query-boundary';
import { WorkflowRichContent } from './workflow-rich-content';
import { WorkflowStatusBadge } from './workflow-status-badge';
import { WorkflowTimeline } from './workflow-timeline';

const META_ID = 'workflow-detail-meta';
export const WORKFLOW_NOT_VISIBLE_MESSAGE = '문서를 찾을 수 없거나 열람 권한이 없습니다.';

// 레이아웃 슬롯 (lg↑ 2열 grid ↔ lg 미만 1열 — 스크롤 래퍼 lg:contents로 DOM 한 벌)
const HEADER_CLASS =
  'flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6 lg:col-start-1 lg:row-start-1';
const SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overscroll-contain lg:contents';
const MAIN_CLASS =
  'flex flex-col gap-6 px-4 py-6 md:px-12 [&>*]:shrink-0 lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain';
const ASIDE_CLASS =
  'border-t px-4 py-6 md:px-12 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:px-5';
const FOOTER_CLASS =
  'flex shrink-0 gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-12 lg:col-start-1 lg:row-start-3';

function CloseButton() {
  return (
    <DialogPrimitive.Close asChild>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label='닫기'
        data-testid='workflow-detail-close'
        className='size-10 shrink-0'
      >
        <Icons.close aria-hidden />
      </Button>
    </DialogPrimitive.Close>
  );
}

/** 로딩 · 오류 · 404 상태 — 닫기만 있는 header + 본문 */
function DetailStateShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <>
      <header className={HEADER_CLASS}>
        <DialogTitle className='min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground'>
          {title}
        </DialogTitle>
        <CloseButton />
      </header>
      <div className={SCROLL_CLASS}>
        <main className={MAIN_CLASS}>{children}</main>
      </div>
    </>
  );
}

function WorkflowStarToggle({ document }: { document: WorkflowDocumentDetail }) {
  const mutation = useMutation({ ...setWorkflowStarMutation });
  return (
    <Toggle
      size='sm'
      aria-label='중요 표시'
      data-testid='workflow-star'
      pressed={document.starred}
      className='size-10'
      onPressedChange={(starred) =>
        mutation.mutate(
          { id: document.id, starred },
          { onError: (error) => notifyError(error.message) }
        )
      }
    >
      {document.starred ? (
        <Icons.starFilled aria-hidden className='size-5 text-amber-500' />
      ) : (
        <Icons.star aria-hidden className='size-5' />
      )}
    </Toggle>
  );
}

function WorkflowDetailMoreMenu({
  document,
  onDuplicate,
  onCanceled
}: {
  document: WorkflowDocumentDetail;
  onDuplicate: () => void;
  onCanceled: () => void;
}) {
  const { openCompose } = useWorkflowCompose();
  const [lineOpen, setLineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancelMutation = useMutation({ ...cancelWorkflowDocumentMutation });
  const { permissions } = document;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='더 보기'
            data-testid='workflow-more-menu'
            className='size-10 shrink-0'
          >
            <Icons.moreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48'>
          {permissions.can_edit ? (
            <DropdownMenuItem
              onSelect={() => openCompose({ mode: 'edit', documentId: document.id })}
            >
              <Icons.edit aria-hidden />
              문서 수정
            </DropdownMenuItem>
          ) : null}
          {permissions.can_change_line ? (
            <DropdownMenuItem onSelect={() => setLineOpen(true)}>
              <Icons.refresh aria-hidden />
              승인·참조 변경
            </DropdownMenuItem>
          ) : null}
          {permissions.can_duplicate ? (
            <DropdownMenuItem onSelect={onDuplicate}>
              <Icons.copy aria-hidden />
              복제하기
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => {
              window.open(`/workflow-print/${document.id}`, '_blank', 'noopener');
            }}
          >
            <Icons.printer aria-hidden />
            PDF 인쇄
          </DropdownMenuItem>
          {permissions.can_cancel ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant='destructive' onSelect={() => setCancelOpen(true)}>
                <Icons.circleX aria-hidden />
                문서 취소
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {permissions.can_change_line ? (
        <WorkflowApprovalLineDialog open={lineOpen} onOpenChange={setLineOpen} document={document} />
      ) : null}

      <AlertModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        loading={cancelMutation.isPending}
        title='문서 취소'
        description={`${document.code} 문서를 취소합니다. 취소한 문서는 되돌릴 수 없습니다.`}
        confirmLabel='문서 취소'
        cancelLabel='닫기'
        onConfirm={() =>
          cancelMutation.mutate(
            { id: document.id },
            {
              onSuccess: () => {
                notifySuccess('문서를 취소했습니다.');
                setCancelOpen(false);
                onCanceled();
              },
              onError: (error) => notifyError(error.message)
            }
          )
        }
      />
    </>
  );
}

function WorkflowDetailContent({
  documentId,
  onOpenDocument,
  onDuplicate,
  onCanceled
}: {
  documentId: string;
  onOpenDocument: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCanceled: () => void;
}) {
  const { data: document } = useSuspenseQuery(workflowDocumentQueryOptions(documentId));
  const [decision, setDecision] = useState<'approve' | 'decline' | null>(null);
  const lineSectionRef = useRef<HTMLElement>(null);
  const statusProps = {
    status: document.status,
    currentStep: document.current_step,
    totalSteps: document.total_steps
  };
  // lg 미만 1열에서는 결재선이 맨 아래 → 상태 배지 밑에 요약 (탭하면 결재선으로 이동)
  const ongoingStep = document.steps.find((step) => step.status === 'ONGOING');
  const waitingNames = (ongoingStep?.actors ?? [])
    .filter((actor) => actor.status === 'WAITING')
    .map((actor) => actor.full_name);
  const lineSummary = ongoingStep
    ? `${ongoingStep.step}/${document.total_steps}단계 · 현재 승인자 ${waitingNames.join(', ') || '-'}`
    : `결재 ${document.total_steps}단계 · 참조 ${document.referrers.length}명`;

  return (
    <>
      <header className={HEADER_CLASS}>
        <div className='flex min-w-0 flex-1 items-center gap-2 lg:invisible'>
          <WorkflowStatusBadge {...statusProps} />
          <span className='truncate text-sm font-medium'>{document.template.name}</span>
        </div>
        <WorkflowStarToggle document={document} />
        <WorkflowDetailMoreMenu
          document={document}
          onDuplicate={() => onDuplicate(document.id)}
          onCanceled={onCanceled}
        />
        <CloseButton />
      </header>

      <div className={SCROLL_CLASS}>
        <main className={MAIN_CLASS}>
          <div className='flex flex-col gap-2'>
            <div data-testid='workflow-detail-status' className='flex'>
              <WorkflowStatusBadge {...statusProps} size='lg' />
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              data-testid='workflow-detail-line-summary'
              className='h-11 max-w-full justify-start self-start lg:hidden'
              onClick={() => lineSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <Icons.teams aria-hidden />
              <span className='min-w-0 truncate'>{lineSummary}</span>
              <Icons.chevronDown aria-hidden className='text-muted-foreground' />
            </Button>
            <DialogTitle className='text-2xl font-bold'>
              <span aria-hidden className='mr-2'>
                {document.template.emoji}
              </span>
              {document.template.name}
            </DialogTitle>
            <DialogDescription id={META_ID} className='text-sm text-muted-foreground'>
              문서번호{' '}
              <span data-testid='workflow-detail-code' className='font-mono text-foreground'>
                {document.code}
              </span>{' '}
              · 작성자 {document.writer.full_name} · 작성{' '}
              <time dateTime={document.written_at} className='tabular-nums'>
                {formatAbsoluteDateTimeKo(document.written_at)}
              </time>
            </DialogDescription>
          </div>

          <WorkflowTimeline events={document.events} fields={document.template_snapshot.fields ?? []} />
          <WorkflowCommentForm documentId={document.id} />
          <Separator />
          <WorkflowFieldTable document={document} onOpenReference={onOpenDocument} />
          <WorkflowAttachmentList documentId={document.id} attachments={document.attachments} />
          <WorkflowRichContent html={document.content_html} />
        </main>
        <aside ref={lineSectionRef} aria-label='승인 · 참조' className={ASIDE_CLASS}>
          <WorkflowApprovalLineView document={document} />
        </aside>
      </div>

      {document.permissions.can_approve ? (
        <footer className={FOOTER_CLASS}>
          <Button
            type='button'
            variant='outline'
            data-testid='workflow-decline'
            className='h-11 flex-1'
            onClick={() => setDecision('decline')}
          >
            <Icons.ban aria-hidden />
            반려
          </Button>
          <Button
            type='button'
            data-testid='workflow-approve'
            className='h-11 flex-[2]'
            onClick={() => setDecision('approve')}
          >
            <Icons.check aria-hidden />
            승인
          </Button>
        </footer>
      ) : null}

      {decision ? (
        <WorkflowDecisionDialog
          kind={decision}
          open
          onOpenChange={(open) => {
            if (!open) setDecision(null);
          }}
          documentId={document.id}
          code={document.code}
        />
      ) : null}
    </>
  );
}

/** 문서 상세 — PC 오른쪽 큰 패널 · 모바일 전체 화면 (`?doc=`) */
export function WorkflowDetailPanel({
  documentId,
  onClose,
  onOpenDocument,
  onDuplicate,
  onCanceled
}: {
  documentId: string | null;
  onClose: () => void;
  onOpenDocument: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCanceled: () => void;
}) {
  return (
    <Dialog
      open={documentId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-testid='workflow-detail'
          aria-describedby={META_ID}
          className={cn(
            'fixed inset-0 z-50 flex h-dvh w-full flex-col bg-background shadow-lg outline-none',
            'md:left-auto md:w-[min(72rem,calc(100vw-4rem))] md:border-l',
            'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_minmax(0,1fr)_auto]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right motion-reduce:animate-none'
          )}
        >
          {documentId ? (
            <WorkflowQueryBoundary
              suspenseKey={documentId}
              errorMessage='문서를 불러오지 못했습니다.'
              loadingFallback={
                <DetailStateShell title='문서 불러오는 중'>
                  <PageLoadingSpinner variant='compact' />
                </DetailStateShell>
              }
              renderError={(error, retry) =>
                isWorkflowApiError(error) && (error.status === 404 || error.status === 403) ? (
                  <DetailStateShell title='문서 상세'>
                    <div className='flex flex-col items-center gap-3 py-16 text-center'>
                      <Icons.alertCircle aria-hidden className='size-10 text-muted-foreground' />
                      <p className='text-sm font-medium'>{WORKFLOW_NOT_VISIBLE_MESSAGE}</p>
                      <Button type='button' variant='outline' className='h-11' onClick={onClose}>
                        닫기
                      </Button>
                    </div>
                  </DetailStateShell>
                ) : (
                  <DetailStateShell title='문서 상세'>
                    <WorkflowErrorAlert message='문서를 불러오지 못했습니다.' onRetry={retry} />
                  </DetailStateShell>
                )
              }
            >
              <WorkflowDetailContent
                documentId={documentId}
                onOpenDocument={onOpenDocument}
                onDuplicate={onDuplicate}
                onCanceled={onCanceled}
              />
            </WorkflowQueryBoundary>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
