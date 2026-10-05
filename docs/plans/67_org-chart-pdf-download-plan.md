# 조직도 PDF 다운로드 기획서

> Date: 2026-10-05
> Status: Approved
> Author: planner
> **SQL:** 없음
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [33](./33_contract-bulk-download-plan.md), [63](./63_org-chart-admin-profile-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **07** | `/api/*` `requireSession` + `status=active` — download Route 동일 가드 |
| **08** | activity log 전 HTTP 분기 · `finishWithActivityLog` · metadata allowlist |
| **33** | FE 다운로드 패턴 — `Icons.download` + outline Button · blob → `<a download>` · Dialog 없음 |
| **63** | 조직도 트리 데이터·필터·탭 · `GET /api/org-chart` **log Out 유지** · 본 plan은 **download Route만 log In** |

**중복 금지:** d3 캡처 · Playwright/puppeteer 렌더 · 모바일 다운로드 UI · 확인 Dialog · 소속별 3색 팔레트 · `GET /api/org-chart` log 추가.

---

## 한 줄 요약

`/dashboard/org-chart` **데스크톱(md+)** 에서 현재 소속 탭의 조직도를 **서버 pdfkit 박스+연결선 트리 PDF**로 즉시 다운로드한다. **admin·user 동일** 권한. **`org_chart.download` activity log** 전 HTTP 분기 기록. **모바일은 버튼 미노출.**

---

## 정책 확정안 (deep-interview · battle-plan · 디자인 확정)

### 기능·권한

| 항목 | 확정 |
|------|------|
| **API** | `GET /api/org-chart/download?affiliation=wake\|sans\|sans_foundry` |
| **권한** | `requireSession` + `status=active` · **admin·user 동일** · 미인증 **401** · inactive/pending/rejected **403** |
| **FE 버튼** | tabs **우측** · `variant='outline' size='sm'` · `Icons.download` · 라벨 **「PDF 다운로드」** |
| **FE 노출** | **desktop only** — wrapper `hidden md:inline-flex` |
| **모바ile** | 다운로드 버튼 **Out** · drill-down UI 변경 없음 |
| **UX** | **Dialog 없이** 클릭 즉시 fetch · `isLoading` · 성공 토스트 **「PDF 다운로드가 시작되었습니다.」** |
| **파일명** | `wakeone-org-chart-{affiliation}-{yyyy-MM-dd}.pdf` — `formatAbsoluteDateKo` 기준 날짜 · `Content-Disposition` + FE fallback |
| **데이터 소스** | `getOrgChartResponse(affiliation)` / plan 63 `buildOrgChartTree` **재사용** (트리 중복 빌드 금지) |

### PDF 디자인 (박스+연결선 트리 · d3 캡처 Out)

| 항목 | 확정 |
|------|------|
| **렌더 방식** | 서버 **pdfkit** + 좌표 레이아웃 (필요 시 SVG path → PDF embed) · **d3/Playwright 캡처 Out** |
| **용지** | **A4 가로(landscape)** 우선 · 팀·멤버 많으면 **2페이지+** 허용 |
| **배경** | **#ffffff** |
| **카드** | **흰색** + 연한 border(`#e5e5e5` **[INFERRED]**) 또는 subtle shadow · 배경과 구분 |
| **액센트** | **#1a1a1a** — 카드 **우측 세로 바**만 (소속별 색상 **Out** — 웨이크/산스/산스파운드리 **동일 스타일**) |
| **연결선** | **1px** dark gray(`#666666` **[INFERRED]**) · **orthogonal**(직각) |
| **헤더** | `{소속한글명} 조직도 ({yyyy-MM-dd})` + **WakeOne** 로고 또는 워드마크 **[INFERRED: public/assets/opengraph-image.png 또는 「WakeOne」 텍스트]** |
| **계층** | plan 63 `OrgChartNode` 트리와 **동일 계층** |

#### 카드 유형

| 유형 | 대상 | 표시 |
|------|------|------|
| **리더 카드** | CEO · COO · 공장장 · 팀별 `leader_role=team_leader` (없으면 팀 내 **정렬 1위** **[INFERRED]**) | **원형 아바타**(`avatar_url`, 없으면 이니셜 placeholder) · **이름 bold** · **직급 gray** · 우측 #1a1a1a 바 |
| **멤버 카드** | 팀 내 나머지 person | **아바타 없음** · 작은 카드 · 이름 + 직급(+ T/P suffix) · 우측 #1a1a1a 바 |
| **팀/루트 노드** | `nodeType: team` · `root` | 섹션 라벨 박스 또는 connector hub — 연결선 분기점 **[INFERRED]** |

#### 소속별 레이아웃

| 소속 | 레이아웃 |
|------|----------|
| **wake** | CEO → COO → 팀(세로 스택) → 각 팀: 리더 카드 → 멤버(세로 또는 **2열 grid**) |
| **sans** | CEO(또는 루트) → 지점(team) 가로/세로 → 지점 내 멤버 |
| **sans_foundry** | CEO → **공장장** → **5팀 가로 배치** → 각 팀: 팀장(리더 카드) → 멤버 세로(또는 2열) |

#### 빈 조직도

- HTTP **200** PDF 유지 — 헤더 + **「표시할 임직원이 없습니다」** 본문 · activity log **In**

### activity log (의도적 READ 예외)

| Route | log |
|-------|-----|
| `GET /api/org-chart` | **Out** (plan 63 유지) |
| `GET /api/org-chart/download` | **In** — `org_chart.download` |

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | 데스크톱 조직도 PDF 다운로드 + 감사 로그 |
| **Done when** | AC #01–#13 · CLI #14 green |
| **Not doing** | d3 캡처 · 모바일 버튼 · Dialog · 소속별 컬러 · SQL |

### STEPS

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | `pdfkit` + `pdf.server.ts` 레이아웃 엔진 | wake 샘플 PDF smoke | MED |
| 2 | `GET /api/org-chart/download` + activity log | curl 200/401/403/400 | HIGH |
| 3 | activity types · labels · `affiliation` allowlist | compile | HIGH |
| 4 | FE DownloadButton + tabs 행 | desktop UI | HIGH |
| 5 | E2E UI + API spec | spec green | MED |
| 6 | verifier | build | HIGH |

**Checkpoint:** Step 1 — 한글·아바타·가로 A4 PDF 로컬 smoke

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | pdfkit 한글 깨짐 | Noto Sans KR embed `public/fonts/` **[INFERRED]** · Step 1 smoke |
| HIGH | log return 분기 누락 | Route 매트릭스 · AC-09~11 |
| MED | 가로 A4 레이아웃 overflow | 2페이지 분할 · sans_foundry 5팀 가로 |
| MED | avatar fetch 실패 | placeholder 이니셜 circle |
| LOW | 모바일 버튼 노출 | AC-05 `hidden md:inline-flex` |

### ESTIMATE

~12–16 files · ~700–1100 LOC · **Medium–Complex** · **~3–5시간**

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active **user** · viewport **≥768px** | `/dashboard/org-chart?affiliation=wake` | **「PDF 다운로드」** 버튼이 보인다 |
| AC-02 | Playwright | AC-01 | 「PDF 다운로드」 클릭 | 브라우저 다운로드 시작 · 토스트 **「PDF 다운로드가 시작되었습니다.」** |
| AC-03 | Playwright | active **admin** · desktop | 웨이크 탭 · 「PDF 다운로드」 | 다운로드 **성공** (admin-only **아님**) |
| AC-04 | Playwright | **mobile viewport (<768px)** · active user | `/dashboard/org-chart` | **「PDF 다운로드」 버튼이 보이지 않는다** |
| AC-05 | Playwright | mobile · active user | drill-down 팀 목록 탐색 | plan 63 drill-down **정상** (회귀) |
| AC-06 | API | active user 세션 | `GET /api/org-chart/download?affiliation=wake` | HTTP **200** · `Content-Type: application/pdf` · body가 **`%PDF`** 로 시작 |
| AC-07 | API | AC-06 | `Content-Disposition` 헤더 | `wakeone-org-chart-wake-` + **`yyyy-MM-dd`** (`formatAbsoluteDateKo` 기준) 포함 |
| AC-08 | API | active user · download **200** | `GET /api/activity-logs?action=org_chart.download&limit=20` | 최신 행: action **`org_chart.download`** · metadata **`affiliation: wake`** · `http_status: 200` |
| AC-09 | API | 미인증 | `GET /api/org-chart/download?affiliation=wake` | HTTP **401** · log **`org_chart.download`** · `http_status: 401` |
| AC-10 | API | **inactive** user 세션 | 동일 GET | HTTP **403** · log **`org_chart.download`** · `http_status: 403` |
| AC-11 | API | active user | `GET /api/org-chart/download?affiliation=invalid` | HTTP **400** · log **`org_chart.download`** · `http_status: 400` |
| AC-12 | Playwright | active user | `/dashboard/org-chart` | `dashboard/layout` **`DashboardPresenceTrack` 상속** (plan 49 · plan 63 AC-17 회귀) |
| AC-13 | Playwright | active user · desktop | 산스 탭 선택 후 「PDF 다운로드」 | 다운로드 파일명에 **`sans`** 포함 |
| AC-14 | CLI | 구현 완료 | `bunx playwright test e2e/org-chart/` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 63 조직도 Read·d3·drill-down · plan 07 세션 · plan 49 presence **유지**.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **BE PDF** | `pdf.server.ts` — pdfkit 박스+연결선 트리 · A4 landscape · 헤더·리더/멤버 카드·orthogonal line |
| B | **BE API** | `GET /api/org-chart/download` · `finishWithActivityLog` 전 분기 |
| C | **BE log** | `org_chart.download` · `ActivityTargetType: org_chart` · metadata `affiliation` |
| D | **FE** | `org-chart-download-button.tsx` · tabs 우측 · `hidden md:inline-flex` · `service.ts` download |
| E | **E2E** | `e2e/org-chart/download.spec.ts` · `download.api.spec.ts` |

### Out Scope

| 항목 | 비고 |
|------|------|
| d3/Playwright **화면 캡처** | 서버 레이아웃만 |
| **모바일** 다운로드 버튼 | `<md` Out |
| 확인 Dialog / preview Route | 즉시 다운로드 |
| 소속별 **3색 팔레트** | #1a1a1a + 흰 배경 통일 |
| `GET /api/org-chart` activity log | plan 63 Out 유지 |
| SQL migration | 없음 |
| kbar · nav 변경 | 없음 |

---

## User Flow (Express)

### Flow A — PDF 다운로드 (desktop)

1. active user/admin 로그인 → **조직도** → 소속 탭 선택 (nuqs `affiliation`)
2. md+ viewport: tabs 우측 **「PDF 다운로드」** 클릭
3. `GET /api/org-chart/download?affiliation={current}` → PDF blob 저장
4. 토스트 **「PDF 다운로드가 시작되었습니다.」** · `/dashboard/logs`에 **`org_chart.download`** 행 append

### Flow B — mobile (변경 없음)

1. 동일 진입 · drill-down만 · **PDF 버튼 없음**

---

## UI/UX (designer)

### Download Button

- 참조: `contract-bulk-download-button.tsx` — **`Icons.download` + outline Button** (Dialog·Tooltip **없음**)
- 위치: `OrgChartTabs` **같은 행 우측** — `flex items-center justify-between gap-4`
- wrapper: **`hidden md:inline-flex`** — 모바일 DOM에서 숨김
- 로딩: Button `isLoading` / `isPending`
- 에러: `notifyError` — 「PDF 다운로드에 실패했습니다.」 등 **[INFERRED]**

### PDF (출력물 · designer 참고)

- **A4 landscape** · 배경 `#ffffff`
- 카드: 흰색 · border/shadow · **우측 #1a1a1a 세로 바**
- 리더: 원형 avatar · bold name · gray 직급
- 멤버: 소형 카드 · avatar 없음 · 2열 grid 허용
- 연결선: 1px orthogonal dark gray
- 헤더: `{웨이크|산스|산스파운드리} 조직도 (yyyy-MM-dd)` + WakeOne mark

---

## API / Service Layer

### Feature 구조

```txt
src/features/org-chart/
  api/pdf.server.ts              — generateOrgChartPdf(affiliation) → Buffer
  api/pdf-layout.ts              — [INFERRED] 좌표·connector 계산 (pure, testable)
  api/service.ts                 — downloadOrgChartPdf(affiliation) client fetch
  components/org-chart-download-button.tsx
  components/org-chart-page-content.tsx  — tabs + button row

src/app/api/org-chart/download/route.ts

src/features/activity-logs/api/types.ts   — org_chart.download, target org_chart
src/features/activity-logs/api/log.server.ts — affiliation allowlist
src/features/activity-logs/labels.ts
```

### Download API

| Method | Path | Guard | Response |
|--------|------|-------|----------|
| GET | `/api/org-chart/download?affiliation=` | `requireSession` | `application/pdf` attachment |

**`mutations.ts`:** 불필요 — cache invalidate 없음 (plan 33 bulk download와 동일).

---

## 활동 감사 로그

> **GET /api/org-chart:** activity log **해당 없음** (plan 63 Read Out).

### 기록 연동

| Route | action | target_type | target | metadata (2xx) |
|-------|--------|-------------|--------|----------------|
| `GET /api/org-chart/download` | `org_chart.download` | `org_chart` | `target_user_id: actor` · `target_label: '{소속한글명} 조직도'` | `{ affiliation }` |

### return 분기 매트릭스

| 분기 | HTTP | metadata |
|------|------|----------|
| 미인증 | 401 | `error_code: unauthenticated` |
| inactive/pending/rejected | 403 | `error_code: inactive_user` |
| affiliation 누락/invalid | 400 | `error_code: validation`, `message` |
| PDF 성공 | 200 | `{ affiliation }` |
| PDF 생성 실패 | 500 | `error_code: internal_error` |

**구현:** Handler 진입 `requestId = createRequestId()` → 각 return **`finishWithActivityLog`** 또는 **`jsonWithActivityLog`** → `x-request-id` 헤더.

**AC 검증:** AC-08 (200 + affiliation) · AC-09 (401) · AC-10 (403) · AC-11 (400).

**신규 타입:** `ActivityAction` += `'org_chart.download'` · `ActivityTargetType` += `'org_chart'` · `METADATA_ALLOWLIST` += `'affiliation'` · `ACTION_LABELS` += **「조직도 PDF 다운로드」** **[INFERRED]**.

---

## E2E

| 항목 | 내용 |
|------|------|
| **경로** | `e2e/org-chart/download.spec.ts` · `e2e/org-chart/download.api.spec.ts` |
| **셀렉터** | `getByRole('button', { name: 'PDF 다운로드' })` · `getByRole('tab', …)` |
| **viewport** | AC-04: mobile project 또는 `page.setViewportSize({ width: 375, height: 667 })` |
| **인증** | `storageState` user.json · admin.json 재사용 |
| **activity_logs** | API spec — `x-request-id` + action 행 (plan 63 `org-chart.api.spec.ts` 패턴) |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `package.json` | `pdfkit` · `@types/pdfkit` dev |
| `src/features/org-chart/api/pdf.server.ts` | **신규** |
| `src/features/org-chart/api/pdf-layout.ts` | **신규** **[INFERRED]** |
| `src/app/api/org-chart/download/route.ts` | **신규** |
| `src/features/org-chart/api/service.ts` | download helper |
| `src/features/org-chart/components/org-chart-download-button.tsx` | **신규** |
| `src/features/org-chart/components/org-chart-page-content.tsx` | tabs+button row |
| `src/features/activity-logs/api/types.ts` | action · target_type |
| `src/features/activity-logs/api/log.server.ts` | `affiliation` allowlist |
| `src/features/activity-logs/labels.ts` | 한국어 라벨 |
| `e2e/org-chart/download*.spec.ts` | **신규** |

**패턴:** plan 33 download blob · `finishWithActivityLog` · plan 63 `getOrgChartResponse` · plan 08 log matrix

---

## 열린 질문

| # | 항목 | 기본값 |
|---|------|--------|
| 1 | WakeOne 헤더 로고 | `opengraph-image.png` embed 또는 **「WakeOne」** 텍스트 |
| 2 | 한글 폰트 경로 | `public/fonts/NotoSansKR-Regular.ttf` **[INFERRED]** |
| 3 | 팀 리더 없을 때 리더 카드 | 정렬 1위 person을 리더 카드로 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-05 | 최초 작성 · Approved · `/root` planner Phase 3+4 · PDF 박스+연결선 트리 디자인 반영 | planner |
