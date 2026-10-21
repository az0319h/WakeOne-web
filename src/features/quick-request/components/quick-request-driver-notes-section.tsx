'use client';

import * as React from 'react';
import { useStore } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import { deleteQuickRequestNoteMutation } from '../api/mutations';
import { quickRequestKeys, quickRequestNotesQueryOptions } from '../api/queries';
import type { QuickRequestNote } from '../api/types';
import {
  QUICK_REQUEST_NOTE_MESSAGES,
  QUICK_REQUEST_NOTES_MAX_COUNT
} from '../schemas/quick-request-note';
import { removeNoteLabel, replaceNoteLabel, toggleNote } from '../schemas/quick-request-form';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestNoteCards } from './quick-request-note-cards';
import {
  QuickRequestNoteEditorDialog,
  type QuickRequestNoteEditorTarget
} from './quick-request-note-editor-dialog';
import { QuickRequestNoteManageList } from './quick-request-note-manage-list';
import { QuickRequestQueryBoundary } from './quick-request-query-boundary';
import { QuickRequestSectionShell } from './quick-request-section-shell';

const SECTION_ID = 'quick-request-section-driver-notes';
const SECTION_TITLE = '기사님 전달사항';

type FormProps = {
  form: QuickRequestOrderForm;
};

type DriverNotesColumnsProps = FormProps & {
  /** 출발·도착 칩 group (로딩·오류 시 null — 메모 칸은 항상 사용 가능) */
  originNotes?: React.ReactNode;
  destinationNotes?: React.ReactNode;
};

function DriverNotesColumns({ form, originNotes, destinationNotes }: DriverNotesColumnsProps) {
  return (
    <div className='@container min-w-0'>
      <div className='grid gap-6 @2xl:grid-cols-2'>
        <div className='min-w-0 space-y-4'>
          {originNotes}
          <form.AppField name='origin.memo'>
            {(field) => (
              <field.TextareaField
                label='픽업 메모'
                placeholder='픽업 시 참고 사항 (선택)…'
                rows={3}
                maxLength={500}
                className='bg-muted/50'
                data-testid='quick-request-origin-memo'
              />
            )}
          </form.AppField>
        </div>

        <div className='min-w-0 space-y-4'>
          {destinationNotes}
          <form.AppField name='destination.extraMemo'>
            {(field) => (
              <field.TextareaField
                label='추가 메모'
                placeholder='도착 시 참고 사항 (선택)…'
                rows={3}
                maxLength={500}
                className='bg-muted/50'
                data-testid='quick-request-destination-extra-memo'
              />
            )}
          </form.AppField>
        </div>
      </div>
    </div>
  );
}

/** 칩 목록 로드 완료 — 헤더 「편집」·「+ 추가」 · 편집 목록 · 두 group */
function DriverNotesLoaded({ form }: FormProps) {
  const { data: notes } = useSuspenseQuery(quickRequestNotesQueryOptions());
  const originNotes = useStore(form.store, (s) => s.values.origin.notes);
  const destinationNotes = useStore(form.store, (s) => s.values.destination.notes);

  const [isEditingState, setIsEditing] = React.useState(false);
  const isEditing = isEditingState && notes.length > 0;

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorTarget, setEditorTarget] = React.useState<QuickRequestNoteEditorTarget>({
    mode: 'create'
  });
  const [editorSession, setEditorSession] = React.useState(0);
  const [deleteTarget, setDeleteTarget] = React.useState<QuickRequestNote | null>(null);

  function openEditor(target: QuickRequestNoteEditorTarget) {
    setEditorTarget(target);
    setEditorSession((n) => n + 1);
    setEditorOpen(true);
  }

  function handleAdd() {
    if (notes.length >= QUICK_REQUEST_NOTES_MAX_COUNT) {
      notifyError(QUICK_REQUEST_NOTE_MESSAGES.limitExceeded);
      return;
    }
    openEditor({ mode: 'create' });
  }

  function syncFormNotes(update: (current: string[]) => string[]) {
    const values = form.state.values;
    const nextOrigin = update(values.origin.notes);
    const nextDestination = update(values.destination.notes);
    if (nextOrigin !== values.origin.notes) {
      form.setFieldValue('origin.notes', nextOrigin);
    }
    if (nextDestination !== values.destination.notes) {
      form.setFieldValue('destination.notes', nextDestination);
    }
  }

  const deleteMutation = useMutation({
    ...deleteQuickRequestNoteMutation,
    onSuccess: (data) => {
      syncFormNotes((current) => removeNoteLabel(current, data.label));
      notifySuccess('특이사항이 삭제되었습니다.');
      setDeleteTarget(null);
    },
    onError: (error) => {
      notifyError(
        error instanceof Error && error.message
          ? error.message
          : QUICK_REQUEST_NOTE_MESSAGES.internalError
      );
    }
  });

  return (
    <QuickRequestSectionShell
      id={SECTION_ID}
      title={SECTION_TITLE}
      optional
      description={`특이사항 ${notes.length}/${QUICK_REQUEST_NOTES_MAX_COUNT}`}
      action={
        <div className='flex gap-2'>
          {notes.length > 0 ? (
            <Button
              type='button'
              variant='ghost'
              className='min-h-11 px-3'
              aria-pressed={isEditing}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? '편집 완료' : '편집'}
            </Button>
          ) : null}
          <Button
            type='button'
            variant='outline'
            className='min-h-11 rounded-full px-4'
            data-testid='quick-request-note-add'
            onClick={handleAdd}
          >
            <Icons.add className='size-4' aria-hidden />
            추가
          </Button>
        </div>
      }
    >
      <div className='space-y-6'>
        {isEditing ? (
          <QuickRequestNoteManageList
            notes={notes}
            onEdit={(note) => openEditor({ mode: 'edit', note })}
            onDelete={setDeleteTarget}
          />
        ) : null}

        <DriverNotesColumns
          form={form}
          originNotes={
            isEditing ? null : (
              <QuickRequestNoteCards
                label='출발지 특이사항'
                notes={notes}
                selected={originNotes}
                groupTestId='quick-request-origin-notes'
                testIdPrefix='quick-request-origin-note'
                onToggle={(label) =>
                  form.setFieldValue('origin.notes', toggleNote(originNotes, label))
                }
              />
            )
          }
          destinationNotes={
            isEditing ? null : (
              <QuickRequestNoteCards
                label='도착지 특이사항'
                notes={notes}
                selected={destinationNotes}
                groupTestId='quick-request-destination-notes'
                testIdPrefix='quick-request-destination-note'
                onToggle={(label) =>
                  form.setFieldValue('destination.notes', toggleNote(destinationNotes, label))
                }
              />
            )
          }
        />
      </div>

      <QuickRequestNoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        target={editorTarget}
        sessionKey={editorSession}
        onUpdated={(previousLabel, nextLabel) =>
          syncFormNotes((current) => replaceNoteLabel(current, previousLabel, nextLabel))
        }
      />

      <AlertModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        loading={deleteMutation.isPending}
        title='특이사항 삭제'
        description={`「${deleteTarget?.label ?? ''}」 특이사항을 삭제합니다. 출발지·도착지에서 선택돼 있으면 함께 해제됩니다.`}
        confirmLabel='삭제'
        cancelLabel='취소'
      />
    </QuickRequestSectionShell>
  );
}

/** 로딩·오류 프레임 — 헤더 제목과 메모 칸은 유지 */
function DriverNotesFrame({ form, status }: FormProps & { status: React.ReactNode }) {
  return (
    <QuickRequestSectionShell id={SECTION_ID} title={SECTION_TITLE} optional>
      <div className='space-y-6'>
        {status}
        <DriverNotesColumns form={form} />
      </div>
    </QuickRequestSectionShell>
  );
}

export function QuickRequestDriverNotesSection({ form }: FormProps) {
  return (
    <QuickRequestQueryBoundary
      errorMessage='특이사항 목록을 불러오지 못했습니다.'
      ssrQueryKey={quickRequestKeys.notes()}
      loadingFallback={
        <DriverNotesFrame form={form} status={<PageLoadingSpinner variant='compact' />} />
      }
      renderError={(alert) => <DriverNotesFrame form={form} status={alert} />}
    >
      <DriverNotesLoaded form={form} />
    </QuickRequestQueryBoundary>
  );
}
