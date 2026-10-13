"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PageLoadingSpinner } from "@/components/ui/page-loading-spinner";
import { Progress } from "@/components/ui/progress";
import { benefitsAdminQueryOptions } from "../api/queries";
import type { BenefitsAdminFilters } from "../api/types";
import {
  formatBenefitMoney,
  formatBenefitTrendMonthLabel,
  getBenefitsTrendMonths,
} from "./benefits-admin-utils";

const usageChartConfig = {
  used: {
    label: "사용액",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const CATEGORY_ROWS = [
  { key: "book" as const, label: "도서" },
  { key: "fitness" as const, label: "체력증진" },
  { key: "education" as const, label: "외부교육" },
];

interface BenefitsAdminChartsSectionProps {
  filters: BenefitsAdminFilters;
  categoryTotals: { book: number; fitness: number; education: number };
  categorySum: number;
}

export function BenefitsAdminChartsSection({
  filters,
  categoryTotals,
  categorySum,
}: BenefitsAdminChartsSectionProps) {
  const trendMonths = useMemo(() => getBenefitsTrendMonths(filters.month), [filters.month]);

  const trendQueries = useQueries({
    queries: trendMonths.map((month) =>
      benefitsAdminQueryOptions({
        ...filters,
        month,
      }),
    ),
  });

  const trendLoading = trendQueries.some((item) => item.isLoading);
  const trendData = trendMonths.map((month, index) => {
    const members = trendQueries[index]?.data?.members ?? [];
    const used = members.reduce((sum, member) => sum + member.total_used, 0);
    return {
      month,
      label: formatBenefitTrendMonthLabel(month),
      used,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-semibold">월별 복지비 사용 추이</CardTitle>
          <CardDescription>선택한 조회 월 기준 최근 6개월</CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <PageLoadingSpinner variant="compact" />
            </div>
          ) : (
            <ChartContainer config={usageChartConfig} className="aspect-auto h-56 w-full">
              <AreaChart accessibilityLayer data={trendData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent formatter={(value) => formatBenefitMoney(Number(value))} />
                  }
                />
                <Area
                  dataKey="used"
                  type="natural"
                  fill="var(--color-used)"
                  fillOpacity={0.2}
                  stroke="var(--color-used)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">카테고리별 사용 비중</CardTitle>
          <CardDescription>조회 월 합계 기준</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {CATEGORY_ROWS.map((row) => {
            const amount = categoryTotals[row.key];
            const percent = categorySum > 0 ? Math.round((amount / categorySum) * 100) : 0;
            return (
              <div key={row.key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatBenefitMoney(amount)}
                    {categorySum > 0 ? ` · ${percent}%` : ""}
                  </span>
                </div>
                <Progress value={percent} aria-label={`${row.label} 사용 비중`} />
              </div>
            );
          })}
          {categorySum === 0 ? (
            <p className="text-center text-sm text-muted-foreground">사용 내역이 없습니다.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
