"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageLoadingSpinner } from "@/components/ui/page-loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AFFILIATION_OPTIONS } from "@/features/users/constants/organization";
import { useBenefitsAdminFilters } from "../hooks/use-benefits-admin-filters";
import { benefitsAdminQueryOptions } from "../api/queries";
import { BenefitDocumentAdminRow } from "./benefit-document-admin-row";
import { BenefitsAdminChartsSection } from "./benefits-admin-charts-section";
import { BenefitsAdminSummarySection } from "./benefits-admin-summary-section";
import { BENEFITS_EARLIEST_MONTH } from "../lib/benefits-view-month";
import { currentKstMonth } from "../lib/kst-month";
import { aggregateBenefitsAdminSummary, formatBenefitMoney } from "./benefits-admin-utils";
import { cn } from "@/lib/utils";

const ADMIN_TABLE_COLUMN_COUNT = 8;

function amountOrDash(value: number) {
  return value > 0 ? formatBenefitMoney(value) : "-";
}

export function BenefitsAdminDashboard() {
  const {
    affiliation,
    month,
    teamSelectValue,
    nameInput,
    filters: urlFilters,
    setAffiliation,
    setMonth,
    setTeam,
    onNameInputChange,
  } = useBenefitsAdminFilters();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const query = useQuery(benefitsAdminQueryOptions(urlFilters));

  useEffect(() => {
    if (!urlFilters.team || !query.data?.teams?.length) {
      return;
    }
    if (!query.data.teams.includes(urlFilters.team)) {
      setTeam("all");
    }
  }, [query.data?.teams, setTeam, urlFilters.team]);

  const teamSelectDisplay =
    teamSelectValue !== "all" && query.data?.teams && !query.data.teams.includes(teamSelectValue)
      ? "all"
      : teamSelectValue;

  const grouped = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof query.data>["members"]>();
    for (const member of query.data?.members ?? []) {
      const key = member.team ?? "소속 미지정";
      const list = groups.get(key) ?? [];
      list.push(member);
      groups.set(key, list);
    }
    return groups;
  }, [query.data]);

  const summary = useMemo(
    () => aggregateBenefitsAdminSummary(query.data?.members ?? []),
    [query.data?.members],
  );

  let memberIndex = 0;

  return (
    <div className="@container/main flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
        <Tabs
          value={affiliation}
          onValueChange={(value) => {
            if (value === "wake" || value === "sans" || value === "sans_foundry") {
              setAffiliation(value);
              setExpanded(new Set());
            }
          }}
        >
          {/* 모바일(768px 미만)은 탭을 가로 꽉 채우고 터치 높이 44px */}
          <TabsList className="h-auto w-full md:h-9 md:w-fit">
            {AFFILIATION_OPTIONS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="h-11 md:h-[calc(100%-1px)]"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="month"
            value={month}
            min={BENEFITS_EARLIEST_MONTH}
            max={currentKstMonth()}
            onChange={(event) => setMonth(event.target.value)}
            className="sm:w-40"
            aria-label="조회 월"
          />
          <Select value={teamSelectDisplay} onValueChange={setTeam}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="전체 팀" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 팀</SelectItem>
              {(query.data?.teams ?? []).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-48">
            <Icons.search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={nameInput}
              onChange={(event) => onNameInputChange(event.target.value)}
              placeholder="이름 검색"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <div className="min-h-48">
          <PageLoadingSpinner variant="fill" />
        </div>
      ) : query.isError ? (
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-destructive">
          {query.error.message}
        </p>
      ) : (
        <>
          <BenefitsAdminSummarySection
            totalLimit={summary.totalLimit}
            totalUsed={summary.totalUsed}
            remaining={summary.remaining}
            overageMemberCount={summary.overageMemberCount}
          />
          <BenefitsAdminChartsSection
            filters={urlFilters}
            categoryTotals={summary.categoryTotals}
            categorySum={summary.categorySum}
          />
        </>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">조직별 사용 현황</h2>
          <span className="text-xs text-muted-foreground">조직도 직급순</span>
        </div>
        <div className="overflow-hidden rounded-lg border bg-card">
          {query.isLoading ? (
            <div className="min-h-72">
              <PageLoadingSpinner variant="fill" />
            </div>
          ) : query.isError ? (
            <p className="p-8 text-center text-sm text-destructive">{query.error.message}</p>
          ) : (
            <div className="overflow-x-auto">
              {/* 모바일(768px 미만): 구성원·상태만 — 사용/한도는 구성원 셀 둘째 줄, 나머지 컬럼은 숨김 */}
              <Table className="md:min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="md:w-[220px]">구성원</TableHead>
                    <TableHead className="w-[120px] max-md:hidden">문서번호</TableHead>
                    <TableHead className="w-[200px] max-md:hidden">문서승인일</TableHead>
                    <TableHead className="w-[200px] max-md:hidden">사용 현황</TableHead>
                    <TableHead className="max-md:hidden">도서</TableHead>
                    <TableHead className="max-md:hidden">체력증진</TableHead>
                    <TableHead className="max-md:hidden">외부교육</TableHead>
                    <TableHead className="w-24 max-md:text-right">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(grouped.entries()).map(([groupName, members]) => (
                    <Fragment key={groupName}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell
                          colSpan={ADMIN_TABLE_COLUMN_COUNT}
                          className="py-2 text-xs font-semibold"
                        >
                          {groupName} · {members.length}명
                        </TableCell>
                      </TableRow>
                      {members.map((member) => {
                        memberIndex += 1;
                        const index = memberIndex;
                        const isExpanded = expanded.has(member.user_id);
                        const canExpand = member.documents.length > 0;
                        const usageWidth = Math.min(
                          100,
                          Math.round((member.total_used / member.limit) * 100),
                        );
                        return (
                          <Fragment key={member.user_id}>
                            <TableRow
                              className={
                                member.is_inactive_profile
                                  ? "bg-red-50/60 hover:bg-red-50/80 dark:bg-red-950/20"
                                  : member.overage > 0
                                    ? "bg-red-50/70 hover:bg-red-50 dark:bg-red-950/20"
                                    : canExpand
                                      ? "cursor-pointer"
                                      : ""
                              }
                              onClick={() => {
                                if (!canExpand) return;
                                setExpanded((current) => {
                                  const next = new Set(current);
                                  if (next.has(member.user_id)) next.delete(member.user_id);
                                  else next.add(member.user_id);
                                  return next;
                                });
                              }}
                            >
                              <TableCell className="max-md:whitespace-normal">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 shrink-0 text-xs text-muted-foreground">
                                    {index}
                                  </span>
                                  {canExpand ? (
                                    isExpanded ? (
                                      <Icons.chevronDown className="size-4 shrink-0" />
                                    ) : (
                                      <Icons.chevronRight className="size-4 shrink-0" />
                                    )
                                  ) : (
                                    <span className="size-4 shrink-0" />
                                  )}
                                  <span className="font-medium">{member.full_name}</span>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {member.position_level}
                                  </span>
                                </div>
                                <p
                                  className={cn(
                                    "mt-1 pl-13 text-xs tabular-nums md:hidden",
                                    member.overage > 0
                                      ? "font-semibold text-red-600"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {formatBenefitMoney(member.total_used)} /{" "}
                                  {formatBenefitMoney(member.limit)}
                                  {member.overage > 0
                                    ? ` · ${formatBenefitMoney(member.overage)} 초과`
                                    : ""}
                                </p>
                              </TableCell>
                              <TableCell className="text-muted-foreground max-md:hidden">—</TableCell>
                              <TableCell className="text-muted-foreground max-md:hidden">—</TableCell>
                              <TableCell className="max-md:hidden">
                                <div className="flex items-center gap-3">
                                  <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={
                                        member.overage > 0
                                          ? "h-full rounded-full bg-red-500"
                                          : "h-full rounded-full bg-foreground"
                                      }
                                      style={{ width: `${usageWidth}%` }}
                                    />
                                  </div>
                                  <span
                                    className={
                                      member.overage > 0
                                        ? "whitespace-nowrap text-sm font-semibold text-red-600"
                                        : "whitespace-nowrap text-sm font-medium"
                                    }
                                  >
                                    {formatBenefitMoney(member.total_used)} /{" "}
                                    {formatBenefitMoney(member.limit)}
                                    {member.overage > 0
                                      ? ` · ${formatBenefitMoney(member.overage)} 초과`
                                      : ""}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="max-md:hidden">
                                {amountOrDash(member.category_totals.book)}
                              </TableCell>
                              <TableCell className="max-md:hidden">
                                {amountOrDash(member.category_totals.fitness)}
                              </TableCell>
                              <TableCell className="max-md:hidden">
                                {amountOrDash(member.category_totals.education)}
                              </TableCell>
                              <TableCell className="max-md:text-right">
                                <Badge
                                  variant={member.overage > 0 ? "destructive" : "outline"}
                                  className="whitespace-nowrap"
                                >
                                  {member.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {isExpanded
                              ? member.documents.map((document) => (
                                  <BenefitDocumentAdminRow key={document.id} document={document} />
                                ))
                              : null}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                  {grouped.size === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={ADMIN_TABLE_COLUMN_COUNT}
                        className="h-40 text-center text-muted-foreground"
                      >
                        조건에 맞는 구성원이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
