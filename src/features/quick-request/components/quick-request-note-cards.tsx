'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import type { QuickRequestNote } from '../api/types';

type QuickRequestNoteCardsProps = {
  label: string;
  notes: QuickRequestNote[];
  selected: string[];
  onToggle: (label: string) => void;
  /** group testid (예: `quick-request-origin-notes`) */
  groupTestId: string;
  /** 칩 testid 접두 — `{prefix}-{id}` */
  testIdPrefix: string;
};

/** 특이사항 pill 칩 (복수 선택 · aria-pressed · 44px) — 사용자별 DB 목록 */
export function QuickRequestNoteCards({
  label,
  notes,
  selected,
  onToggle,
  groupTestId,
  testIdPrefix
}: QuickRequestNoteCardsProps) {
  const labelId = React.useId();

  return (
    <div className='space-y-3'>
      <p id={labelId} className='text-sm font-medium text-foreground'>
        {label}
      </p>
      <div
        role='group'
        aria-labelledby={labelId}
        data-testid={groupTestId}
        className='flex flex-wrap gap-2'
      >
        {notes.length === 0 ? (
          <p className='text-sm text-muted-foreground'>등록된 특이사항이 없습니다.</p>
        ) : (
          notes.map((note) => {
            const isSelected = selected.includes(note.label);
            return (
              <Button
                key={note.id}
                type='button'
                variant={isSelected ? 'default' : 'outline'}
                aria-pressed={isSelected}
                className='h-auto min-h-11 max-w-full rounded-full px-4 text-left break-keep whitespace-normal'
                data-testid={`${testIdPrefix}-${note.id}`}
                onClick={() => onToggle(note.label)}
              >
                {note.label}
              </Button>
            );
          })
        )}
      </div>
    </div>
  );
}
