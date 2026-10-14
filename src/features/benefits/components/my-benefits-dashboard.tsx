"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icons } from "@/components/icons";
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageLoadingSpinner } from "@/components/ui/page-loading-spinner";
import { formatAbsoluteDateKo } from "@/lib/format-date";
import { usersQueryOptions } from "@/features/users/api/queries";
import { formatBenefitDocumentDescription } from "../lib/format-benefit-document-description";
import { isBenefitsMonthAtEarliest, isBenefitsMonthAtLatest } from "../lib/benefits-view-month";
import { useMyBenefitsMonth } from "../hooks/use-my-benefits-month";
import { myBenefitsQueryOptions } from "../api/queries";
import type { BenefitType } from "../api/types";
import { isBenefitDocumentCancelled } from '../api/types';
import { cn } from '@/lib/utils';
import type { MyBenefitsViewerProfile } from "../api/viewer-profile";

const TYPE_LABEL: Record<BenefitType, string> = {
  book: "도서 신청서",
  fitness: "체력증진비 신청",
  education: "외부교육 신청서",
};

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
  isAdmin: boolean;
  benefitsUser?: string;
  viewerProfile: MyBenefitsViewerProfile;
}

export function MyBenefitsDashboard({
  isAdmin,
  benefitsUser,
  viewerProfile,
}: MyBenefitsDashboardProps) {
  const { month, setMonth } = useMyBenefitsMonth();
  const proxyUser = isAdmin ? (benefitsUser ?? "self") : undefined;
  const query = useQuery(myBenefitsQueryOptions(month, proxyUser));

  const viewingOtherUser = isAdmin && benefitsUser && benefitsUser !== "self";
  const { data: subjectUsers } = useQuery({
    ...usersQueryOptions({ userId: benefitsUser, limit: 1 }),
    enabled: Boolean(viewingOtherUser),
  });

  const headerProfile = useMemo(() => {
    if (viewingOtherUser) {
      const subject = subjectUsers?.users.find((user) => user.id === benefitsUser);
      return {
        fullName: subject?.full_name ?? "…",
        team: subject?.rank ?? null,
        positionLevel: subject?.position_level ?? null,
      };
    }
    return {
      fullName: viewerProfile.fullName,
      team: viewerProfile.team,
      positionLevel: viewerProfile.positionLevel,
    };
  }, [benefitsUser, subjectUsers?.users, viewerProfile, viewingOtherUser]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex justify-end">
        <div className="flex items-center overflow-hidden rounded-lg border bg-card">
          <span className="px-4 text-sm font-semibold">{monthLabel(month)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-none border-l"
            aria-label="이전 달"
            disabled={isBenefitsMonthAtEarliest(month)}
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            <Icons.chevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-none border-l"
            aria-label="다음 달"
            disabled={isBenefitsMonthAtLatest(month)}
            onClick={() => setMonth(moveMonth(month, 1))}
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
                {[headerProfile.fullName, headerProfile.team, headerProfile.positionLevel]
                  .filter(Boolean)
                  .join(" · ")}
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
                query.data.documents.map((document) => {
                  const cancelled = isBenefitDocumentCancelled(document);
                  return (
                    <div
                      key={document.id}
                      className={cn(
                        'grid gap-2 rounded-lg border px-4 py-3 text-sm sm:grid-cols-[1.3fr_0.8fr_0.8fr_1fr_auto] sm:items-center',
                        cancelled && 'opacity-70'
                      )}
                    >
                      <div>
                        <p
                          className={cn(
                            'font-semibold',
                            cancelled && 'text-muted-foreground line-through'
                          )}
                        >
                          {TYPE_LABEL[document.benefit_type]}
                        </p>
                        {document.description ? (
                          <p
                            className={cn(
                              'mt-0.5 text-xs text-muted-foreground',
                              cancelled && 'line-through'
                            )}
                          >
                            {formatBenefitDocumentDescription(
                              document.benefit_type,
                              document.description
                            )}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'text-muted-foreground',
                          cancelled && 'line-through'
                        )}
                      >
                        {document.document_number}
                      </span>
                      <span
                        className={cn('font-semibold', cancelled && 'line-through text-muted-foreground')}
                      >
                        {money(document.amount)}
                      </span>
                      <span className={cancelled ? 'line-through text-muted-foreground' : ''}>
                        {formatAbsoluteDateKo(document.document_created_at)}
                      </span>
                      {cancelled ? (
                        <Badge variant="outline" className="justify-self-end text-muted-foreground">
                          취소됨
                        </Badge>
                      ) : (
                        <a
                          href={document.source_document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          Flex에서 열기 <Icons.externalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
