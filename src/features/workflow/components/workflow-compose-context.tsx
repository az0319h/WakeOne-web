'use client';

import { createContext, use, useCallback, useMemo, useState } from 'react';

export type WorkflowComposeRequest =
  | { mode: 'new'; templateKey: string }
  | { mode: 'draft'; draftId: string }
  | { mode: 'duplicate'; documentId: string }
  | { mode: 'edit'; documentId: string };

type WorkflowComposeContextValue = {
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  compose: WorkflowComposeRequest | null;
  /** 같은 요청을 다시 열어도 폼이 새로 만들어지도록 증가하는 key */
  composeKey: number;
  openCompose: (request: WorkflowComposeRequest) => void;
  closeCompose: () => void;
};

const WorkflowComposeContext = createContext<WorkflowComposeContextValue | null>(null);

/** 작성 · 이어쓰기 · 복제 · 수정 Dialog 열기 상태 (support-sheet-context 패턴) */
export function WorkflowComposeProvider({ children }: { children: React.ReactNode }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [compose, setCompose] = useState<WorkflowComposeRequest | null>(null);
  const [composeKey, setComposeKey] = useState(0);

  const openCompose = useCallback((request: WorkflowComposeRequest) => {
    setPickerOpen(false);
    setComposeKey((key) => key + 1);
    setCompose(request);
  }, []);

  const closeCompose = useCallback(() => setCompose(null), []);

  const value = useMemo(
    () => ({ pickerOpen, setPickerOpen, compose, composeKey, openCompose, closeCompose }),
    [pickerOpen, compose, composeKey, openCompose, closeCompose]
  );

  return <WorkflowComposeContext value={value}>{children}</WorkflowComposeContext>;
}

export function useWorkflowCompose(): WorkflowComposeContextValue {
  const context = use(WorkflowComposeContext);
  if (!context) {
    throw new Error('useWorkflowCompose must be used within WorkflowComposeProvider');
  }
  return context;
}
