'use client';

import { Suspense, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { workflowReferenceSearchQueryOptions } from '../api/queries';
import type { WorkflowReferenceDocument } from '../api/types';
import { WORKFLOW_REFERENCE_MAX_COUNT } from '../lib/required-rules';
import { useIsDesktop } from './use-is-desktop';
import { WorkflowStatusBadge } from './workflow-status-badge';

function ReferenceResults({
  q,
  excludeId,
  selected,
  onToggle
}: {
  q: string;
  excludeId: string | null;
  selected: Map<string, WorkflowReferenceDocument>;
  onToggle: (doc: WorkflowReferenceDocument) => void;
}) {
  const { data } = useSuspenseQuery(workflowReferenceSearchQueryOptions(q, excludeId));
  if (data.rows.length === 0) {
    return <p className='py-8 text-center text-sm text-muted-foreground'>검색 결과가 없습니다.</p>;
  }
  return (
    <ul className='flex flex-col gap-1'>
      {data.rows.map((row) => {
        const checked = selected.has(row.id);
        const reference: WorkflowReferenceDocument = {
          id: row.id,
          code: row.code,
          template_name: row.template.name,
          emoji: row.template.emoji,
          writer_name: row.writer.full_name,
          status: row.status
        };
        const inputId = `workflow-reference-option-${row.id}`;
        return (
          <li key={row.id}>
            <Label
              htmlFor={inputId}
              className='flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 py-2 font-normal hover:bg-muted/50'
            >
              <Checkbox id={inputId} checked={checked} onCheckedChange={() => onToggle(reference)} />
              <span aria-hidden className='text-lg'>
                {row.template.emoji}
              </span>
              <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <span className='flex min-w-0 items-center gap-2'>
                  <span className='truncate text-sm font-medium'>{row.template.name}</span>
                  <span className='font-mono text-xs text-muted-foreground'>{row.code}</span>
                </span>
                <span className='truncate text-xs text-muted-foreground'>{row.writer.full_name}</span>
              </span>
              <WorkflowStatusBadge
                status={row.status}
                currentStep={row.current_step}
                totalSteps={row.total_steps}
              />
            </Label>
          </li>
        );
      })}
    </ul>
  );
}

/** 참조문서 선택 — 내가 열람할 수 있는 문서만 검색된다 (RLS) */
export function WorkflowReferencePickerDialog({
  open,
  onOpenChange,
  initialSelected,
  excludeId,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelected: WorkflowReferenceDocument[];
  excludeId: string | null;
  onConfirm: (selected: WorkflowReferenceDocument[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const isDesktop = useIsDesktop();
  // 부모가 열 때마다 새로 마운트한다 → 초기 선택은 initializer로
  const [selected, setSelected] = useState<Map<string, WorkflowReferenceDocument>>(
    () => new Map(initialSelected.map((doc) => [doc.id, doc]))
  );
  const debouncedSetQ = useDebouncedCallback((value: string) => setQ(value.trim()), 300);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  function toggle(doc: WorkflowReferenceDocument) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(doc.id)) {
        next.delete(doc.id);
      } else if (next.size < WORKFLOW_REFERENCE_MAX_COUNT) {
        next.set(doc.id, doc);
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid='workflow-reference-picker'
        className='flex max-h-[85dvh] flex-col sm:max-w-lg'
        // 휴대폰: 열자마자 검색칸에 포커스하면 키보드가 결과를 가린다 (양식 선택 Dialog와 동일)
        onOpenAutoFocus={(event) => {
          if (!isDesktop) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>참조문서 선택</DialogTitle>
          <DialogDescription>열람할 수 있는 문서만 검색됩니다.</DialogDescription>
        </DialogHeader>
        <div className='relative'>
          <Icons.search
            aria-hidden
            className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
          />
          <Input
            type='search'
            value={search}
            placeholder='문서번호·내용 검색…'
            aria-label='참조문서 검색'
            className='h-10 pl-9'
            onChange={(event) => {
              setSearch(event.target.value);
              debouncedSetQ(event.target.value);
            }}
          />
        </div>
        <div className='min-h-40 flex-1 overflow-y-auto overscroll-contain'>
          {open ? (
            <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
              <ReferenceResults q={q} excludeId={excludeId} selected={selected} onToggle={toggle} />
            </Suspense>
          ) : null}
        </div>
        <DialogFooter className='gap-2'>
          <Button type='button' variant='outline' className='h-11 sm:h-9' onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button
            type='button'
            className='h-11 sm:h-9'
            onClick={() => {
              onConfirm([...selected.values()]);
              onOpenChange(false);
            }}
          >
            선택 완료 ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
