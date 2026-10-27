'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { QuickRequestNote } from '../api/types';

type QuickRequestNoteManageListProps = {
  notes: QuickRequestNote[];
  onEdit: (note: QuickRequestNote) => void;
  onDelete: (note: QuickRequestNote) => void;
};

/** 편집 모드 — 칩 수정·삭제 목록 (id별 testid 1개씩) */
export function QuickRequestNoteManageList({
  notes,
  onEdit,
  onDelete
}: QuickRequestNoteManageListProps) {
  const labelId = React.useId();

  return (
    <div className='space-y-3'>
      <p id={labelId} className='text-sm font-medium text-foreground'>
        내 특이사항 목록
      </p>
      <ul aria-labelledby={labelId} className='divide-y rounded-lg border bg-card'>
        {notes.map((note) => (
          <li key={note.id} className='flex min-h-11 items-center gap-1 pl-3'>
            <span className='min-w-0 flex-1 text-sm break-keep wrap-break-word text-foreground'>
              {note.label}
            </span>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-11'
              aria-label={`${note.label} 수정`}
              data-testid={`quick-request-note-edit-${note.id}`}
              onClick={() => onEdit(note)}
            >
              <Icons.edit className='size-4' aria-hidden />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-11 text-destructive hover:text-destructive'
              aria-label={`${note.label} 삭제`}
              data-testid={`quick-request-note-delete-${note.id}`}
              onClick={() => onDelete(note)}
            >
              <Icons.trash className='size-4' aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
