# 조직도 Desktop Viewport Fill 기획서

> Date: 2026-10-08
> Status: Approved
> Author: planner
> **SQL:** 해당 없음
> **선행:** [40](./40_filter-shell-loading-ux-plan.md), [49](./49_live-users-presence-plan.md), [63](./63_org-chart-admin-profile-plan.md), [67](./67_org-chart-pdf-download-plan.md), [68](./68_org-chart-person-hover-contact-plan.md), [69](./69_org-chart-mobile-tree-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **40** | listing filter shell — tabs Suspense **밖** · data body만 Suspense **유지** |
| **49** | `/dashboard/org-chart`는 `dashboard/layout.tsx` **`DashboardPresenceTrack` 상속** — 별도 track **불필요** |
| **63** | Read-only d3 desktop · Card **`min-h 480px [INFERRED]`** — **본 plan이 layout만 supersede** |
| **67** | PDF 다운로드 desktop only · tabs 우측 버튼 — **UI 변경 Out** |
| **68** | desktop person hover · pan/zoom/scroll 시 hover close — **resize 시 close In** |
| **69** | mobile ReUI Tree · desktop d3 「변경 없음」 — **본 plan은 desktop layout만 In** · mobile 회귀 AC 유지 |

**중복 금지:** BE/API/SQL · tabs/PDF/hover/zoom UI 변경 · mobile tree fill 강제 · activity log · d3 데이터/렌더 로직 변경.

---

## 한 줄 요약

desktop(md+) 조직도 D3 Card/canvas가 소속 tabs 아래 **남은 viewport 높이 전체**를 채우도록 flex chain(`flex-1 min-h-0`)을 연결하고, **480px 고정 높이를 제거**한다. 컨테이너 크기 변경 시 **ResizeObserver + auto `.fit()`** 으로 d3 뷰를 재맞춤하며, resize 시 person hover card는 **즉시 close**한다.

---

## 정책 확정안 (deep-interview · battle-plan · go)

### Desktop layout

| 항목 | 확정 |
|------|------|
| **높이** | tabs 아래 ~ 페이지 하단 **100% fill** |
| **고정 높이** | `min-h-[480px]` · `h-[480px]` **전면 제거** |
| **flex** | chain 전 구간 **`flex-1 min-h-0`** |
| **empty state** | desktop empty도 **동일 fill** (centered 카피 유지) |
| **loading** | `PageLoadingSpinner variant='fill'` **변경 없음** |

### Mobile · Loading

| 항목 | 확정 |
|------|------|
| **mobile tree** | plan 69 — **자연 높이(scroll)** · fill 강제 **Out** |
| **loading** | `loading.tsx` · Suspense fallback **`variant='fill'` 유지** |

### D3 리사이즈

| 항목 | 확정 |
|------|------|
| **트리거** | `ResizeObserver` on canvas container (창 리사이즈 · sidebar toggle) |
| **동작** | `chartRef.current?.fit?.()` |
| **hover** | resize 시 **`closeImmediately()`** (plan 68 정책 정렬) |
| **debounce** | **50~100ms** [INFERRED] — sidebar 연속 애니메이션 jank 완화 |
| **zoom/pan 보존** | **Out** — auto fit 확정 |

### 제외 (UI·BE)

| 항목 | Out |
|------|-----|
| tabs · PDF 버튼(미구현) · hover card UI · zoom 버튼 UI | 변경 없음 |
| BE · API · SQL · CUD | Out |
| activity log | Read-only — **해당 없음** |

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | desktop D3 Card/canvas viewport fill + 동적 리사이즈 fit |
| **Done when** | AC #01–#10 · AC-REG-01~03 · CLI #11 green |
| **Not doing** | tabs/PDF/hover/zoom UI · mobile fill · BE · activity log |

### STEPS

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | flex chain wrapper (`page-content` → `data-body` → listing 필요 시) | desktop branch `flex-1 min-h-0` 전달 | HIGH |
| 2 | `OrgChartD3Canvas` — 480px 제거 · Card/canvas/empty fill | viewport fill UI | HIGH |
| 3 | ResizeObserver + fit + closeImmediately | sidebar/창 리사이즈 대응 | MED |
| 4 | dev smoke — fill · sidebar toggle · empty · hover | 수동 OK | HIGH |
| 5 | E2E `e2e/org-chart/` 회귀 + CLI | green | HIGH |

**Checkpoint:** Step 2 후 desktop 1280×800 fill 육안 확인.

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | flex chain `min-h-0` 누락 → fill 실패 | chain checklist · AC-01 |
| MED | ResizeObserver 연속 fit jank | debounce · nodes 변경 fit 분리 |
| MED | resize 시 hover anchor 어긋남 | `closeImmediately()` · AC-08 |
| LOW | 초기 render 0-height container | mount 후 rAF 1회 fit fallback [INFERRED] |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user · **desktop viewport (1280×800)** · wake CEO·COO·팀 시드 | `/dashboard/org-chart?affiliation=wake` 로드 | **`getByTestId('org-chart-canvas')` visible** · canvas bounding box **height > 500px** |
| AC-02 | Playwright | AC-01 | canvas inner text poll | **CEO `fullName`** · **COO `fullName`** · **「마케팅팀」** 포함 (plan 63 desktop 회귀) |
| AC-03 | Playwright | active user · desktop · 조직도 데이터 **없음**(empty) | `/dashboard/org-chart?affiliation=wake` | **「표시할 임직원이 없습니다」** visible · **`getByTestId('org-chart-canvas')` 0개** · empty 영역이 tabs 아래 **viewport fill** (wrapper `flex-1` — height > 400px) |
| AC-04 | Playwright | active user · **mobile viewport (375×812)** | `/dashboard/org-chart?affiliation=wake` | **`getByTestId('org-chart-mobile-tree')` visible** · **`getByTestId('org-chart-canvas')` 0개** (plan 69 회귀) |
| AC-05 | Playwright | plan 68 구현됨 · desktop · wake person 시드 | person node hover | hover card **visible** · email/phone 표시 (plan 68 AC 회귀) |
| AC-06 | Playwright | plan 68 · desktop · person hover **open** | **「화면 맞춤」** 버튼(`aria-label='화면 맞춤'`) 클릭 | hover card **close** (plan 68 zoom/pan close 회귀) |
| AC-07 | Playwright | active user · desktop | `/dashboard/org-chart` | 페이지가 **`dashboard/layout` 하위** — 별도 presence track 없이 layout **`DashboardPresenceTrack` 상속** (plan 49) |
| AC-08 | Playwright | plan 68 · desktop · person hover **open** | viewport **1280×800 → 1024×768** resize (또는 sidebar toggle로 canvas width 변경) | hover card **즉시 close** · **`getByTestId('org-chart-canvas')` still visible** |
| AC-09 | Playwright | active user · desktop | zoom **「확대」**(`aria-label='확대'`) 클릭 후 **「화면 맞춤」** 클릭 | canvas **visible** · d3 inner content **non-empty** (zoom/fit 버튼 UI **변경 없음** 회귀) |
| AC-10 | Playwright | active user · desktop · wake 탭 | **「산스」** 탭 클릭 | **`getByTestId('org-chart-canvas')` visible** · height **> 500px** (affiliation 전환 후 fill 유지) |
| AC-REG-01 | Playwright | plan 69 · mobile | tree expand/collapse | ReUI tree **정상** · drill-down UI **없음** |
| AC-REG-02 | Playwright | plan 63 · desktop | inactive user B · active user A | canvas에 **A 포함 · B 미포함** |
| AC-REG-03 | API | active user 세션 | `GET /api/org-chart?affiliation=wake` | HTTP **200** · 응답 shape **변경 없음** |
| AC-11 | CLI | 구현 완료 | `bunx playwright test e2e/org-chart/` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 63 desktop d3 내용·API 필터 · plan 68 hover · plan 69 mobile tree · plan 49 presence · plan 07 세션 **유지**.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **FE flex chain** | `org-chart-page-content` · `org-chart-data-body`(desktop) · `org-chart-listing`(필요 시) — `flex-1 min-h-0` |
| B | **FE D3 canvas** | `OrgChartD3Canvas` Card/canvas/empty — 480px 제거 · fill |
| C | **FE ResizeObserver** | container resize → `.fit()` + `closeImmediately()` |
| D | **E2E** | `e2e/org-chart/` 회귀 · AC-01 viewport height (신규 또는 기존 spec 확장) |

### Out Scope

| 항목 | 비고 |
|------|------|
| BE · API · SQL | FE layout only |
| tabs · PDF 버튼 · hover card · zoom 버튼 UI | 변경 없음 |
| mobile `OrgChartMobileTree` fill | plan 69 자연 scroll |
| loading.tsx · Suspense fallback | `variant='fill'` 유지 |
| CUD · activity log | Read-only |
| `PageContainer` 전역 수정 | org-chart feature 내만 |

---

## Flex chain 전략

**목표 chain:**

```
PageContainer (flex-1 flex-col) — 변경 없음
  └─ [wrapper] flex flex-1 flex-col min-h-0          ← OrgChartListing 또는 page-content root
       └─ OrgChartPageContent flex flex-1 flex-col min-h-0 gap-6
            ├─ OrgChartTabs (shrink-0 — 변경 없음)
            └─ [wrapper] flex flex-1 flex-col min-h-0  ← Suspense 감싸기
                 └─ OrgChartDataBody (desktop)
                      └─ [wrapper] flex flex-1 flex-col min-h-0
                           └─ OrgChartD3Canvas
                                └─ Card flex flex-1 flex-col min-h-0 overflow-hidden
                                     └─ containerRef div h-full flex-1 min-h-0 w-full
```

**규칙:** flex column grow 경로 **모든 중간 노드에 `min-h-0`** · **`h-[480px]`/`min-h-[480px]` 제거**.

---

## ResizeObserver + fit 접근

| 단계 | 동작 |
|------|------|
| 1 | `containerRef`에 `ResizeObserver` 등록 (cleanup on unmount) |
| 2 | size change → debounce 50~100ms → `chartRef.current?.fit?.()` |
| 3 | 동시 `closeImmediately()` — plan 68 hover close |
| 4 | 초기 render · `nodes`/`affiliation` 변경 시 기존 `.fit()` **유지** |
| 5 | mount 직후 0-height edge case → rAF 1회 fit fallback [INFERRED] |

**구현 위치:** `org-chart-d3-canvas.tsx` · `use-org-chart-person-hover.ts` **변경 없음** (canvas에서 `closeImmediately` 호출).

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/features/org-chart/components/org-chart-d3-canvas.tsx` | Card/canvas/empty fill · 480px 제거 · ResizeObserver |
| `src/features/org-chart/components/org-chart-data-body.tsx` | desktop wrapper `flex flex-1 flex-col min-h-0` |
| `src/features/org-chart/components/org-chart-page-content.tsx` | root + Suspense wrapper `min-h-0` |
| `src/features/org-chart/components/org-chart-listing.tsx` | (필요 시) child wrapper `flex flex-1 flex-col min-h-0` |

**따라야 할 패턴:** plan 40 filter shell · chat-area `min-h-0 flex-1` · wallet Suspense fill.

**BE:** skip — API/Route 변경 없음.

---

## UI 요구사항 (designer)

| 항목 | 내용 |
|------|------|
| **Desktop Card** | tabs 아래 **남은 viewport 전체** fill · border/shadow/zoom 버튼 **위치·스타일 유지** |
| **Canvas** | Card 내부 **100% height** · pan/zoom 인터랙션 유지 |
| **Empty state** | 동일 fill · centered 2줄 카피(plan 63) 유지 |
| **Mobile** | plan 69 tree — **변경 없음** |
| **Tabs** | plan 63 — gap-6 · 3탭 — **변경 없음** |

---

## API / DB 요구사항

**Out** — layout FE only. `GET /api/org-chart` 변경 없음.

---

## 활동 감사 로그

**해당 없음** — Read-only 레이아웃 수정. mutation Route 없음.

---

## Dashboard Live Presence

`/dashboard/org-chart`는 `dashboard/layout.tsx` **`DashboardPresenceTrack` 상속** — 별도 track 코드 **불필요** (plan 49).

---

## E2E

| 경로 | 내용 |
|------|------|
| `e2e/org-chart/list.spec.ts` | desktop canvas · mobile tree · tabs 회귀 · **AC-01 height assertion 추가 또는 확장** [INFERRED] |
| `e2e/org-chart/person-hover.spec.ts` | hover 회귀 · AC-08 resize close (신규 test 또는 확장) [INFERRED] |
| `e2e/org-chart/admin-slim.spec.ts` | admin slim 회귀 |
| `e2e/org-chart/org-chart.api.spec.ts` | API shape 회귀 |

**판정:** `bunx playwright test e2e/org-chart/`

---

## 열린 질문

| # | 항목 | 상태 |
|---|------|------|
| 1 | `OrgChartListing` wrapper 필요 여부 | 구현 시 chain smoke로 결정 [INFERRED] |
| 2 | debounce 50 vs 100ms | 구현 시 체감 결정 [INFERRED] |
| 3 | AC-08 resize trigger | Playwright `page.setViewportSize` vs sidebar toggle — **viewport resize 우선** [INFERRED] |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-08 | 최초 작성 (Approved) | planner |
