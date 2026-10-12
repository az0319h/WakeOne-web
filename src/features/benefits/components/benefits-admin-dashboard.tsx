"use client";

import { Fragment, useMemo, useState } from "react";
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
import { AFFILIATION_OPTIONS, type Affiliation } from "@/features/users/constants/organization";
import { benefitsAdminQueryOptions } from "../api/queries";
import type { BenefitDocument, BenefitType } from "../api/types";

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

function money(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function amountOrDash(value: number) {
  return value > 0 ? money(value) : "-";
}

function DocumentRow({ document }: { document: BenefitDocument }) {
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/30">
      <TableCell className="pl-14 text-sm font-medium">
        {TYPE_LABEL[document.benefit_type]}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {document.description ?? document.document_number}
      </TableCell>
      <TableCell>{document.benefit_type === "book" ? money(document.amount) : ""}</TableCell>
      <TableCell>{document.benefit_type === "fitness" ? money(document.amount) : ""}</TableCell>
      <TableCell>{document.benefit_type === "education" ? money(document.amount) : ""}</TableCell>
      <TableCell>
        <a
          href={document.source_document_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Flex에서 열기 <Icons.externalLink className="size-3" />
        </a>
      </TableCell>
    </TableRow>
  );
}

export function BenefitsAdminDashboard() {
  const [month, setMonth] = useState(currentKstMonth);
  const [affiliation, setAffiliation] = useState<Affiliation>("wake");
  const [team, setTeam] = useState("all");
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filters = {
    month,
    affiliation,
    ...(team !== "all" ? { team } : {}),
    ...(name.trim() ? { name: name.trim() } : {}),
  };
  const query = useQuery(benefitsAdminQueryOptions(filters));

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

  let memberIndex = 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-2.5 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={affiliation}
          onValueChange={(value) => {
            if (value === "wake" || value === "sans" || value === "sans_foundry") {
              setAffiliation(value);
              setTeam("all");
              setExpanded(new Set());
            }
          }}
        >
          <TabsList>
            {AFFILIATION_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="sm:w-40"
            aria-label="조회 월"
          />
          <Select value={team} onValueChange={setTeam}>
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
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름 검색"
              className="pl-9"
            />
          </div>
        </div>
      </div>

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
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">구성원</TableHead>
                    <TableHead className="w-[270px]">사용 현황</TableHead>
                    <TableHead>도서</TableHead>
                    <TableHead>체력증진</TableHead>
                    <TableHead>외부교육</TableHead>
                    <TableHead className="w-24">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(grouped.entries()).map(([groupName, members]) => (
                    <Fragment key={groupName}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={6} className="py-2 text-xs font-semibold">
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
                                member.overage > 0
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
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-xs text-muted-foreground">{index}</span>
                                  {canExpand ? (
                                    isExpanded ? (
                                      <Icons.chevronDown className="size-4" />
                                    ) : (
                                      <Icons.chevronRight className="size-4" />
                                    )
                                  ) : (
                                    <span className="size-4" />
                                  )}
                                  <span className="font-medium">{member.full_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {member.position_level}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
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
                                    {money(member.total_used)} / {money(member.limit)}
                                    {member.overage > 0 ? ` · ${money(member.overage)} 초과` : ""}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{amountOrDash(member.category_totals.book)}</TableCell>
                              <TableCell>{amountOrDash(member.category_totals.fitness)}</TableCell>
                              <TableCell>
                                {amountOrDash(member.category_totals.education)}
                              </TableCell>
                              <TableCell>
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
                                  <DocumentRow key={document.id} document={document} />
                                ))
                              : null}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                  {grouped.size === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
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
