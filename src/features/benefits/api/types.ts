import type { Affiliation } from "@/features/users/constants/organization";

export type BenefitType = "book" | "fitness" | "education";
export type BenefitStatus = "정상" | "한도 초과";

export interface BenefitImportPayload {
  document_number: string;
  task_key: string;
  benefit_type: BenefitType;
  document_created_at: string;
  approved_at: string;
  applicant_name: string;
  amount: number;
  description?: string | null;
  source_document_url: string;
  source_message_id?: string | null;
  /** Flex 「해당 월」 원문 — fitness만 사용 */
  benefit_month?: string | number | null;
}

export interface BenefitDocument {
  id: number;
  document_number: string;
  task_key: string;
  benefit_type: BenefitType;
  document_created_at: string;
  approved_at: string;
  applicant_name: string;
  amount: number;
  description: string | null;
  source_document_url: string;
  /** 체력증진비 해당 월 `YYYY-MM-01` — book·education·기존 fitness 행은 null */
  benefit_month: string | null;
  /** 조회·한도 집계 귀속 월 `YYYY-MM-01` */
  attributed_month: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  applicant_user_id?: string;
}

export function isBenefitDocumentCancelled(
  document: Pick<BenefitDocument, "cancelled_at">,
): boolean {
  return document.cancelled_at != null;
}

export interface BenefitCategoryTotals {
  book: number;
  fitness: number;
  education: number;
}

export interface BenefitMemberSummary {
  user_id: string;
  full_name: string;
  affiliation: Affiliation;
  team: string | null;
  position_level: string;
  /** 복지비 관리(admin) UI: 비활성 프로필이 조회 월에 노출될 때 true */
  is_inactive_profile: boolean;
  total_used: number;
  limit: number;
  overage: number;
  status: BenefitStatus;
  category_totals: BenefitCategoryTotals;
  documents: BenefitDocument[];
}

export interface BenefitsAdminFilters {
  month: string;
  affiliation?: Affiliation;
  team?: string;
  name?: string;
}

export interface BenefitsAdminResponse {
  month: string;
  limit: number;
  members: BenefitMemberSummary[];
  teams: string[];
}

export interface MyBenefitsResponse {
  month: string;
  limit: number;
  total_used: number;
  remaining: number;
  overage: number;
  status: BenefitStatus;
  category_totals: BenefitCategoryTotals;
  documents: BenefitDocument[];
}

export type BenefitImportResult =
  | { status: "created"; document: BenefitDocument }
  | { status: "duplicate"; document: BenefitDocument };
