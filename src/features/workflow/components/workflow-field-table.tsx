'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import type {
  WorkflowDocumentDetail,
  WorkflowInputValue,
  WorkflowTemplateField
} from '../api/types';
import { formatWorkflowDateValue } from '../lib/date-value';
import { formatAmountWon } from '../lib/format-amount';
import { isEmptyWorkflowValue, type WorkflowFieldType } from '../lib/required-rules';
import { WorkflowReferenceCard } from './workflow-reference-card';

export const WORKFLOW_FIELD_ICONS: Record<WorkflowFieldType, keyof typeof Icons> = {
  SELECT: 'circleCheck',
  MULTISELECT: 'list',
  STRING: 'text',
  DATE: 'calendar',
  AMOUNT_OF_MONEY: 'currencyWon',
  TASK_REFERENCE: 'link'
};

function Placeholder() {
  return <span className='text-muted-foreground'>-</span>;
}

function FieldValue({
  field,
  value,
  references,
  onOpenReference
}: {
  field: WorkflowTemplateField;
  value: WorkflowInputValue | undefined;
  references: WorkflowDocumentDetail['references'];
  onOpenReference: (id: string) => void;
}) {
  if (field.type === 'TASK_REFERENCE') {
    const ids = Array.isArray(value) ? value : [];
    const visible = references.filter((reference) => ids.length === 0 || ids.includes(reference.id));
    if (visible.length === 0) return <Placeholder />;
    return (
      <div className='flex flex-wrap gap-2'>
        {visible.map((reference) => (
          <WorkflowReferenceCard key={reference.id} reference={reference} onOpen={onOpenReference} />
        ))}
      </div>
    );
  }

  if (isEmptyWorkflowValue(value)) return <Placeholder />;

  if (field.type === 'SELECT' || field.type === 'MULTISELECT') {
    const items = Array.isArray(value) ? value : [value as string];
    return (
      <div className='flex flex-wrap gap-1'>
        {items.map((item) => (
          <Badge key={item} variant='secondary' className='rounded-md font-normal'>
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  const text = Array.isArray(value) ? value.join(', ') : (value ?? '');

  if (field.type === 'AMOUNT_OF_MONEY') {
    return <span className='tabular-nums'>{formatAmountWon(text) || text}</span>;
  }
  if (field.type === 'DATE') {
    return <span className='tabular-nums'>{formatWorkflowDateValue(text)}</span>;
  }
  if (/^https?:\/\//i.test(text.trim())) {
    return (
      <a
        href={text.trim()}
        target='_blank'
        rel='noopener noreferrer'
        className='break-all text-primary underline-offset-4 hover:underline'
      >
        {text}
      </a>
    );
  }
  return <span className='break-words whitespace-pre-wrap'>{text}</span>;
}

/** 입력 필드 표 (dl) — 라벨은 문서 template_snapshot 필드 이름 */
export function WorkflowFieldTable({
  document,
  onOpenReference
}: {
  document: WorkflowDocumentDetail;
  onOpenReference: (id: string) => void;
}) {
  const fields = [...(document.template_snapshot.fields ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );
  return (
    <dl className='grid grid-cols-1 gap-y-4 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-x-6'>
      {fields.map((field) => {
        const Icon = Icons[WORKFLOW_FIELD_ICONS[field.type]];
        return (
          <div key={field.field_key} className='contents'>
            <dt className='flex items-center gap-2 text-sm text-muted-foreground md:min-h-6'>
              <Icon aria-hidden className='size-4 shrink-0' />
              {field.name}
            </dt>
            <dd className='-mt-3 min-w-0 text-sm text-foreground md:mt-0'>
              <FieldValue
                field={field}
                value={document.values[field.field_key]}
                references={document.references}
                onOpenReference={onOpenReference}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
