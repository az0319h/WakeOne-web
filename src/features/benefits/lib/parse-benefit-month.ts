export type BenefitMonthFailureReason = "benefit_month_missing" | "benefit_month_invalid";

export type ParseBenefitMonthResult =
  | { ok: true; month: string }
  | { ok: false; reason: BenefitMonthFailureReason };

const MAX_RAW_LENGTH = 50;
const MONTH_ONLY_PATTERN = /^(\d{1,2})(월분|월)?$/;
const YEAR_MONTH_PATTERN = /^(\d{4})(?:년|[-./])(\d{1,2})(월분|월)?$/;

const invalid: ParseBenefitMonthResult = { ok: false, reason: "benefit_month_invalid" };
const missing: ParseBenefitMonthResult = { ok: false, reason: "benefit_month_missing" };

/**
 * Flex 「해당 월」 원문 → `YYYY-MM-01`. 연도는 항상 `documentCreatedAt`(YYYY-MM-DD)의 연도이며,
 * 연도를 포함한 입력은 작성 연도와 같을 때만 허용한다. (plan 80)
 */
export function parseBenefitMonth(
  raw: string | number | null | undefined,
  documentCreatedAt: string,
): ParseBenefitMonthResult {
  if (raw === null || raw === undefined) return missing;

  let text: string;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) return invalid;
    text = String(raw);
  } else {
    text = raw;
  }

  const compact = text.normalize("NFKC").replace(/\s/g, "");
  if (compact === "") return missing;
  if (compact.length > MAX_RAW_LENGTH) return invalid;

  const year = Number(documentCreatedAt.slice(0, 4));
  if (!Number.isInteger(year)) return invalid;

  let monthNumber: number;
  const monthOnly = MONTH_ONLY_PATTERN.exec(compact);
  if (monthOnly) {
    monthNumber = Number(monthOnly[1]);
  } else {
    const yearMonth = YEAR_MONTH_PATTERN.exec(compact);
    if (!yearMonth || Number(yearMonth[1]) !== year) return invalid;
    monthNumber = Number(yearMonth[2]);
  }

  if (monthNumber < 1 || monthNumber > 12) return invalid;

  return { ok: true, month: `${year}-${String(monthNumber).padStart(2, "0")}-01` };
}

/** 400 응답 message 인용용 — 해당 월 입력값만 최대 20자 */
export function quoteBenefitMonthInput(raw: string | number | null | undefined): string {
  return String(raw ?? "").trim().slice(0, 20);
}
