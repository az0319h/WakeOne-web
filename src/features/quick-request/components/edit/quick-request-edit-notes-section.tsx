'use client';

import { useMemo } from 'react';
import { useStore } from '@tanstack/react-form';
import type { QuickRequestNote } from '../../api/types';
import { toggleNote } from '../../schemas/quick-request-form';
import { QuickRequestDriverNotesColumns } from '../quick-request-driver-notes-section';
import type { QuickRequestOrderForm } from '../quick-request-form-api';
import { QuickRequestNoteCards } from '../quick-request-note-cards';
import { QuickRequestSectionShell } from '../quick-request-section-shell';

type EditNoteGroupProps = {
  label: string;
  notes: QuickRequestNote[];
  selected: string[];
  onToggle: (label: string) => void;
  groupTestId: string;
  testIdPrefix: string;
};

function EditNoteGroup({ label, notes, selected, onToggle, groupTestId, testIdPrefix }: EditNoteGroupProps) {
  if (notes.length === 0) {
    return (
      <div className='space-y-3'>
        <p className='text-sm font-medium text-foreground'>{label}</p>
        <p data-testid={groupTestId} className='text-sm text-muted-foreground'>
          선택된 특이사항이 없습니다.
        </p>
      </div>
    );
  }
  return (
    <QuickRequestNoteCards
      label={label}
      notes={notes}
      selected={selected}
      onToggle={onToggle}
      groupTestId={groupTestId}
      testIdPrefix={testIdPrefix}
    />
  );
}

function toNoteChips(labels: string[]): QuickRequestNote[] {
  return labels.map((label, index) => ({ id: index, label }));
}

type QuickRequestEditNotesSectionProps = {
  form: QuickRequestOrderForm;
  /** 처음 저장된 라벨 — 해제한 칩도 목록에 남아 다시 켤 수 있다 (새 라벨 추가 불가 · designer K7) */
  initialOriginNotes: string[];
  initialDestinationNotes: string[];
};

/** 수정 Sheet 전용 경량 특이사항 — 칩 「관리」 CRUD 없음 (notes API는 동방에게 403) */
export function QuickRequestEditNotesSection({
  form,
  initialOriginNotes,
  initialDestinationNotes
}: QuickRequestEditNotesSectionProps) {
  const originNotes = useStore(form.store, (s) => s.values.origin.notes);
  const destinationNotes = useStore(form.store, (s) => s.values.destination.notes);
  const originChips = useMemo(() => toNoteChips(initialOriginNotes), [initialOriginNotes]);
  const destinationChips = useMemo(
    () => toNoteChips(initialDestinationNotes),
    [initialDestinationNotes]
  );

  return (
    <QuickRequestSectionShell id='quick-request-edit-section-driver-notes' title='기사님 전달사항' optional>
      <QuickRequestDriverNotesColumns
        form={form}
        originNotes={
          <EditNoteGroup
            label='출발지 특이사항'
            notes={originChips}
            selected={originNotes}
            groupTestId='quick-request-edit-origin-notes'
            testIdPrefix='quick-request-edit-origin-note'
            onToggle={(label) => form.setFieldValue('origin.notes', toggleNote(originNotes, label))}
          />
        }
        destinationNotes={
          <EditNoteGroup
            label='도착지 특이사항'
            notes={destinationChips}
            selected={destinationNotes}
            groupTestId='quick-request-edit-destination-notes'
            testIdPrefix='quick-request-edit-destination-note'
            onToggle={(label) =>
              form.setFieldValue('destination.notes', toggleNote(destinationNotes, label))
            }
          />
        }
      />
    </QuickRequestSectionShell>
  );
}
