import { cn } from '@/lib/utils';
import { isEmptyRichContent, WORKFLOW_RICH_CONTENT_CLASS } from '../lib/rich-content-class';

/** 서버에서 정화한 본문 HTML만 그린다 (AC-41 — sanitize-html allowlist 결과) */
export function WorkflowRichContent({ html, className }: { html: string; className?: string }) {
  if (isEmptyRichContent(html)) return null;
  return (
    <div className={cn('overflow-x-auto', className)}>
      <div
        className={WORKFLOW_RICH_CONTENT_CLASS}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
