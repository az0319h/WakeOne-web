import type { BenefitMemberSummary } from "../api/types";

export function formatBenefitMoney(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function getBenefitsTrendMonths(anchorMonth: string, count = 6): string[] {
  const [yearText, monthText] = anchorMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month || month < 1 || month > 12) {
    return [anchorMonth];
  }

  const anchor = new Date(year, month - 1, 1);
  const months: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    months.push(`${yy}-${mm}`);
  }
  return months;
}

export function formatBenefitTrendMonthLabel(monthKey: string) {
  const month = Number(monthKey.split("-")[1]);
  if (!month) return monthKey;
  return `${month}월`;
}

export function aggregateBenefitsAdminSummary(members: BenefitMemberSummary[]) {
  const totalLimit = members.reduce((sum, member) => sum + member.limit, 0);
  const totalUsed = members.reduce((sum, member) => sum + member.total_used, 0);
  const remaining = Math.max(0, totalLimit - totalUsed);
  const overageMemberCount = members.filter((member) => member.overage > 0).length;

  const categoryTotals = members.reduce(
    (acc, member) => ({
      book: acc.book + member.category_totals.book,
      fitness: acc.fitness + member.category_totals.fitness,
      education: acc.education + member.category_totals.education,
    }),
    { book: 0, fitness: 0, education: 0 },
  );

  const categorySum =
    categoryTotals.book + categoryTotals.fitness + categoryTotals.education;

  return {
    totalLimit,
    totalUsed,
    remaining,
    overageMemberCount,
    categoryTotals,
    categorySum,
  };
}
