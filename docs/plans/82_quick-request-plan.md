# 퀵 요청하기 기획서

> Date: 2026-10-20
> Status: Approved
> Author: planner
> **UI·폼 AC superseded by:** [83_quick-request-wizard-plan.md](./83_quick-request-wizard-plan.md) (2026-10-20) — MVP 단일 스크롤 baseline·Out 정책은 83이 상속
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [26](./26_loading-spinner-unification-plan.md), [31](./31_global-kbar-search-plan.md), [49](./49_live-users-presence-plan.md), [76](./76_hr-benefits-manager-access-plan.md) (nav 그룹 선례)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **07** | Completed | active dashboard 세션 · pending/inactive 차단 · admin-only registry와 **별도** (본 페이지는 일반 user 접근) |
| **08** | Approved | 1차 **서버 CUD·실제 전송 없음** → **activity log 해당 없음** (placeholder Route 포함) |
| **14** | Completed | 본 기능 **DELETE 없음** — 미리보기 Dialog만 (AlertModal 삭제 확인 **Out**) |
| **26** | Approved | `/dashboard/quick/request` Read 로딩 → **`PageLoadingSpinner`** (overview skeleton **Out**) |
| **31** | Revised | kbar synonym · nav 필터와 **동일 RBAC** |
| **49** | Approved | `/dashboard/quick/request`는 **`dashboard/layout` 하위** → **`DashboardPresenceTrack` 상속** (페이지별 track **없음**) |
| **76** | Completed | 신규 nav **그룹** 추가 패턴 (Overview 다음 · HR 앞) |

---

## 한 줄 요약

active 직원·admin이 **`/dashboard/quick/request`** 전체 페이지에서 MVP 다단계 퀵 요청 폼을 작성하고, **「새 퀵 요청」** 카카오용 미리보기 Dialog까지 확인한다. **확인** 시 **`POST /api/quick-request/notify` placeholder**를 호출하되 1차는 **미구현(501 등)** → **미리보기 텍스트 복사 + 안내 토스트**로 마무리한다. **오픈채팅 URL·실제 카톡 API·DB 저장**은 **Phase 2(사용자 제공 API)**.

---

## 정책 확정안 (deep-interview · battle-plan · 2026-10-20 수정)

| # | 항목 | 확정 |
|---|------|------|
| Q1 | **폼 범위** | **MVP** — 유형(물품/차량), 출발·도착(우편 주소+상세+담당자+연락처), 메모 |
| Q2 | **RBAC** | **active `system_role` user·admin 전원** (소속 무관) · nav `access` **없음** |
| Q3 | **저장** | **DB 저장 없음** · 브라우저 폼 상태만 · **activity log Out** |
| Q4 | **자동 채움** | 세션 프로필 **`full_name`·`phone`** 출발 담당자/연락처 기본값 + **다음 우편번호** 주소 검색(출발·도착) |
| Q5 | **미리보기** | sans-quick **유사 한국어 템플릿** · 첫 줄 **「새 퀵 요청」** 느낌 · WakeOne shadcn (**sans 픽셀 복제 금지**) |
| Nav | **그룹 `퀵`** · 메뉴 **「퀵 요청하기」** · **`/dashboard/quick/request`** · 그룹 내 **페이지 1개** (대시보드/내역 **Out**) |
| Layout | **전체 페이지** (Sheet/모달 폼 **Out**) · **`PageContainer` + `viewportFill`** |
| 1차 확인 | API **스텁/placeholder** · **복사 fallback** · `redirectUrl`은 **API 성공 응답에 있을 때만** (2차) |
| Env | **`NEXT_PUBLIC_QUICK_OPEN_CHAT_URL` 필수 아님** · 오픈채팅 직접 open **1차 Out** |

---

## 목표 & 완료 기준 (AC)

공통: E2E는 **`storageState` active user** (`e2e/.auth/user.json`) · 셀렉터 **`getByRole` / `getByPlaceholder` / `getByTestId`만** · `/dashboard/quick/request`는 **`dashboard/layout` 하위** (plan 49).

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user | 사이드바 **`퀵`** 그룹에서 **「퀵 요청하기」** 클릭 | URL **`/dashboard/quick/request`** · 페이지 제목(heading) **「퀵 요청하기」** 표시 |
| AC-02 | Playwright | active user | `/dashboard/quick/request` 직접 진입 | overview·disabled-routes **리다이렉트 없음** |
| AC-03 | Playwright | 미로그인 | `/dashboard/quick/request` 이동 | **`/auth/sign-in`** · dashboard 셸(Search 등) **미노출** (plan 07) |
| AC-04 | Playwright | pending 또는 inactive user | `/dashboard/quick/request` 이동 | dashboard 접근 **차단** · sign-in 또는 거부 UX (plan 07·kanban guard 패턴) |
| AC-05 | grep/구현 | 구현 완료 | `src/app/dashboard/quick/request` 트리 | **`dashboard/layout.tsx` 상속** · quick 전용 `DashboardPresenceTrack` **0건** (plan 49) |
| AC-06 | Playwright | active user · 페이지 로드 | 출발 담당자·연락처 필드 확인 | **프로필 `full_name`·`phone`** 이 기본값으로 채워짐 (`phone` null이면 연락처 **빈칸** + 제출 시 검증) |
| AC-07 | Playwright | active user | Step 1에서 필수 비우고 다음/만들기 시도 | **한국어** 필드 에러 표시 · 미리보기 Dialog **열리지 않음** |
| AC-08 | Playwright | active user | MVP 필드 유효 입력 후 마지막 **「만들기」** | **미리보기 Dialog** 표시 · 본문에 **`새 퀵 요청`**(또는 동일 의미 prefix) · 입력값(유형·출발·도착·메모) **반영** |
| AC-09 | Playwright | AC-08 Dialog | **「확인」** 클릭 | **`POST /api/quick-request/notify`** 요청 발생 · 응답 **501**(또는 기획 확정 미구현 코드) 시 **`카톡 API 연동 후 자동 전송`**(또는 동일 의미) **토스트/안내** · **미리보기 텍스트가 클립보드에 복사됨** (또는 **「복사」** 성공 토스트) |
| AC-10 | Playwright | AC-09 성공 UX 후 | Dialog 닫힘 | 폼이 **초기값으로 reset** (재요청 가능 · plan forms §서버 성공 reset — 1차는 notify **스텁 성공 UX**와 동일 처리) |
| AC-11 | Playwright | active user | Cmd+K → **「퀵 요청하기」** 검색 | `/dashboard/quick/request` 이동 (plan 31) |
| AC-12 | Playwright | active user | 페이지 최초 로드 | **`loading.tsx`** 또는 Suspense 구간에 **`PageLoadingSpinner`** (variant route/page 또는 fill — plan 26) |
| AC-13 | Playwright | (2차 · API mock) notify **200** + body `{ redirectUrl: 'https://…' }` | **「확인」** | **새 탭** 또는 `window.open`으로 **redirectUrl** 이동 · 1차 E2E **skip 가능** · AC 문서만 유지 |
| AC-14 | CLI | — | `bunx playwright test e2e/quick-request` | **green** |
| AC-15 | CLI | — | `npm run build` | **통과** |

**타임스탬프 (미리보기 본문):** 요청 시각은 **`formatAbsoluteDateTimeKo`** (`yyyy-MM-dd (EEE) HH:mm:ss`) · 상대 시각 **금지**.

---

## 범위 (In / Out)

### In Scope — Phase 1 (본 plan 구현)

| # | 영역 | 내용 |
|---|------|------|
| 1 | **Nav** | `nav-config`: 그룹 **`퀵`** (Overview 다음 · HR 앞) · **「퀵 요청하기」** 1항목 · icon `Icons` 기존 키 |
| 2 | **kbar** | `kbar-nav-synonyms.ts` — `퀵 요청하기` 키워드 |
| 3 | **Page** | `src/app/dashboard/quick/request/page.tsx` · `loading.tsx` · RSC `getSessionProfile` → 클라이언트에 이름·연락처 전달 |
| 4 | **Feature** | `src/features/quick-request/` — Zod · `useAppForm` · `useFormStepper` · 4-step MVP |
| 5 | **주소** | Daum Postcode (`postcode.v2.js`) — 출발·도착 **주소 검색** + 상세 수동 |
| 6 | **미리보기** | shadcn **Dialog** · `formatQuickRequestKakaoMessage()` (절대 시각 포함) |
| 7 | **확인 UX** | `service.ts` → **`POST /api/quick-request/notify`** · FE `mutations.ts` **`onSettled` invalidate** — **본 feature Read query 없으면 mutation만** (list cache **없음**) |
| 8 | **API placeholder** | `POST /api/quick-request/notify` — `requireSession` + active · body: 폼 payload(JSON) · **1차: HTTP 501** `{ success: false, message: '…' }` + **`x-request-id`** (일관성) · **실제 카톡/동방 API 호출 없음** · **`recordActivityLog` 호출 없음** (plan activity Out) |
| 9 | **FE fallback** | 501/미구현 → **`notifyError` 또는 info** + **클립보드 복사** + Dialog 닫기·**`form.reset()`** |
| 10 | **E2E** | `e2e/quick-request/*.spec.ts` |

### Out of Scope — Phase 1

| 항목 | 비고 |
|------|------|
| 요청 **DB 저장** · 관리자 **내역/목록** | 2차 이후 검토 |
| **카카오/오픈채팅 실제 발송** | Phase 2 |
| **`NEXT_PUBLIC_QUICK_OPEN_CHAT_URL` 필수** · URL **직접 open** | API **`redirectUrl` 있을 때만** (AC-13) |
| sans-quick **픽셀 복제** | WakeOne DS only |
| **activity_logs** | Read·placeholder 501 **Out** — [08](./08_activity-audit-log-plan.md) 본 plan **해당 없음** |
| **DELETE** · AlertModal | 해당 없음 |

### Phase 2 — 사용자 제공 오픈채팅/카톡 API (별도 plan · `[TBD]`)

| # | 내용 |
|---|------|
| P2-1 | 사용자(운영)가 **오픈채팅/카톡용 API** 스펙·인증·엔드포인트 제공 |
| P2-2 | `POST /api/quick-request/notify` — 외부 API 프록시 · **2xx** 시 `{ redirectUrl?: string }` 등 계약 확정 |
| P2-3 | FE **확인** — 2xx + `redirectUrl` → 새 탭 이동 · 실패 시 **복사 fallback 유지** |
| P2-4 | (선택) 전송 이력 DB · activity log — **별도 plan**에서 In 여부 결정 |

---

## UI 요구사항

| 항목 | 규칙 |
|------|------|
| Shell | `PageContainer` **`pageTitle="퀵 요청하기"`** · **`viewportFill`** · 본문 `flex-1 min-h-0 overflow-auto` (모바일 CTA 도달 가능) |
| 폼 | `useAppForm` + `useFormFields` · 스텝별 **별도 컴포넌트** (`AppField` 내부 `useState` **금지**) |
| 아이콘 | `Icons.*` only |
| 스텝 (가안) | 1 유형 · 2 출발 · 3 도착 · 4 메모+만들기 |
| 미리보기 | Dialog · 읽기 전용 `<pre>` 또는 `font-mono text-xs` · **복사** 버튼 권장(AC-09) |
| 로딩 | `loading.tsx` → `PageLoadingSpinner` |

---

## API / DB 요구사항

### DB

- **변更 없음** (Phase 1)

### `POST /api/quick-request/notify` (Phase 1 placeholder)

| 항목 | 내용 |
|------|------|
| Auth | `requireSession` · **active** profile only |
| Body | `{ requestType, origin, destination, memo?, requestedAtIso? }` — Zod 검증 · **비민감** 필드만 |
| Response 1차 | **501** · `{ success: false, message: '카톡 API 연동 전입니다.' }` (문구 FE AC와 정합) |
| Headers | `x-request-id` (UUID) |
| Activity log | **Out** — `recordActivityLog` **호출하지 않음** |

### FE service layer

```
src/features/quick-request/api/
  types.ts
  service.ts      → POST /api/quick-request/notify
  mutations.ts    → notifyQuickRequestMutation · onSettled (invalidate 대상 없으면 no-op 또는 feature key only)
```

---

## 활동 감사 로그

**activity log 해당 없음** — Phase 1은 Read·클라이언트 폼·**실질 CUD 없음** · placeholder Route는 **501 고정** · 로그인/로그아웃 **Out**. Phase 2에서 실제 전송 Route가 **2xx CUD**로 바뀌면 **신규 plan**에서 plan 08 연동.

---

## 영향 파일 & 패턴 (예상)

| 팀 | 경로 |
|----|------|
| FE | `src/config/nav-config.ts`, `src/components/kbar/kbar-nav-synonyms.ts` |
| FE | `src/app/dashboard/quick/request/page.tsx`, `loading.tsx` |
| FE | `src/features/quick-request/**` |
| BE | `src/app/api/quick-request/notify/route.ts` (placeholder) |
| verifier | `e2e/quick-request/*.spec.ts` |

**패턴:** `kanban` nav/guard · `org-chart`/`kanban` `viewportFill` · `multi-step-product-form` stepper · `profile/page` session props

---

## 리스크 & 완화

| 수준 | 리스크 | 완화 |
|------|--------|------|
| HIGH | `phone` null → 제출 실패 | Zod + 한국어 안내 · AC-06 |
| MED | Daum 스크립트 CSP/모바일 | embed 모드 · E2E는 desktop 우선 + 수동 QA 메모 |
| MED | 501을 실패로만 처리해 reset 누락 | **1차 UX = 복사+안내 = 사용자 목표 달성** → reset·Dialog 닫기 **In** (AC-09~10) |
| LOW | placeholder Route 나중에 activity log 누락 | Phase 2 **별도 plan** |

---

## 팀별 구현 순서 (권장)

1. **designer** — 스텝 IA · viewportFill · Dialog · 모바일 CTA
2. **backend-dev** — `POST /api/quick-request/notify` placeholder (501) · types 공유
3. **frontend-dev** — nav · page · feature · Daum · 미리보기 · mutation · copy fallback
4. **verifier** — AC-01~15 · build

**backend-dev 생략 불가** — placeholder Route가 AC-09에 **In**.

---

## 검증 체크리스트 (verifier)

- [ ] `bunx playwright test e2e/quick-request`
- [ ] `tsc` · lint · `npm run build`
- [ ] activity log grep — `quick-request` Route에 **`recordActivityLog` 0건** (Out 확인)
- [ ] `npm run e2e:cleanup` exit 0 (전역)

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-20 | 최초 작성 · Approved · 1차 placeholder API·복사 fallback · Phase 2 사용자 API | planner |
| 2026-10-20 | UI·폼 AC → [83](./83_quick-request-wizard-plan.md) supersede (4단계 wizard) | planner |
