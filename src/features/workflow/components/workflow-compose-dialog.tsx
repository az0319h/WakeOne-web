'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Separator } from '@/components/ui/separator';
import { scrollToFirstError, useAppForm } from '@/components/ui/tanstack-form';
import { useNavAccess } from '@/contexts/nav-access';
import { getKstTodayDateString } from '@/lib/kst';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  saveWorkflowDraftMutation,
  submitWorkflowDocumentMutation,
  updateWorkflowDocumentMutation
} from '../api/mutations';
import {
  workflowDocumentQueryOptions,
  workflowDraftQueryOptions,
  workflowMembersQueryOptions,
  workflowTemplateQueryOptions
} from '../api/queries';
import { isWorkflowApiError } from '../api/service';
import type {
  WorkflowAttachment,
  WorkflowDocumentDetail,
  WorkflowInputValue,
  WorkflowReferenceDocument,
  WorkflowTemplateField
} from '../api/types';
import { validateApprovalLine } from '../lib/approval-line-rules';
import {
  EMPTY_WORKFLOW_LINE,
  lineFromDefault,
  lineFromDocument,
  lineFromIds,
  lineSignature,
  lineToPayload,
  type WorkflowLineValue
} from '../lib/approval-line-state';
import { normalizeWorkflowValues } from '../lib/inputs';
import {
  isAttachmentRequired,
  isFieldRequired,
  validateWorkflowInputs,
  WORKFLOW_APPROVAL_LINE_ERROR_KEY,
  WORKFLOW_ATTACHMENT_ERROR_KEY,
  type WorkflowAttachmentRule,
  type WorkflowInputValues
} from '../lib/required-rules';
import { WorkflowApprovalLineEditor } from './workflow-approval-line-editor';
import { WorkflowApprovalLineView } from './workflow-approval-line-view';
import { useWorkflowAttachments, WorkflowAttachmentField } from './workflow-attachment-field';
import { useWorkflowCompose, type WorkflowComposeRequest } from './workflow-compose-context';
import { WorkflowDynamicField } from './workflow-dynamic-field';
import { WorkflowErrorAlert, WorkflowQueryBoundary } from './workflow-query-boundary';
import { WorkflowRichTextEditor } from './workflow-rich-text-editor';

const FORM_ID = 'workflow-compose-form';
const DESCRIPTION_ID = 'workflow-compose-description';

type ComposeMode = WorkflowComposeRequest['mode'];

/** 모드별 로딩이 끝난 뒤 폼에 넘기는 초기값 */
type ComposeInit = {
  mode: ComposeMode;
  templateKey: string;
  templateName: string;
  guide: string;
  fields: WorkflowTemplateField[];
  attachmentRule: WorkflowAttachmentRule;
  contentVisible: boolean;
  values: Record<string, WorkflowInputValue>;
  contentHtml: string;
  line: WorkflowLineValue;
  attachments: WorkflowAttachment[];
  draftId: string | null;
  /** 수정 모드 문서 */
  document: WorkflowDocumentDetail | null;
  references: WorkflowReferenceDocument[];
};

// 레이아웃 슬롯 (lg↑ 좌 폼 / 우 결재선 ↔ lg 미만 1열)
const HEADER_CLASS = 'flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6 lg:col-start-1 lg:row-start-1';
const SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overscroll-contain lg:contents';
const MAIN_CLASS =
  'flex flex-col gap-8 px-4 py-6 md:px-12 [&>*]:shrink-0 lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain';
const ASIDE_CLASS =
  'border-t bg-muted/30 px-4 py-6 md:px-12 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:px-5';
const FOOTER_CLASS =
  'flex shrink-0 gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-12 lg:col-start-1 lg:row-start-3';

type ComposeChrome = {
  requestClose: () => void;
  registerDirtyCheck: (check: () => boolean) => void;
  forceClose: () => void;
};

function ComposeHeader({ mode, onClose }: { mode: ComposeMode; onClose: () => void }) {
  return (
    <header className={HEADER_CLASS}>
      <Badge className='rounded-full'>{mode === 'edit' ? '수정하기' : '작성하기'}</Badge>
      <div className='flex-1' />
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label='닫기'
        data-testid='workflow-compose-close'
        className='size-10 shrink-0'
        onClick={onClose}
      >
        <Icons.close aria-hidden />
      </Button>
    </header>
  );
}

function templateRule(source: WorkflowAttachmentRule): WorkflowAttachmentRule {
  return {
    attachment_visible: source.attachment_visible,
    attachment_required: source.attachment_required,
    attachment_required_when: source.attachment_required_when
  };
}

function sortFields(fields: WorkflowTemplateField[]) {
  return [...fields].sort((a, b) => a.display_order - b.display_order);
}

// ---------------------------------------------------------------------------
// 모드별 로더 (Suspense)
// ---------------------------------------------------------------------------
function useWriterInfo() {
  const profile = useNavAccess();
  return {
    userId: profile?.user_id ?? null,
    name: profile?.full_name?.trim() || profile?.email || ''
  };
}

function applyPrefill(
  fields: WorkflowTemplateField[],
  values: Record<string, WorkflowInputValue>,
  writerName: string,
  options: { onlyWriterAndDate?: boolean } = {}
): Record<string, WorkflowInputValue> {
  const next = { ...values };
  const today = getKstTodayDateString();
  for (const field of fields) {
    if (field.prefill_type === 'NAME') {
      next[field.field_key] = writerName;
    } else if (field.prefill_type === 'DEFAULT' && field.type === 'DATE') {
      const preset = field.prefill_default?.trim();
      next[field.field_key] = preset && /^\d{4}-\d{2}-\d{2}$/.test(preset) ? preset : today;
    } else if (!options.onlyWriterAndDate && field.prefill_type === 'DEFAULT' && field.prefill_default) {
      next[field.field_key] = field.prefill_default;
    }
  }
  return next;
}

function NewComposeLoader({ templateKey, chrome }: { templateKey: string; chrome: ComposeChrome }) {
  const { data: template } = useSuspenseQuery(workflowTemplateQueryOptions(templateKey));
  const writer = useWriterInfo();
  const [init] = useState<ComposeInit>(() => {
    const fields = sortFields(template.fields);
    return {
      mode: 'new',
      templateKey: template.template_key,
      templateName: template.name,
      guide: template.description,
      fields,
      attachmentRule: templateRule(template),
      contentVisible: template.content_visible,
      values: applyPrefill(fields, normalizeWorkflowValues(fields, {}), writer.name),
      contentHtml: template.content_default ?? '',
      line: lineFromDefault(template.default_line, { excludeUserId: writer.userId }),
      attachments: [],
      draftId: null,
      document: null,
      references: []
    };
  });
  return <ComposeForm init={init} chrome={chrome} />;
}

function DraftComposeLoader({ draftId, chrome }: { draftId: string; chrome: ComposeChrome }) {
  const { data: draft } = useSuspenseQuery(workflowDraftQueryOptions(draftId));
  const { data: template } = useSuspenseQuery(workflowTemplateQueryOptions(draft.template.key));
  const { data: members } = useSuspenseQuery(workflowMembersQueryOptions());
  const [init] = useState<ComposeInit>(() => {
    const fields = sortFields(template.fields);
    const memberMap = new Map(members.map((member) => [member.user_id, member]));
    return {
      mode: 'draft',
      templateKey: template.template_key,
      templateName: template.name,
      guide: template.description,
      fields,
      attachmentRule: templateRule(template),
      contentVisible: template.content_visible,
      values: normalizeWorkflowValues(fields, draft.payload.values),
      contentHtml: draft.payload.content_html ?? '',
      line: lineFromIds(
        { steps: draft.payload.steps ?? [], referrers: draft.payload.referrers ?? [] },
        memberMap
      ),
      attachments: draft.attachments,
      draftId: draft.id,
      document: null,
      references: []
    };
  });
  return <ComposeForm init={init} chrome={chrome} />;
}

function DuplicateComposeLoader({ documentId, chrome }: { documentId: string; chrome: ComposeChrome }) {
  const { data: document } = useSuspenseQuery(workflowDocumentQueryOptions(documentId));
  const { data: template } = useSuspenseQuery(workflowTemplateQueryOptions(document.template.key));
  const writer = useWriterInfo();
  const [init] = useState<ComposeInit>(() => {
    const fields = sortFields(template.fields);
    const base = normalizeWorkflowValues(fields, document.values);
    return {
      mode: 'duplicate',
      templateKey: template.template_key,
      templateName: template.name,
      guide: template.description,
      fields,
      attachmentRule: templateRule(template),
      contentVisible: template.content_visible,
      values: applyPrefill(fields, base, writer.name, { onlyWriterAndDate: true }),
      contentHtml: document.content_html ?? '',
      line: (() => {
        const line = lineFromDocument(document);
        return {
          ...line,
          steps: line.steps.map((step) => ({
            actors: step.actors.filter((actor) => actor.member.user_id !== writer.userId)
          }))
        };
      })(),
      attachments: [],
      draftId: null,
      document: null,
      references: document.references
    };
  });
  return <ComposeForm init={init} chrome={chrome} />;
}

function EditComposeLoader({ documentId, chrome }: { documentId: string; chrome: ComposeChrome }) {
  const { data: document } = useSuspenseQuery(workflowDocumentQueryOptions(documentId));
  const [init] = useState<ComposeInit>(() => {
    const snapshot = document.template_snapshot;
    const fields = sortFields(snapshot.fields ?? []);
    return {
      mode: 'edit',
      templateKey: document.template.key,
      templateName: document.template.name,
      guide: snapshot.description ?? '',
      fields,
      attachmentRule: templateRule(snapshot),
      contentVisible: snapshot.content_visible,
      values: normalizeWorkflowValues(fields, document.values),
      contentHtml: document.content_html ?? '',
      line: EMPTY_WORKFLOW_LINE,
      attachments: document.attachments,
      draftId: null,
      document,
      references: document.references
    };
  });
  return <ComposeForm init={init} chrome={chrome} />;
}

// ---------------------------------------------------------------------------
// 폼
// ---------------------------------------------------------------------------
function errorsEqual(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
}

function ComposeForm({ init, chrome }: { init: ComposeInit; chrome: ComposeChrome }) {
  const writer = useWriterInfo();
  const isEdit = init.mode === 'edit';
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineError, setLineError] = useState<string | null>(null);
  const [line, setLine] = useState<WorkflowLineValue>(init.line);
  const [draftId, setDraftId] = useState<string | null>(init.draftId);
  const [referenceInfo, setReferenceInfo] = useState(
    () => new Map(init.references.map((reference) => [reference.id, reference]))
  );
  const attachments = useWorkflowAttachments({ initial: init.attachments, bound: isEdit });

  const contentRef = useRef(init.contentHtml);
  const baselineRef = useRef({
    content: init.contentHtml,
    line: lineSignature(init.line),
    attachments: attachments.signature
  });
  const attachmentCountRef = useRef(attachments.count);

  const submitMutation = useMutation({ ...submitWorkflowDocumentMutation });
  const updateMutation = useMutation({ ...updateWorkflowDocumentMutation });
  const draftMutation = useMutation({ ...saveWorkflowDraftMutation });

  /** 지금 오류가 있는 칸만 다시 검증 (필수에서 빠진 칸 오류는 즉시 사라짐 — AC-11) */
  const revalidateErrors = useCallback(
    (values: WorkflowInputValues, attachmentCount: number) => {
      setErrors((previous) => {
        const keys = Object.keys(previous);
        if (keys.length === 0) return previous;
        const current = new Map(
          validateWorkflowInputs({
            fields: init.fields,
            values,
            attachmentRule: init.attachmentRule,
            attachmentCount
          }).map((error) => [error.field_key, error.message])
        );
        const next: Record<string, string> = {};
        for (const key of keys) {
          const message = current.get(key);
          if (message) next[key] = message;
        }
        return errorsEqual(previous, next) ? previous : next;
      });
    },
    [init.fields, init.attachmentRule]
  );

  const form = useAppForm({
    defaultValues: init.values,
    listeners: {
      onChange: ({ formApi }) => revalidateErrors(formApi.state.values, attachmentCountRef.current)
    },
    onSubmit: async ({ value }) => {
      await handleSend(value);
    }
  });

  // 첨부 개수가 바뀌면 오류가 떠 있는 칸(첨부 포함)을 다시 판단
  useEffect(() => {
    attachmentCountRef.current = attachments.count;
    revalidateErrors(form.state.values, attachments.count);
  }, [attachments.count, form, revalidateErrors]);

  const isDirty = useCallback(
    () =>
      form.state.isDirty ||
      contentRef.current !== baselineRef.current.content ||
      lineSignature(line) !== baselineRef.current.line ||
      attachments.signature !== baselineRef.current.attachments ||
      attachments.isUploading,
    [form, line, attachments.signature, attachments.isUploading]
  );
  useEffect(() => {
    chrome.registerDirtyCheck(isDirty);
  }, [chrome, isDirty]);

  function applyServerError(error: unknown) {
    if (!isWorkflowApiError(error)) {
      notifyError(error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.');
      return;
    }
    if (error.fieldKey === WORKFLOW_APPROVAL_LINE_ERROR_KEY) {
      setLineError(error.message);
      scrollToFirstError();
      return;
    }
    const list = error.errors.length
      ? error.errors
      : error.fieldKey
        ? [{ field_key: error.fieldKey, message: error.message }]
        : [];
    const knownKeys = new Set([...init.fields.map((field) => field.field_key), WORKFLOW_ATTACHMENT_ERROR_KEY]);
    const mapped = list.filter((entry) => knownKeys.has(entry.field_key));
    if (mapped.length === 0) {
      notifyError(error.message);
      return;
    }
    setErrors(Object.fromEntries(mapped.map((entry) => [entry.field_key, entry.message])));
    scrollToFirstError();
  }

  async function handleSend(values: Record<string, WorkflowInputValue>) {
    const validation = validateWorkflowInputs({
      fields: init.fields,
      values,
      attachmentRule: init.attachmentRule,
      attachmentCount: attachments.count
    });
    const linePayload = lineToPayload(line);
    const nextLineError = isEdit ? null : validateApprovalLine(linePayload, { writerId: writer.userId });
    setErrors(Object.fromEntries(validation.map((error) => [error.field_key, error.message])));
    setLineError(nextLineError);
    if (validation.length > 0 || nextLineError) {
      scrollToFirstError();
      return;
    }

    try {
      if (isEdit && init.document) {
        await updateMutation.mutateAsync({
          id: init.document.id,
          payload: {
            values,
            content_html: contentRef.current,
            add_attachment_ids: attachments.stagedIds,
            remove_attachment_ids: attachments.removedBoundIds
          }
        });
        notifySuccess('문서를 수정했습니다.');
      } else {
        await submitMutation.mutateAsync({
          template_key: init.templateKey,
          values,
          content_html: contentRef.current,
          steps: linePayload.steps,
          referrers: linePayload.referrers,
          attachment_ids: attachments.stagedIds,
          draft_id: draftId
        });
        notifySuccess('문서를 보냈습니다.');
      }
      form.reset();
      chrome.forceClose();
    } catch (error) {
      applyServerError(error);
    }
  }

  async function handleSaveDraft() {
    const values = form.state.values;
    try {
      const result = await draftMutation.mutateAsync({
        draftId,
        payload: {
          template_key: init.templateKey,
          payload: {
            values,
            content_html: contentRef.current,
            ...lineToPayload(line)
          },
          attachment_ids: attachments.stagedIds
        }
      });
      setDraftId(result.draft.id);
      // 임시저장 성공 → 지금 상태를 새 기준으로 (Dialog는 열어 둔다)
      form.reset(values);
      baselineRef.current = {
        content: contentRef.current,
        line: lineSignature(line),
        attachments: attachments.signature
      };
      notifySuccess('임시저장했습니다.');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '임시저장하지 못했습니다.');
    }
  }

  const isSubmitting = submitMutation.isPending || updateMutation.isPending;
  const rule = init.attachmentRule;
  const attachmentSourceKey = rule.attachment_required_when?.field_key ?? null;

  return (
    <form
      id={FORM_ID}
      data-testid='workflow-compose-form'
      className='contents'
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <ComposeHeader mode={init.mode} onClose={chrome.requestClose} />
      <div className={SCROLL_CLASS}>
        <main className={MAIN_CLASS}>
          <div className='flex flex-col gap-4'>
            <DialogTitle className='text-2xl font-bold'>{init.templateName}</DialogTitle>
            <DialogDescription id={DESCRIPTION_ID} className='sr-only'>
              {isEdit ? '문서 내용을 수정합니다.' : '양식을 작성해 승인 요청을 보냅니다.'}
            </DialogDescription>
            {init.guide ? (
              <div
                data-testid='workflow-guide'
                className='text-sm leading-7 break-words whitespace-pre-wrap text-foreground'
              >
                {init.guide}
              </div>
            ) : null}
          </div>
          <Separator />
          <div className='flex flex-col gap-4'>
            {init.fields.map((field) => {
              const sourceKey = field.required_when?.field_key ?? null;
              return (
                <form.Subscribe
                  key={field.field_key}
                  selector={(state) => (sourceKey ? state.values[sourceKey] : undefined)}
                >
                  {(source) => (
                    <form.Field name={field.field_key}>
                      {(fieldApi) => (
                        <WorkflowDynamicField
                          field={field}
                          required={isFieldRequired(field, sourceKey ? { [sourceKey]: source } : {})}
                          value={fieldApi.state.value}
                          onChange={(next) => fieldApi.handleChange(next)}
                          onBlur={fieldApi.handleBlur}
                          error={errors[field.field_key] ?? null}
                          referenceInfo={referenceInfo}
                          onReferenceInfo={(docs) =>
                            setReferenceInfo((current) => {
                              const next = new Map(current);
                              docs.forEach((doc) => next.set(doc.id, doc));
                              return next;
                            })
                          }
                          excludeDocumentId={init.document?.id ?? null}
                        />
                      )}
                    </form.Field>
                  )}
                </form.Subscribe>
              );
            })}
            {rule.attachment_visible ? (
              <form.Subscribe
                selector={(state) => (attachmentSourceKey ? state.values[attachmentSourceKey] : undefined)}
              >
                {(source) => (
                  <WorkflowAttachmentField
                    state={attachments}
                    required={isAttachmentRequired(
                      rule,
                      attachmentSourceKey ? { [attachmentSourceKey]: source } : {}
                    )}
                    error={errors[WORKFLOW_ATTACHMENT_ERROR_KEY] ?? null}
                  />
                )}
              </form.Subscribe>
            ) : null}
          </div>
          {init.contentVisible ? (
            <WorkflowRichTextEditor
              initialContent={init.contentHtml}
              onChange={(html) => {
                contentRef.current = html;
              }}
            />
          ) : null}
        </main>
        <aside aria-label='승인 · 참조' className={ASIDE_CLASS}>
          {isEdit && init.document ? (
            <WorkflowApprovalLineView document={init.document} />
          ) : (
            <WorkflowApprovalLineEditor
              mode='compose'
              value={line}
              writerId={writer.userId}
              error={lineError}
              onChange={(next) => {
                setLine(next);
                if (lineError) {
                  setLineError(validateApprovalLine(lineToPayload(next), { writerId: writer.userId }));
                }
              }}
            />
          )}
        </aside>
      </div>
      <footer className={FOOTER_CLASS}>
        {isEdit ? null : (
          <Button
            type='button'
            variant='outline'
            data-testid='workflow-save-draft'
            className='h-11'
            disabled={isSubmitting || attachments.isUploading}
            isLoading={draftMutation.isPending}
            onClick={() => void handleSaveDraft()}
          >
            임시저장
          </Button>
        )}
        <Button
          type='submit'
          form={FORM_ID}
          data-testid='workflow-submit'
          className='h-11 flex-1'
          disabled={attachments.isUploading || draftMutation.isPending}
          isLoading={isSubmitting}
        >
          {attachments.isUploading ? '첨부 업로드 중…' : isEdit ? '저장' : '보내기'}
        </Button>
      </footer>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------
function ComposeLoader({ request, chrome }: { request: WorkflowComposeRequest; chrome: ComposeChrome }) {
  switch (request.mode) {
    case 'new':
      return <NewComposeLoader templateKey={request.templateKey} chrome={chrome} />;
    case 'draft':
      return <DraftComposeLoader draftId={request.draftId} chrome={chrome} />;
    case 'duplicate':
      return <DuplicateComposeLoader documentId={request.documentId} chrome={chrome} />;
    case 'edit':
    default:
      return <EditComposeLoader documentId={request.documentId} chrome={chrome} />;
  }
}

function ComposeStateShell({
  mode,
  onClose,
  children
}: {
  mode: ComposeMode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <ComposeHeader mode={mode} onClose={onClose} />
      <div className={SCROLL_CLASS}>
        <main className={MAIN_CLASS}>
          <DialogTitle className='sr-only'>{mode === 'edit' ? '문서 수정' : '문서 작성'}</DialogTitle>
          {children}
        </main>
      </div>
    </>
  );
}

/** 작성 · 이어쓰기 · 복제 · 수정 Dialog — lg↑ 가운데 큰 모달(좌 폼/우 결재선) · 모바일 전체 화면 */
export function WorkflowComposeDialog() {
  const { compose, composeKey, closeCompose } = useWorkflowCompose();
  const [guardOpen, setGuardOpen] = useState(false);
  const dirtyCheckRef = useRef<() => boolean>(() => false);

  const chrome = useMemo<ComposeChrome>(
    () => ({
      registerDirtyCheck: (check) => {
        dirtyCheckRef.current = check;
      },
      requestClose: () => {
        if (dirtyCheckRef.current()) {
          setGuardOpen(true);
        } else {
          dirtyCheckRef.current = () => false;
          closeCompose();
        }
      },
      forceClose: () => {
        dirtyCheckRef.current = () => false;
        setGuardOpen(false);
        closeCompose();
      }
    }),
    [closeCompose]
  );

  const mode = compose?.mode ?? 'new';

  return (
    <>
      <Dialog
        open={compose !== null}
        onOpenChange={(open) => {
          if (!open) chrome.requestClose();
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={DESCRIPTION_ID}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              chrome.requestClose();
            }}
            onInteractOutside={(event) => event.preventDefault()}
            className={cn(
              'fixed inset-0 z-50 flex h-dvh w-full flex-col bg-background shadow-lg outline-none',
              'lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[calc(100dvh-4rem)] lg:w-[min(80rem,calc(100vw-4rem))]',
              'lg:-translate-x-1/2 lg:-translate-y-1/2 lg:overflow-hidden lg:rounded-xl lg:border',
              'lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_minmax(0,1fr)_auto]',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
            )}
          >
            {compose ? (
              <WorkflowQueryBoundary
                key={composeKey}
                errorMessage='양식을 불러오지 못했습니다.'
                loadingFallback={
                  <ComposeStateShell mode={mode} onClose={chrome.forceClose}>
                    <PageLoadingSpinner variant='compact' />
                  </ComposeStateShell>
                }
                renderError={(_error, retry) => (
                  <ComposeStateShell mode={mode} onClose={chrome.forceClose}>
                    <WorkflowErrorAlert message='양식을 불러오지 못했습니다.' onRetry={retry} />
                  </ComposeStateShell>
                )}
              >
                <ComposeLoader request={compose} chrome={chrome} />
              </WorkflowQueryBoundary>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <AlertModal
        isOpen={guardOpen}
        onClose={() => setGuardOpen(false)}
        loading={false}
        title='작성을 그만둘까요?'
        description={
          mode === 'edit' ? '저장하지 않은 수정 내용은 사라집니다.' : '임시저장하지 않은 내용은 사라집니다.'
        }
        confirmLabel='나가기'
        cancelLabel='계속 작성'
        onConfirm={chrome.forceClose}
      />
    </>
  );
}
