'use client';

import { useId, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { workflowDocumentQueryOptions } from '../api/queries';
import type {
  WorkflowInputValue,
  WorkflowReferenceDocument,
  WorkflowTemplateField
} from '../api/types';
import { WORKFLOW_FIELD_ICONS } from './workflow-field-table';
import {
  AmountWidget,
  DateWidget,
  MultiSelectWidget,
  SelectWidget,
  StringWidget,
  WORKFLOW_WIDGET_TONE,
  type WidgetA11yProps
} from './workflow-field-widgets';
import { WorkflowQueryBoundary } from './workflow-query-boundary';
import { WorkflowReferenceCard } from './workflow-reference-card';
import { WorkflowReferencePickerDialog } from './workflow-reference-picker-dialog';

/** 임시저장에서 불러온 참조문서처럼 표시 정보가 없는 id → 상세 조회로 채운다 */
function ReferenceCardById({ id, onRemove }: { id: string; onRemove: (id: string) => void }) {
  const { data } = useSuspenseQuery(workflowDocumentQueryOptions(id));
  return (
    <WorkflowReferenceCard
      reference={{
        id: data.id,
        code: data.code,
        template_name: data.template.name,
        emoji: data.template.emoji,
        writer_name: data.writer.full_name
      }}
      onRemove={onRemove}
    />
  );
}

function ReferenceWidget({
  value,
  onChange,
  a11y,
  referenceInfo,
  onReferenceInfo,
  excludeId
}: {
  value: string[];
  onChange: (next: string[]) => void;
  a11y: WidgetA11yProps;
  referenceInfo: Map<string, WorkflowReferenceDocument>;
  onReferenceInfo: (docs: WorkflowReferenceDocument[]) => void;
  excludeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const remove = (id: string) => onChange(value.filter((entry) => entry !== id));
  const known = value.flatMap((id) => {
    const info = referenceInfo.get(id);
    return info ? [info] : [];
  });

  return (
    <div className='flex flex-col items-start gap-2'>
      {value.length > 0 ? (
        <div className='flex max-w-full flex-wrap gap-2'>
          {value.map((id) => {
            const info = referenceInfo.get(id);
            return info ? (
              <WorkflowReferenceCard key={id} reference={info} onRemove={remove} />
            ) : (
              <WorkflowQueryBoundary
                key={id}
                errorMessage='참조문서를 불러오지 못했습니다.'
                loadingFallback={<Spinner />}
                renderError={() => (
                  <span className='inline-flex items-center gap-1 text-sm text-muted-foreground'>
                    열람할 수 없는 문서
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label='참조 해제'
                      className='size-8'
                      onClick={() => remove(id)}
                    >
                      <Icons.close aria-hidden />
                    </Button>
                  </span>
                )}
              >
                <ReferenceCardById id={id} onRemove={remove} />
              </WorkflowQueryBoundary>
            );
          })}
        </div>
      ) : null}
      <Button
        {...a11y}
        type='button'
        variant='ghost'
        className={`h-9 justify-start font-normal text-muted-foreground ${WORKFLOW_WIDGET_TONE}`}
        onClick={() => setOpen(true)}
      >
        <Icons.add aria-hidden />
        {value.length > 0 ? '문서 선택' : '문서를 추가해 주세요.'}
      </Button>
      {open ? (
        <WorkflowReferencePickerDialog
          open
          onOpenChange={setOpen}
          initialSelected={known}
          excludeId={excludeId}
          onConfirm={(docs) => {
            onReferenceInfo(docs);
            const keepUnknown = value.filter((id) => !referenceInfo.has(id));
            const next = [...new Set([...keepUnknown, ...docs.map((doc) => doc.id)])];
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}

export type WorkflowDynamicFieldProps = {
  field: WorkflowTemplateField;
  required: boolean;
  value: WorkflowInputValue;
  onChange: (next: WorkflowInputValue) => void;
  onBlur: () => void;
  error: string | null;
  referenceInfo: Map<string, WorkflowReferenceDocument>;
  onReferenceInfo: (docs: WorkflowReferenceDocument[]) => void;
  excludeDocumentId: string | null;
};

/** 동적 입력칸 1행 — 라벨(아이콘·이름·필수 점) + 타입별 위젯 + 오류 (designer §4.3) */
export function WorkflowDynamicField({
  field,
  required,
  value,
  onChange,
  onBlur,
  error,
  referenceInfo,
  onReferenceInfo,
  excludeDocumentId
}: WorkflowDynamicFieldProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const controlId = `${baseId}-control`;
  const errorId = `${baseId}-error`;
  const Icon = Icons[WORKFLOW_FIELD_ICONS[field.type]];
  const a11y: WidgetA11yProps = {
    id: controlId,
    'aria-labelledby': labelId,
    'aria-required': required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined
  };
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : [];

  let widget: React.ReactNode;
  switch (field.type) {
    case 'SELECT':
      widget = (
        <SelectWidget value={text} onChange={onChange} onBlur={onBlur} a11y={a11y} options={field.options} />
      );
      break;
    case 'MULTISELECT':
      widget = (
        <MultiSelectWidget value={list} onChange={onChange} onBlur={onBlur} a11y={a11y} options={field.options} />
      );
      break;
    case 'DATE':
      widget = (
        <DateWidget value={text} onChange={onChange} onBlur={onBlur} a11y={a11y} clearable={!field.required} />
      );
      break;
    case 'AMOUNT_OF_MONEY':
      widget = <AmountWidget value={text} onChange={onChange} onBlur={onBlur} a11y={a11y} />;
      break;
    case 'TASK_REFERENCE':
      widget = (
        <ReferenceWidget
          value={list}
          onChange={onChange}
          a11y={a11y}
          referenceInfo={referenceInfo}
          onReferenceInfo={onReferenceInfo}
          excludeId={excludeDocumentId}
        />
      );
      break;
    case 'STRING':
    default:
      widget = <StringWidget value={text} onChange={onChange} onBlur={onBlur} a11y={a11y} />;
  }

  return (
    <div
      data-testid={`workflow-field-${field.field_key}`}
      data-invalid={error ? 'true' : undefined}
      role='group'
      aria-labelledby={labelId}
      className='flex flex-col gap-1.5 md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:items-start md:gap-x-6'
    >
      <div className='flex min-h-9 items-center gap-2 text-sm text-muted-foreground'>
        <Icon aria-hidden className='size-4 shrink-0' />
        <span id={labelId} className='text-foreground'>
          {field.name}
        </span>
        {required ? (
          <span
            data-testid={`workflow-field-required-${field.field_key}`}
            className='inline-block size-1.5 shrink-0 rounded-full bg-destructive'
          >
            <span className='sr-only'>필수</span>
          </span>
        ) : null}
      </div>
      <div className='flex min-w-0 flex-col gap-1'>
        {widget}
        {error ? (
          <FieldError id={errorId} data-testid={`workflow-field-error-${field.field_key}`}>
            {error}
          </FieldError>
        ) : null}
      </div>
    </div>
  );
}
