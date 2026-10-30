import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { WorkflowActorStatus, WorkflowDocumentDetail, WorkflowTemplateField } from '../api/types';
import { formatWorkflowDateValue } from '../lib/date-value';
import { formatAmountWon } from '../lib/format-amount';
import { isEmptyRichContent, WORKFLOW_RICH_CONTENT_CLASS } from '../lib/rich-content-class';
import { isEmptyWorkflowValue } from '../lib/required-rules';
import { getWorkflowStatusLabel } from './workflow-status-badge';

const ACTOR_STATUS_LABEL: Record<WorkflowActorStatus, string> = {
  WAITING: '대기중',
  APPROVED: '승인',
  DECLINED: '반려'
};

function printValue(field: WorkflowTemplateField, document: WorkflowDocumentDetail): string {
  const value = document.values[field.field_key];
  if (field.type === 'TASK_REFERENCE') {
    const ids = Array.isArray(value) ? value : [];
    const refs = document.references.filter((reference) => ids.length === 0 || ids.includes(reference.id));
    return refs.length ? refs.map((reference) => `${reference.template_name} ${reference.code}`).join(', ') : '-';
  }
  if (isEmptyWorkflowValue(value)) return '-';
  const text = Array.isArray(value) ? value.join(', ') : (value ?? '');
  if (field.type === 'AMOUNT_OF_MONEY') return formatAmountWon(text) || text;
  if (field.type === 'DATE') return formatWorkflowDateValue(text);
  return text;
}

const CELL =
  'border border-border px-2 py-1.5 align-top break-words max-sm:px-1.5 print:border-black/40';

/** 인쇄 전용 본문 — A4 · 흑백에서도 읽히게 상태는 텍스트로 (designer §7) */
export function WorkflowPrintView({ document }: { document: WorkflowDocumentDetail }) {
  const fields = [...(document.template_snapshot.fields ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );
  const steps = [...document.steps].sort((a, b) => a.step - b.step);

  return (
    <div className='flex flex-col gap-6 text-sm'>
      <style>{`@page { size: A4; margin: 15mm; } @media print { table, tr { break-inside: avoid; } }`}</style>
      <header className='flex flex-col gap-1'>
        <div className='flex items-start justify-between gap-4'>
          <h1 className='text-2xl font-bold'>{document.template.name}</h1>
          <span className='shrink-0 rounded border border-border px-2 py-0.5 text-sm print:border-black/60'>
            {getWorkflowStatusLabel({
              status: document.status,
              currentStep: document.current_step,
              totalSteps: document.total_steps
            })}
          </span>
        </div>
        <p>
          문서번호 <span className='font-mono'>{document.code}</span>
        </p>
        <p className='text-muted-foreground print:text-black'>
          작성자 {document.writer.full_name} · 작성 {formatAbsoluteDateTimeKo(document.written_at)}
        </p>
      </header>

      <section className='flex flex-col gap-2'>
        <h2 className='font-semibold'>결재선</h2>
        {/* 모바일(<sm) 고정 폭 합이 본문보다 커서 승인자 열이 0px 되던 문제 — 좁은 폭에선 열을 줄이고 일시는 줄바꿈 */}
        <table className='w-full table-fixed border-collapse'>
          <thead>
            <tr>
              <th
                className={`${CELL} w-14 bg-muted text-left sm:w-16 print:w-16 print:bg-transparent`}
              >
                단계
              </th>
              <th className={`${CELL} bg-muted text-left print:bg-transparent`}>승인자</th>
              <th
                className={`${CELL} w-14 bg-muted text-left sm:w-20 print:w-20 print:bg-transparent`}
              >
                상태
              </th>
              <th
                className={`${CELL} w-28 bg-muted text-left sm:w-52 print:w-52 print:bg-transparent`}
              >
                처리 일시
              </th>
            </tr>
          </thead>
          <tbody>
            {steps.flatMap((step) =>
              step.actors.map((actor) => (
                <tr key={`${step.step}-${actor.user_id}`}>
                  <td className={CELL}>{step.step}단계</td>
                  <td className={CELL}>{actor.full_name}</td>
                  <td className={CELL}>{ACTOR_STATUS_LABEL[actor.status]}</td>
                  <td className={`${CELL} tabular-nums max-sm:text-xs`}>
                    {actor.acted_at ? formatAbsoluteDateTimeKo(actor.acted_at) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {document.referrers.length > 0 ? (
          <p>참조: {document.referrers.map((referrer) => referrer.full_name).join(', ')}</p>
        ) : null}
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='font-semibold'>입력 항목</h2>
        <table className='w-full table-fixed border-collapse'>
          <tbody>
            {fields.map((field) => (
              <tr key={field.field_key}>
                <th className={`${CELL} w-[30%] bg-muted text-left font-medium print:bg-transparent`}>
                  {field.name}
                </th>
                <td className={`${CELL} whitespace-pre-wrap`}>{printValue(field, document)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {document.attachments.length > 0 ? (
        <section className='flex flex-col gap-2'>
          <h2 className='font-semibold'>첨부파일 ({document.attachments.length})</h2>
          <ul className='list-disc pl-6'>
            {document.attachments.map((attachment) => (
              <li key={attachment.id} className='break-all'>
                {attachment.file_name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isEmptyRichContent(document.content_html) ? null : (
        <section className='flex flex-col gap-2'>
          <h2 className='font-semibold'>본문</h2>
          <div
            className={WORKFLOW_RICH_CONTENT_CLASS}
            dangerouslySetInnerHTML={{ __html: document.content_html }}
          />
        </section>
      )}
    </div>
  );
}
