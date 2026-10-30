"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatBenefitMoney } from "./benefits-admin-utils";

interface BenefitsAdminSummarySectionProps {
  totalLimit: number;
  totalUsed: number;
  remaining: number;
  overageMemberCount: number;
}

function SummaryCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Card className="@container/card py-4 md:py-6">
      <CardHeader className="gap-1 px-4 md:px-6">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-lg font-semibold tabular-nums md:text-2xl @[250px]/card:text-3xl",
            valueClassName,
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export function BenefitsAdminSummarySection({
  totalLimit,
  totalUsed,
  remaining,
  overageMemberCount,
}: BenefitsAdminSummarySectionProps) {
  return (
    // 모바일도 2×2 — 카드 4장이 표를 화면 아래로 밀어내지 않게
    <div className="grid grid-cols-2 gap-3 md:gap-4 @5xl/main:grid-cols-4">
      <SummaryCard label="총 지급 한도" value={formatBenefitMoney(totalLimit)} />
      <SummaryCard label="총 사용액" value={formatBenefitMoney(totalUsed)} />
      <SummaryCard label="잔여 예산" value={formatBenefitMoney(remaining)} />
      <SummaryCard
        label="초과 인원"
        value={`${overageMemberCount.toLocaleString("ko-KR")}명`}
        valueClassName={overageMemberCount > 0 ? "text-destructive" : undefined}
      />
    </div>
  );
}
