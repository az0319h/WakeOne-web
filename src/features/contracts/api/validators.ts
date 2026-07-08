import { z } from 'zod';

const nullableText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${maxLength}자 이내로 입력해 주세요.`)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

const dateString = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value !== '' && !Number.isNaN(Date.parse(value)), { message });

const nullableDateString = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), { message })
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

const amountSchema = z
  .number({ message: '금액은 숫자여야 합니다.' })
  .nonnegative('금액은 0 이상이어야 합니다.')
  .max(99999999999999, '금액이 너무 큽니다.')
  .nullable()
  .optional();

const externalPayloadSchema = z.record(z.string(), z.unknown()).nullable().optional();

export const contractImportSchema = z.object({
  document_number: z.string().trim().min(1, '문서번호를 입력해 주세요.').max(100, '문서번호는 100자 이내여야 합니다.'),
  document_created_at: dateString('문서 생성일 형식이 올바르지 않습니다.'),
  approved_at: dateString('문서승인일 형식이 올바르지 않습니다.'),
  author_name: z.string().trim().min(1, '작성자를 입력해 주세요.').max(200, '작성자는 200자 이내여야 합니다.'),
  author_email: nullableText(320),
  contract_target: z
    .string()
    .trim()
    .min(1, '계약대상을 입력해 주세요.')
    .max(300, '계약대상은 300자 이내여야 합니다.'),
  contract_summary: z
    .string()
    .trim()
    .min(1, '계약 내용을 입력해 주세요.')
    .max(2000, '계약 내용은 2000자 이내여야 합니다.'),
  amount: amountSchema,
  contract_start_date: nullableDateString('계약 시작일 형식이 올바르지 않습니다.'),
  contract_end_date: nullableDateString('계약 종료일 형식이 올바르지 않습니다.'),
  notes: nullableText(4000),
  source_message_id: nullableText(200),
  source_thread_id: nullableText(200),
  source_mail_subject: nullableText(500),
  source_document_url: nullableText(1000),
  external_document_id: nullableText(200),
  external_payload: externalPayloadSchema
});

export const contractUpdateSchema = contractImportSchema
  .pick({
    document_created_at: true,
    approved_at: true,
    author_name: true,
    author_email: true,
    contract_target: true,
    contract_summary: true,
    amount: true,
    contract_start_date: true,
    contract_end_date: true,
    notes: true,
    source_document_url: true,
    external_document_id: true
  })
  .partial()
  .extend({
    approved_at: nullableDateString('문서승인일 형식이 올바르지 않습니다.')
  });

export const noAttachmentSchema = z.object({
  no_attachment_required: z.boolean(),
  no_attachment_reason: nullableText(500)
});

export function normalizeDocumentNumber(value: string): string {
  return value.trim();
}
