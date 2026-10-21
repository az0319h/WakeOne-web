import 'server-only';

import sanitizeHtml from 'sanitize-html';

/** 본문 HTML 최대 길이 (정화 전 입력 기준) */
export const WORKFLOW_CONTENT_MAX_LENGTH = 200_000;

const FONT_SIZE_PATTERN = /^(1[0-9]|2[0-9]|3[0-2])px$/;
const TEXT_ALIGN_PATTERN = /^(left|center|right|justify)$/;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'span',
    'h1',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'code',
    'pre',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'colgroup',
    'col',
    'a'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    th: ['colspan', 'rowspan', 'colwidth', 'style'],
    td: ['colspan', 'rowspan', 'colwidth', 'style'],
    col: ['span', 'style'],
    span: ['style'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    li: ['style']
  },
  allowedStyles: {
    '*': {
      'font-size': [FONT_SIZE_PATTERN],
      'text-align': [TEXT_ALIGN_PATTERN]
    },
    col: {
      width: [/^\d{1,4}px$/]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {},
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    })
  }
};

/**
 * 본문 HTML allowlist 정화 (plan 88 AC-41). script·style·img·이벤트 핸들러·javascript: 링크 제거.
 * 결과가 빈 단락뿐이면 빈 문자열을 돌려준다.
 */
export function sanitizeWorkflowHtml(input: string | null | undefined): string {
  if (!input) return '';
  const cleaned = sanitizeHtml(input, OPTIONS).trim();
  const textOnly = cleaned.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '').trim();
  return textOnly === '' ? '' : cleaned;
}

/** 검색용 평문 (태그 제거) */
export function workflowHtmlToPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
