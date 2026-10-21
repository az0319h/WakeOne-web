import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import {
  WORKFLOW_CHANGED_ATTACHMENTS_KEY,
  WORKFLOW_CHANGED_CONTENT_KEY,
  type WorkflowEvent,
  type WorkflowTemplateField
} from '../api/types';
import { WorkflowPersonAvatar } from './workflow-person';

function changedFieldLabels(keys: string[] | undefined, fields: WorkflowTemplateField[]): string[] {
  if (!keys?.length) return [];
  const names = new Map(fields.map((field) => [field.field_key, field.name]));
  return keys.map((key) => {
    if (key === WORKFLOW_CHANGED_CONTENT_KEY) return '본문';
    if (key === WORKFLOW_CHANGED_ATTACHMENTS_KEY) return '첨부파일';
    return names.get(key) ?? key;
  });
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <p className='mt-1.5 rounded-md bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap text-foreground'>
      {children}
    </p>
  );
}

function EventIcon({ event }: { event: WorkflowEvent }) {
  switch (event.type) {
    case 'WRITE':
    case 'COMMENT':
      return event.actor ? (
        <WorkflowPersonAvatar person={event.actor} className='size-6' />
      ) : (
        <span className='size-6 rounded-full bg-muted' />
      );
    case 'CHANGE_STAGE_STAKE_HOLDERS':
      return <Icons.refresh aria-hidden className='size-5 text-muted-foreground' />;
    case 'APPROVE':
      return <Icons.circleCheck aria-hidden className='size-5 text-green-600 dark:text-green-400' />;
    case 'DECLINE':
      return <Icons.ban aria-hidden className='size-5 text-destructive' />;
    case 'CANCEL':
      return <Icons.circleX aria-hidden className='size-5 text-muted-foreground' />;
    case 'UPDATE':
    default:
      return <Icons.edit aria-hidden className='size-5 text-muted-foreground' />;
  }
}

function eventSentence(event: WorkflowEvent): string | null {
  switch (event.type) {
    case 'WRITE':
      return '님이 글을 작성했어요.';
    case 'CHANGE_STAGE_STAKE_HOLDERS':
      return '님이 승인·참조자를 변경했어요.';
    case 'APPROVE':
      return '님이 승인했어요.';
    case 'DECLINE':
      return '님이 반려했어요.';
    case 'CANCEL':
      return '님이 문서를 취소했어요.';
    case 'UPDATE':
      return '님이 문서를 수정했어요.';
    case 'COMMENT':
    default:
      return null;
  }
}

/** 타임라인 + 댓글 (designer §3.4) — 시각은 절대 시각 */
export function WorkflowTimeline({
  events,
  fields
}: {
  events: WorkflowEvent[];
  fields: WorkflowTemplateField[];
}) {
  return (
    <ol data-testid='workflow-timeline' aria-label='활동' className='flex flex-col gap-4'>
      {events.map((event) => {
        const name = event.actor?.full_name ?? '알 수 없음';
        const sentence = eventSentence(event);
        const changed = event.type === 'UPDATE' ? changedFieldLabels(event.payload.changed_field_keys, fields) : [];
        const diffLines = event.type === 'CHANGE_STAGE_STAKE_HOLDERS' ? (event.payload.diff_lines ?? []) : [];
        return (
          <li key={event.id} data-testid='workflow-timeline-item' className='flex gap-3'>
            <span className='flex size-6 shrink-0 items-center justify-center pt-0.5'>
              <EventIcon event={event} />
            </span>
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5'>
                <p className='min-w-0 text-sm'>
                  <span className='font-medium text-foreground'>{name}</span>
                  {sentence ? <span className='text-foreground'>{sentence}</span> : null}
                </p>
                <time
                  dateTime={event.created_at}
                  className='shrink-0 text-xs text-muted-foreground tabular-nums'
                >
                  {formatAbsoluteDateTimeKo(event.created_at)}
                </time>
              </div>
              {event.type === 'COMMENT' && event.content ? (
                <p className='mt-1 text-sm break-words whitespace-pre-wrap text-foreground'>
                  {event.content}
                </p>
              ) : null}
              {(event.type === 'APPROVE' || event.type === 'DECLINE') && event.content ? (
                <Quote>{event.content}</Quote>
              ) : null}
              {diffLines.length > 0 ? (
                <ul className='mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground'>
                  {diffLines.map((line, index) => (
                    <li key={`${event.id}-${index}`} className='break-words'>
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              {changed.length > 0 ? (
                <p className='mt-1 text-sm text-muted-foreground'>바뀐 항목: {changed.join(', ')}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
