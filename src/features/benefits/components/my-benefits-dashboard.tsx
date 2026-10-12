"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageLoadingSpinner } from "@/components/ui/page-loading-spinner";
import { formatAbsoluteDateKo } from "@/lib/format-date";
import { myBenefitsQueryOptions } from "../api/queries";
import type { BenefitType } from "../api/types";

const TYPE_LABEL: Record<BenefitType, string> = {
  book: "도서 신청서",
  fitness: "체력증진비 신청",
  education: "외부교육 신청서",
};

const KST_MONTH_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
});

function currentKstMonth() {
  return KST_MONTH_FORMATTER.format(new Date()).slice(0, 7);
}

function moveMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}년 ${Number(monthNumber)}월`;
}

function money(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

interface MyBenefitsDashboardProps {
  fullName: string;
  team: string | null;
  positionLevel: string | null;
}

export function MyBenefitsDashboard({ fullName, team, positionLevel }: MyBenefitsDashboardProps) {
  const [month, setMonth] = useState(currentKstMonth);
  const query = useQuery(myBenefitsQueryOptions(month));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">
      <div className="flex justify-end">
        <div className="flex items-center overflow-hidden rounded-lg border bg-card">
          <span className="px-4 text-sm font-semibold">{monthLabel(month)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-none border-l"
            aria-label="이전 달"
            onClick={() => setMonth((value) => moveMonth(value, -1))}
          >
            <Icons.chevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-none border-l"
            aria-label="다음 달"
            onClick={() => setMonth((value) => moveMonth(value, 1))}
          >
            <Icons.chevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="min-h-80">
          <PageLoadingSpinner variant="fill" />
        </div>
      ) : query.isError ? (
        <p className="rounded-lg border p-8 text-center text-sm text-destructive">
          {query.error.message}
        </p>
      ) : query.data ? (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between border-b py-3">
              <p className="text-sm font-semibold">
                {[fullName, team, positionLevel].filter(Boolean).join(" · ")}
              </p>
              <p className="text-sm font-medium">{monthLabel(month)}</p>
            </CardHeader>
            <CardContent className="px-6 py-5 sm:px-10">
              <div className="text-center">
                <p className="text-2xl font-bold sm:text-3xl">
                  {money(query.data.total_used)}
                  <span className="text-base font-semibold"> 사용 / {money(query.data.limit)}</span>
                </p>
                <p
                  className={
                    query.data.overage > 0
                      ? "mt-1 font-semibold text-red-600"
                      : "mt-1 font-semibold"
                  }
                >
                  {query.data.overage > 0
                    ? `${money(query.data.overage)} 초과`
                    : `${money(query.data.remaining)} 남음`}
                </p>
              </div>
              <div className="mx-auto mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    query.data.overage > 0
                      ? "h-full rounded-full bg-red-500"
                      : "h-full rounded-full bg-foreground"
                  }
                  style={{
                    width: `${Math.min(100, (query.data.total_used / query.data.limit) * 100)}%`,
                  }}
                />
              </div>
              <div className="mx-auto mt-5 grid max-w-2xl grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">도서</p>
                  <p className="font-semibold">{money(query.data.category_totals.book)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">체력증진</p>
                  <p className="font-semibold">{money(query.data.category_totals.fitness)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">외부교육</p>
                  <p className="font-semibold">{money(query.data.category_totals.education)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm font-medium">도서 · 체력증진 · 외부교육 합산 월 100,000원 한도</p>

          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-semibold">{Number(month.slice(5))}월 신청 내역</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {query.data.documents.length === 0 ? (
                <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
                  승인 완료된 신청 내역이 없습니다.
                </div>
              ) : (
                query.data.documents.map((document) => (
                  <div
                    key={document.id}
                    className="grid gap-2 rounded-lg border px-4 py-3 text-sm sm:grid-cols-[1.3fr_0.8fr_0.8fr_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-semibold">{TYPE_LABEL[document.benefit_type]}</p>
                      {document.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {document.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground">승인완료</span>
                    <span className="font-semibold">{money(document.amount)}</span>
                    <span>{formatAbsoluteDateKo(document.document_created_at)}</span>
                    <a
                      href={document.source_document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium hover:underline"
                    >
                      Flex에서 열기 <Icons.externalLink className="size-3.5" />
                    </a>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
