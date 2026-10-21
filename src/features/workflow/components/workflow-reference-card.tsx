'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

type ReferenceLike = {
  id: string;
  code: string;
  template_name: string;
  emoji: string;
  writer_name?: string | null;
};

/** 참조문서 카드 — 「📄 지출결의서 2026-0001」 (testid `workflow-reference-card-{code}`) */
export function WorkflowReferenceCard({
  reference,
  onOpen,
  onRemove
}: {
  reference: ReferenceLike;
  onOpen?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const label = (
    <>
      <span aria-hidden>{reference.emoji}</span>
      <span className='font-medium'>{reference.template_name}</span>
      <span className='font-mono text-xs'>{reference.code}</span>
      {reference.writer_name ? (
        <span className='truncate text-xs text-muted-foreground'>{reference.writer_name}</span>
      ) : null}
    </>
  );

  return (
    <div className='flex max-w-full min-w-0 items-center gap-1'>
      {onOpen ? (
        <Button
          type='button'
          variant='outline'
          size='sm'
          data-testid={`workflow-reference-card-${reference.code}`}
          className='h-auto min-h-9 max-w-full min-w-0 justify-start gap-2 py-1.5 font-normal whitespace-normal'
          onClick={() => onOpen(reference.id)}
        >
          {label}
        </Button>
      ) : (
        <span
          data-testid={`workflow-reference-card-${reference.code}`}
          className='inline-flex min-h-9 max-w-full min-w-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm'
        >
          {label}
        </span>
      )}
      {onRemove ? (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={`${reference.code} 참조 해제`}
          className='size-9 shrink-0 text-muted-foreground'
          onClick={() => onRemove(reference.id)}
        >
          <Icons.close aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
