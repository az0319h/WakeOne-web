'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { deleteWorkflowDraftMutation } from '../api/mutations';
import { workflowDraftsQueryOptions, workflowTemplatesQueryOptions } from '../api/queries';
import type { WorkflowDraftListItem } from '../api/types';
import { useWorkflowCompose } from './workflow-compose-context';
import { WorkflowQueryBoundary } from './workflow-query-boundary';
import { useIsDesktop } from './use-is-desktop';

const DESCRIPTION_ID = 'workflow-template-picker-description';
const DRAFT_PREVIEW_COUNT = 3;

function EmojiTile({ emoji }: { emoji: string }) {
  return (
    <span aria-hidden className='grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xl'>
      {emoji}
    </span>
  );
}

function DraftSection({ search }: { search: string }) {
  const { data: drafts } = useSuspenseQuery(workflowDraftsQueryOptions());
  const { openCompose } = useWorkflowCompose();
  const [expanded, setExpanded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowDraftListItem | null>(null);
  const deleteMutation = useMutation({ ...deleteWorkflowDraftMutation });

  const keyword = search.trim().toLowerCase();
  const filtered = keyword
    ? drafts.filter((draft) => draft.template.name.toLowerCase().includes(keyword))
    : drafts;

  if (filtered.length === 0) return null;
  const visible = expanded ? filtered : filtered.slice(0, DRAFT_PREVIEW_COUNT);

  return (
    <section data-testid='workflow-draft-list' aria-labelledby='workflow-draft-list-title' className='flex flex-col gap-2'>
      <h3 id='workflow-draft-list-title' className='text-sm font-semibold'>
        이어서 작성하기 {filtered.length}개
      </h3>
      <ul className='flex flex-col gap-1'>
        {visible.map((draft) => (
          <li key={draft.id} className='flex items-center gap-1 rounded-lg hover:bg-muted/50'>
            <Button
              type='button'
              variant='ghost'
              data-testid={`workflow-draft-${draft.id}`}
              className='h-auto min-h-14 flex-1 justify-start gap-3 px-2 py-2 text-left font-normal whitespace-normal'
              onClick={() => openCompose({ mode: 'draft', draftId: draft.id })}
            >
              <EmojiTile emoji={draft.template.emoji} />
              <span className='flex min-w-0 flex-col gap-0.5'>
                <span className='flex items-center gap-2'>
                  <span className='truncate text-sm font-medium'>{draft.template.name}</span>
                  <Badge variant='secondary' className='font-normal'>
                    임시저장
                  </Badge>
                </span>
                <time dateTime={draft.updated_at} className='text-xs text-muted-foreground tabular-nums'>
                  {formatAbsoluteDateTimeKo(draft.updated_at)}
                </time>
              </span>
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='임시저장 삭제'
              data-testid={`workflow-draft-delete-${draft.id}`}
              className='size-11 shrink-0 text-muted-foreground'
              onClick={() => setDeleteTarget(draft)}
            >
              <Icons.close aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      {filtered.length > DRAFT_PREVIEW_COUNT ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-9 self-start text-muted-foreground'
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? '접기' : '더 보기'}
          {expanded ? <Icons.chevronUp aria-hidden /> : <Icons.chevronDown aria-hidden />}
        </Button>
      ) : null}

      <AlertModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
        title='임시저장 삭제'
        description='임시저장한 내용과 첨부파일이 삭제됩니다.'
        confirmLabel='삭제'
        cancelLabel='취소'
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(
            { id: deleteTarget.id },
            {
              onSuccess: () => {
                notifySuccess('임시저장을 삭제했습니다.');
                setDeleteTarget(null);
              },
              onError: (error) => notifyError(error.message)
            }
          );
        }}
      />
    </section>
  );
}

function TemplateSection({ search }: { search: string }) {
  const { data: templates } = useSuspenseQuery(workflowTemplatesQueryOptions());
  const { openCompose } = useWorkflowCompose();
  const keyword = search.trim().toLowerCase();
  const filtered = keyword
    ? templates.filter((template) => template.name.toLowerCase().includes(keyword))
    : templates;
  const tags = [...new Set(filtered.flatMap((template) => template.tags))];

  return (
    <section aria-labelledby='workflow-template-list-title' className='flex flex-col gap-2'>
      <h3 id='workflow-template-list-title' className='text-sm font-semibold'>
        워크플로우 양식 선택
      </h3>
      {tags.length > 0 ? (
        <div className='flex flex-wrap gap-1'>
          {tags.map((tag) => (
            <Badge key={tag} variant='outline' className='font-normal'>
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      {filtered.length === 0 ? (
        <p className='py-8 text-center text-sm text-muted-foreground'>검색 결과가 없습니다.</p>
      ) : (
        <ul className='flex flex-col gap-1'>
          {filtered.map((template) => (
            <li key={template.template_key}>
              <Button
                type='button'
                variant='ghost'
                data-testid={`workflow-template-option-${template.template_key}`}
                className='h-auto min-h-14 w-full justify-start gap-3 px-2 py-2 text-left font-normal'
                onClick={() => openCompose({ mode: 'new', templateKey: template.template_key })}
              >
                <EmojiTile emoji={template.emoji} />
                <span className='text-sm font-medium'>{template.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 양식 선택 + 이어서 작성하기 — lg 미만 전체 화면 · lg↑ 가운데 */
export function WorkflowTemplatePickerDialog() {
  const { pickerOpen, setPickerOpen } = useWorkflowCompose();
  const [search, setSearch] = useState('');
  const isDesktop = useIsDesktop();

  return (
    <Dialog
      open={pickerOpen}
      onOpenChange={(open) => {
        setPickerOpen(open);
        if (!open) setSearch('');
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-testid='workflow-template-picker'
          aria-describedby={DESCRIPTION_ID}
          onOpenAutoFocus={(event) => {
            if (!isDesktop) event.preventDefault();
          }}
          className={cn(
            'fixed inset-0 z-50 flex h-dvh w-full flex-col bg-background shadow-lg outline-none',
            'lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[min(44rem,calc(100dvh-4rem))] lg:max-w-xl',
            'lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-lg lg:border',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          )}
        >
          <header className='flex shrink-0 items-center gap-2 border-b px-4 py-3'>
            <DialogTitle className='sr-only'>문서 작성하기</DialogTitle>
            <DialogDescription id={DESCRIPTION_ID} className='sr-only'>
              작성할 양식을 고르거나 임시저장한 문서를 이어서 작성합니다.
            </DialogDescription>
            <div className='relative min-w-0 flex-1'>
              <Icons.search
                aria-hidden
                className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
              />
              <Input
                type='search'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='양식 검색…'
                aria-label='양식 검색'
                data-testid='workflow-template-search'
                autoFocus={isDesktop}
                className='h-10 pl-9'
              />
            </div>
            <DialogPrimitive.Close asChild>
              <Button type='button' variant='ghost' size='icon' aria-label='닫기' className='size-10 shrink-0'>
                <Icons.close aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-4'>
            <WorkflowQueryBoundary errorMessage='임시저장 목록을 불러오지 못했습니다.'>
              <DraftSection search={search} />
            </WorkflowQueryBoundary>
            <WorkflowQueryBoundary errorMessage='양식을 불러오지 못했습니다.'>
              <TemplateSection search={search} />
            </WorkflowQueryBoundary>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
