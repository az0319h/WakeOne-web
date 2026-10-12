import "server-only";

import {
  sortOrgChartMembers,
  isEligibleOrgChartMember,
} from "@/features/org-chart/api/service.server";
import type { OrgChartProfile } from "@/features/org-chart/api/types";
import { AFFILIATIONS, type Affiliation } from "@/features/users/constants/organization";
import { compareYearMonth, getKstYearMonthString } from "@/lib/kst";
import { normalizePersonName } from "@/lib/normalize-person-name";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  BenefitCategoryTotals,
  BenefitDocument,
  BenefitImportPayload,
  BenefitImportResult,
  BenefitMemberSummary,
  BenefitsAdminFilters,
  BenefitsAdminResponse,
  BenefitType,
  MyBenefitsResponse,
} from "./types";

export const MONTHLY_BENEFIT_LIMIT = 100_000;

/** wallet `resolveWalletTargetUserId`와 동일 semantics */
export function resolveBenefitsTargetUserId(
  viewerUserId: string,
  isAdmin: boolean,
  requestedUserId: string | null,
): string {
  return isAdmin && requestedUserId && requestedUserId !== "self"
    ? requestedUserId
    : viewerUserId;
}

const DOCUMENT_SELECT =
  "id, document_number, task_key, benefit_type, document_created_at, approved_at, applicant_name, amount, description, source_document_url, applicant_user_id";

function monthRange(month: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("월은 YYYY-MM 형식이어야 합니다.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("조회 월이 올바르지 않습니다.");
  }
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return {
    from: `${month}-01`,
    to: next.toISOString().slice(0, 10),
  };
}

function emptyTotals(): BenefitCategoryTotals {
  return { book: 0, fitness: 0, education: 0 };
}

function mapDocument(row: Record<string, unknown>): BenefitDocument {
  return {
    id: Number(row.id),
    document_number: String(row.document_number),
    task_key: String(row.task_key),
    benefit_type: row.benefit_type as BenefitType,
    document_created_at: String(row.document_created_at),
    approved_at: String(row.approved_at),
    applicant_name: String(row.applicant_name),
    amount: Number(row.amount),
    description: row.description == null ? null : String(row.description),
    source_document_url: String(row.source_document_url),
  };
}

const PROFILE_ROSTER_SELECT =
  "user_id, full_name, avatar_url, email, phone, affiliation, rank, position_level, leader_role, system_role, status, deactivated_at";

function isBenefitsAdminRosterProfile(profile: {
  system_role: string;
  position_level: string | null;
  rank: string | null;
}): boolean {
  if (profile.system_role !== "user") return false;
  if (!profile.position_level) return false;
  if (
    profile.rank === "경영진" &&
    profile.position_level !== "CEO" &&
    profile.position_level !== "COO"
  ) {
    return false;
  }
  return true;
}

function isInactiveBenefitsAdminMonth(deactivatedAt: string | null, viewMonth: string): boolean {
  if (!deactivatedAt) return false;
  const deactivatedMonth = getKstYearMonthString(deactivatedAt);
  return compareYearMonth(viewMonth, deactivatedMonth) <= 0;
}

function summarizeDocuments(documents: BenefitDocument[]) {
  const categoryTotals = emptyTotals();
  for (const document of documents) {
    categoryTotals[document.benefit_type] += document.amount;
  }
  const totalUsed = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
  const overage = Math.max(0, totalUsed - MONTHLY_BENEFIT_LIMIT);
  return {
    categoryTotals,
    totalUsed,
    overage,
    status: overage > 0 ? ("한도 초과" as const) : ("정상" as const),
  };
}

async function listMonthDocuments(
  month: string,
  userId?: string,
): Promise<Array<BenefitDocument & { applicant_user_id: string }>> {
  const { from, to } = monthRange(month);
  const supabase = getServiceRoleClient();
  let query = supabase
    .from("benefit_documents")
    .select(DOCUMENT_SELECT)
    .gte("document_created_at", from)
    .lt("document_created_at", to)
    .order("document_created_at", { ascending: false })
    .order("id", { ascending: false });

  if (userId) {
    query = query.eq("applicant_user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...mapDocument(row as Record<string, unknown>),
    applicant_user_id: String(row.applicant_user_id),
  }));
}

export async function listBenefitsAdmin(
  filters: BenefitsAdminFilters,
): Promise<BenefitsAdminResponse> {
  const viewMonth = filters.month;
  monthRange(viewMonth);
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_ROSTER_SELECT)
    .eq("system_role", "user");

  if (error) throw new Error(error.message);

  type ProfileRow = {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    email: string | null;
    phone: string | null;
    affiliation: Affiliation;
    rank: string | null;
    position_level: string;
    leader_role: OrgChartProfile["leader_role"];
    system_role: string;
    status: string;
    deactivated_at: string | null;
  };

  const rosterRows = (data ?? []) as ProfileRow[];

  const activeEligible = rosterRows.filter((row) =>
    isEligibleOrgChartMember({
      status: row.status,
      system_role: row.system_role,
      position_level: row.position_level,
      rank: row.rank,
    }),
  );

  const inactiveEligible = rosterRows.filter(
    (row) =>
      row.status === "inactive" &&
      isBenefitsAdminRosterProfile(row) &&
      isInactiveBenefitsAdminMonth(row.deactivated_at, viewMonth),
  );

  const affiliation = filters.affiliation ?? "wake";
  const affiliationMembers = [...activeEligible, ...inactiveEligible].filter(
    (profile) => profile.affiliation === affiliation,
  );

  const inactiveUserIds = new Set(
    inactiveEligible
      .filter((profile) => profile.affiliation === affiliation)
      .map((profile) => profile.user_id),
  );

  const sorted = sortOrgChartMembers(
    affiliation,
    affiliationMembers.map((profile) => ({
      user_id: profile.user_id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      email: profile.email,
      phone: profile.phone,
      affiliation: profile.affiliation,
      rank: profile.rank,
      position_level: profile.position_level,
      leader_role: profile.leader_role,
      system_role: "user",
      status: "active",
    })),
  );
  const documents = await listMonthDocuments(viewMonth);
  const documentsByUser = new Map<string, BenefitDocument[]>();
  for (const document of documents) {
    const list = documentsByUser.get(document.applicant_user_id) ?? [];
    list.push(document);
    documentsByUser.set(document.applicant_user_id, list);
  }

  const normalizedName = filters.name ? normalizePersonName(filters.name) : "";
  const members: BenefitMemberSummary[] = sorted
    .filter((profile) => !filters.team || profile.rank === filters.team)
    .filter(
      (profile) =>
        !normalizedName || normalizePersonName(profile.full_name).includes(normalizedName),
    )
    .map((profile) => {
      const memberDocuments = documentsByUser.get(profile.user_id) ?? [];
      const summary = summarizeDocuments(memberDocuments);
      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        affiliation: profile.affiliation,
        team: profile.rank,
        position_level: profile.position_level,
        is_inactive_profile: inactiveUserIds.has(profile.user_id),
        total_used: summary.totalUsed,
        limit: MONTHLY_BENEFIT_LIMIT,
        overage: summary.overage,
        status: summary.status,
        category_totals: summary.categoryTotals,
        documents: memberDocuments,
      };
    });

  const teams = Array.from(
    new Set(
      affiliationMembers
        .map((profile) => profile.rank)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return { month: viewMonth, limit: MONTHLY_BENEFIT_LIMIT, members, teams };
}

export async function getMyBenefits(userId: string, month: string): Promise<MyBenefitsResponse> {
  const documents = await listMonthDocuments(month, userId);
  const summary = summarizeDocuments(documents);
  return {
    month,
    limit: MONTHLY_BENEFIT_LIMIT,
    total_used: summary.totalUsed,
    remaining: Math.max(0, MONTHLY_BENEFIT_LIMIT - summary.totalUsed),
    overage: summary.overage,
    status: summary.status,
    category_totals: summary.categoryTotals,
    documents,
  };
}

async function findUniqueApplicantUserId(applicantName: string): Promise<string> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("status", "active")
    .eq("system_role", "user")
    .not("full_name", "is", null);
  if (error) throw new Error(error.message);

  const key = normalizePersonName(applicantName);
  const matches = (data ?? []).filter(
    (profile) => normalizePersonName(profile.full_name ?? "") === key,
  );
  if (matches.length === 0) {
    throw new Error(`활성 구성원과 이름이 일치하지 않습니다: ${applicantName}`);
  }
  if (matches.length > 1) {
    throw new Error(`동명이인으로 구성원을 확정할 수 없습니다: ${applicantName}`);
  }
  return matches[0].user_id;
}

async function findExistingDocument(documentNumber: string, taskKey: string) {
  const supabase = getServiceRoleClient();
  const byDocument = await supabase
    .from("benefit_documents")
    .select(DOCUMENT_SELECT)
    .eq("document_number", documentNumber)
    .maybeSingle();
  if (byDocument.error) throw new Error(byDocument.error.message);
  if (byDocument.data) return byDocument.data;

  const byTask = await supabase
    .from("benefit_documents")
    .select(DOCUMENT_SELECT)
    .eq("task_key", taskKey)
    .maybeSingle();
  if (byTask.error) throw new Error(byTask.error.message);
  return byTask.data;
}

export async function recordBenefitImportEvent(input: {
  requestId: string;
  documentNumber?: string | null;
  taskKey?: string | null;
  status: "created" | "duplicate" | "failed";
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("benefit_import_events").insert({
    request_id: input.requestId,
    document_number: input.documentNumber ?? null,
    task_key: input.taskKey ?? null,
    status: input.status,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage?.slice(0, 500) ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function importBenefitDocument(
  payload: BenefitImportPayload,
  requestId: string,
): Promise<BenefitImportResult> {
  const existing = await findExistingDocument(payload.document_number, payload.task_key);
  if (existing) {
    await recordBenefitImportEvent({
      requestId,
      documentNumber: payload.document_number,
      taskKey: payload.task_key,
      status: "duplicate",
    });
    return { status: "duplicate", document: mapDocument(existing as Record<string, unknown>) };
  }

  const applicantUserId = await findUniqueApplicantUserId(payload.applicant_name);
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("benefit_documents")
    .insert({
      document_number: payload.document_number,
      task_key: payload.task_key,
      benefit_type: payload.benefit_type,
      document_created_at: payload.document_created_at,
      approved_at: payload.approved_at,
      applicant_user_id: applicantUserId,
      applicant_name: payload.applicant_name,
      amount: payload.amount,
      description: payload.description ?? null,
      source_document_url: payload.source_document_url,
      source_message_id: payload.source_message_id ?? null,
    })
    .select(DOCUMENT_SELECT)
    .single();
  if (error) throw new Error(error.message);

  await recordBenefitImportEvent({
    requestId,
    documentNumber: payload.document_number,
    taskKey: payload.task_key,
    status: "created",
  });
  return { status: "created", document: mapDocument(data as Record<string, unknown>) };
}

export function isAffiliation(value: string | null): value is Affiliation {
  return Boolean(value && (AFFILIATIONS as readonly string[]).includes(value));
}
