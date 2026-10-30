'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { LedgerToneBadge } from './asset-status-badge';

export type ManagerField = {
  label: string;
  value: React.ReactNode;
  /** 두 칸 차지(관리 메모 등) */
  wide?: boolean;
  mono?: boolean;
};

type AssetManagerSectionProps = {
  fields: ManagerField[];
  /** 요청이 하나라도 있으면 삭제 비활성 + 안내 (D-11) */
  hasRequests: boolean;
  deleteBlockedMessage: string;
  onEdit: () => void;
  onDelete: () => void;
};

const DELETE_NOTE_ID = 'asset-delete-blocked-note';

/**
 * 「관리 정보」 영역 — **권한자에게만 렌더**(CSS 숨김 아님 · AC-02·03).
 * 연보라 테두리 + 🔒 「권한자만 보여요」 · 수정(Sheet를 Dialog 위에) · 삭제(AlertModal).
 */
export function AssetManagerSection({
  fields,
  hasRequests,
  deleteBlockedMessage,
  onEdit,
  onDelete
}: AssetManagerSectionProps) {
  return (
    <section
      data-testid='asset-manager-section'
      aria-labelledby='asset-manager-section-title'
      className='rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 dark:bg-violet-500/10'
    >
      <div className='flex flex-wrap items-center gap-2'>
        <h3 id='asset-manager-section-title' className='text-sm font-semibold'>
          관리 정보
        </h3>
        <LedgerToneBadge tone='violet'>
          <Icons.lock aria-hidden className='size-3' />
          권한자만 보여요
        </LedgerToneBadge>
        <div className='ml-auto flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-11 md:h-8'
            data-testid='asset-edit-button'
            onClick={onEdit}
          >
            <Icons.edit aria-hidden />
            수정
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-11 text-destructive hover:text-destructive md:h-8'
            data-testid='asset-delete-button'
            disabled={hasRequests}
            aria-describedby={hasRequests ? DELETE_NOTE_ID : undefined}
            onClick={onDelete}
          >
            <Icons.trash aria-hidden />
            삭제
          </Button>
        </div>
      </div>
      <dl className='mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2'>
        {fields.map((field) => (
          <div key={field.label} className={field.wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
            <dt className='text-xs text-muted-foreground'>{field.label}</dt>
            <dd
              className={
                field.mono
                  ? 'mt-1 font-mono text-sm break-all tabular-nums'
                  : 'mt-1 text-sm break-words whitespace-pre-wrap'
              }
            >
              {field.value === null || field.value === undefined || field.value === ''
                ? '—'
                : field.value}
            </dd>
          </div>
        ))}
      </dl>
      {hasRequests ? (
        <p
          id={DELETE_NOTE_ID}
          data-testid='asset-delete-blocked-note'
          className='mt-4 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground'
        >
          <Icons.info aria-hidden className='mt-px size-4 shrink-0' />
          {deleteBlockedMessage}
        </p>
      ) : null}
    </section>
  );
}
