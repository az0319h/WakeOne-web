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
    <Card className="@container/card">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
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
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
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
