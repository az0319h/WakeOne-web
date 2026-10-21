"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { PageLoadingSpinner } from "@/components/ui/page-loading-spinner";
import { WorkflowComposeDialog } from "./workflow-compose-dialog";
import { useWorkflowCompose } from "./workflow-compose-context";
import { WorkflowDetailPanel } from "./workflow-detail-panel";
import { WorkflowInboxBody } from "./workflow-inbox-body";
import { WorkflowInboxToolbar } from "./workflow-inbox-toolbar";
import { WorkflowErrorAlert, WorkflowQueryBoundary } from "./workflow-query-boundary";
import { WorkflowTemplatePickerDialog } from "./workflow-template-picker-dialog";
import { useWorkflowListParams } from "./use-workflow-list-params";

/** 마운트(=hydration 완료) 시 1회 알린다 */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

const subscribeNoop = () => () => undefined;

/** SSR·hydration 중 false → 목록은 hydration 뒤 클라이언트에서 조회한다 */
function useIsHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/** 문서함 client 셸 — 툴바(Suspense 밖) + 목록 본문 + 상세 패널 · 작성 Dialog */
export function WorkflowPage({ isWorkflowAdmin }: { isWorkflowAdmin: boolean }) {
  const { params, setParams, filters } = useWorkflowListParams(isWorkflowAdmin);
  const { openCompose } = useWorkflowCompose();
  const querySignature = JSON.stringify(filters);
  // deep link(?doc=) 첫 진입: 목록 본문 hydration이 끝난 뒤 상세를 연다
  // (Radix hideOthers의 aria-hidden이 아직 hydration 중인 DOM과 충돌하지 않게)
  const [bodyReady, setBodyReady] = useState(false);
  const isHydrated = useIsHydrated();
  const markBodyReady = useCallback(() => setBodyReady(true), []);

  const openDocument = useCallback((id: string) => void setParams({ doc: id }), [setParams]);
  const closeDocument = useCallback(() => void setParams({ doc: null }), [setParams]);

  return (
    <>
      <div data-testid="workflow-page" className="flex min-w-0 flex-1 flex-col gap-4">
        <WorkflowInboxToolbar
          filters={filters}
          setParams={setParams}
          isWorkflowAdmin={isWorkflowAdmin}
        />
        {isHydrated ? (
          <WorkflowQueryBoundary
            suspenseKey={querySignature}
            errorMessage="문서함을 불러오지 못했습니다."
            loadingFallback={
              <>
                <PageLoadingSpinner variant="fill" />
                <ReadySignal onReady={markBodyReady} />
              </>
            }
            renderError={(_error, retry) => (
              <>
                <WorkflowErrorAlert message="문서함을 불러오지 못했습니다." onRetry={retry} />
                <ReadySignal onReady={markBodyReady} />
              </>
            )}
          >
            <WorkflowInboxBody filters={filters} onOpen={openDocument} />
            <ReadySignal onReady={markBodyReady} />
          </WorkflowQueryBoundary>
        ) : (
          <PageLoadingSpinner variant="fill" />
        )}
      </div>

      <WorkflowDetailPanel
        documentId={bodyReady ? params.doc : null}
        onClose={closeDocument}
        onOpenDocument={openDocument}
        onDuplicate={(id) => {
          void setParams({ doc: null });
          openCompose({ mode: "duplicate", documentId: id });
        }}
        onCanceled={() => void setParams({ tab: "done" })}
      />
      <WorkflowTemplatePickerDialog />
      <WorkflowComposeDialog />
    </>
  );
}
