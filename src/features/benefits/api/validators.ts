import { z } from "zod";

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "문서 작성일은 YYYY-MM-DD 형식이어야 합니다.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00+09:00`)), {
    message: "문서 작성일이 올바르지 않습니다.",
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max}자 이내로 입력해 주세요.`)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

export const benefitImportSchema = z.object({
  document_number: z.string().trim().min(1).max(100),
  task_key: z.string().trim().min(1).max(200),
  benefit_type: z.enum(["book", "fitness", "education"]),
  document_created_at: dateString,
  approved_at: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "승인일이 올바르지 않습니다."),
  applicant_name: z.string().trim().min(1, "작성자가 필요합니다.").max(200),
  amount: z.number().int().nonnegative().max(99999999999999),
  description: optionalText(500),
  source_document_url: z
    .string()
    .trim()
    .url("Flex 원문 URL이 올바르지 않습니다.")
    .max(1000)
    .refine((value) => {
      try {
        const host = new URL(value).hostname.toLowerCase();
        return host === "flex.team" || host.endsWith(".flex.team");
      } catch {
        return false;
      }
    }, "Flex 원문 URL만 허용됩니다."),
  source_message_id: optionalText(200),
  /** Flex 「해당 월」 원문 — fitness 필수 판정은 duplicate 확인 이후 service에서 (plan 80) */
  benefit_month: z.union([z.string(), z.number()]).nullable().optional(),
});

export function normalizeBenefitDocumentNumber(value: string): string {
  return value.trim();
}
