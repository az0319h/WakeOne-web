/** 본문 HTML 공유 스타일 — 편집기 · 상세 · 인쇄가 같은 클래스를 쓴다 (designer §3.8) */
export const WORKFLOW_RICH_CONTENT_CLASS =
  'text-sm leading-7 break-words [&_p]:my-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th_p]:my-0 [&_td_p]:my-0';

/** 빈 본문(`''`, `<p></p>`)인지 */
export function isEmptyRichContent(html: string | null | undefined): boolean {
  if (!html) return true;
  return html.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '').trim() === '';
}
