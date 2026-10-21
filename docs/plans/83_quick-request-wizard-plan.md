# 퀵 배송 요청 (4단계 Wizard) 기획서

> Date: 2026-10-20
> Status: Approved
> Author: planner
> **UI·AC superseded by:** [86_quick-request-kakao-redesign-plan.md](./86_quick-request-kakao-redesign-plan.md) (2026-10-20) — 4단계 wizard 폐기 · 폼 모델·경유·notify·결제 정책은 86이 상속
> **Supersedes:** [82](./82_quick-request-plan.md) **UI·폼 AC** (MVP 단일 스크롤) — 인프라·Out 범위는 82 상속
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [26](./26_loading-spinner-unification-plan.md), [31](./31_global-kbar-search-plan.md), [49](./49_live-users-presence-plan.md), [76](./76_hr-benefits-manager-access-plan.md), [82](./82_quick-request-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **82** | Approved · MVP 구현됨 | notify 501 · Dialog · Daum · nav · RBAC · E2E baseline — **본 plan이 UI/AC 대체** |
| **07** | Completed | dashboard/API 세션 · pending/inactive 차단 |
| **08** | Approved | placeholder 501 → **activity log Out** |
| **14** | Completed | DELETE 없음 · AlertModal **Out** |
| **26** | Approved | `PageLoadingSpinner` on `/dashboard/quick/request` |
| **31** | Revised | kbar **「퀵 요청하기」** |
| **49** | Approved | `dashboard/layout` → **`DashboardPresenceTrack` 상속** |
| **76** | Completed | nav 그룹 **「퀵」** 선례 |

---

## 한 줄 요약

active 직원·admin이 **`/dashboard/quick/request`** 에서 **참조 이미지 수준 4단계 wizard**(`useFormStepper` · **goToStep** jump edit)로 퀵 배송 요청을 작성하고, **4단계 요약 → 「퀵 요청 등록하기」 → 카카오용 Dialog → 확인** 시 **`POST /api/quick-request/notify`**(501) + **복사·reset**으로 마무리한다. **경유지 무제한 add/remove** · notify body **stopovers 전체 배열**. **DB·activity log·실카톡·자주 쓰는 주소/칩·퀵 대시보드**는 **Out**(82 동일).

---

## 정책 확정안 (deep-interview · battle-plan · 2026-10-20)

| # | 항목 | 확정 |
|---|------|------|
| D1 | **주소·연락** | Daum + 수동만 · 출발 담당/연락 **프로필 기본값 + 수동** |
| D2 | **자주 쓰는 주소 · 연락처 칩** | **Out** |
| D3 | **`/dashboard/quick` 퀵 대시보드** | **Out** · nav **「퀵 요청하기」1항목** |
| D4 | **참조 「← 퀵 대시보드」** | **Out** (designer: breadcrumb 없음 또는 최소) |
| D5 | **스텝** | 4단계 stepper · prev/next · **직접 수정/단계 shortcut → goToStep(n)** |
| D6 | **등록 플로우** | Step4 **퀵 요청 등록하기** → **Dialog 미리보기**(82) → 확인 → notify |
| D7 | **경유지** | **무제한** add/remove · FE UX 검증만 · **상한 없음** |
| D8 | **결제** | Step3 **선불/착불** pill · Step4 요약 **「💳 결제: 월정산」** 고정 표시 + 선택값 별도 표기 |
| D9 | **RBAC** | 82와 동일 · active user + admin |
| D10 | **저장·로그·API** | **DB Out** · **activity log Out** · notify **501** · `redirectUrl` 2차 only |

---

## 목표 & 완료 기준 (AC)

공통: E2E **`storageState` active user** (`e2e/.auth/user.json`) · 셀렉터 **`getByRole` / `getByPlaceholder` / `getByTestId`만** · `/dashboard/quick/request`는 **`dashboard/layout` 하위** (plan 49).

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user | 사이드바 **「퀵」** 그룹 **「퀵 요청하기」** 클릭 | URL **`/dashboard/quick/request`** · 페이지 heading **「🚚 퀵 배송 요청」**(또는 동일 문구·emoji 포함) 표시 |
| AC-02 | Playwright | active user | `/dashboard/quick/request` 직접 진입 | overview·disabled-routes **리다이렉트 없음** |
| AC-03 | Playwright | 미로그인 | `/dashboard/quick/request` 이동 | **`/auth/sign-in`** · dashboard 셸(Search 등) **미노출** (plan 07) |
| AC-04 | Playwright | pending user | `/dashboard/quick/request` 이동 | sign-in **pending** 거부 UX (plan 07·82 AC-04) |
| AC-05 | grep | 구현 완료 | `src/app/dashboard/quick/request` | **`dashboard/layout.tsx` 상속** · quick 전용 `DashboardPresenceTrack` **0건** (plan 49) |
| AC-06 | Playwright | active user · Step 2 진입 | 출발 담당·연락 필드 확인 | **프로필 `full_name`·`phone`** 기본값 (`phone` null → 연락처 빈칸) |
| AC-07 | Playwright | active user · Step 1 | **4단계** stepper(또는 progress) UI 확인 | **1~4단계** 구분 표시 · 현재 **1단계** 강조 |
| AC-08 | Playwright | Step 1 · 물품 내용 비움 | **「다음」** 클릭 | **한국어** 검증 메시지 · Step 2 **이동하지 않음** |
| AC-09 | Playwright | Step 1 | 차량 카드 **2종 이상** 선택(예: **5톤** + **오토바이**) | 선택 상태 유지 · **「다음」** 시 Step 2 이동 |
| AC-10 | Playwright | Step 1 | **기타** 차량 선택 | **직접 입력** 필드 표시 · 미입력 시 **「다음」** 차단 |
| AC-11 | Playwright | Step 1 | 차량 대수 **「3대」** 선택 | Step 4 요약에 **3대** 반영 |
| AC-12 | Playwright | Step 1 | 차량 대수 **「직접」** + 숫자 입력 | 요약·Dialog에 **입력 대수** 반영 |
| AC-13 | Playwright | Step 2 | **「즉시 요청」** 선택 후 유효 주소·담당 입력 · **「다음」** | Step 3 이동 · Step 4 요약 **출발일시: 즉시 요청**(또는 동일 카피) |
| AC-14 | Playwright | Step 2 | **「날짜/시간 선택」** + 유효 datetime | Step 4·Dialog에 **절대 시각** (`formatAbsoluteDateTimeKo` 형식) 표시 · 상대 시각 **없음** |
| AC-15 | Playwright | Step 2 | 출발지 특이사항 카드 **1개 이상** 선택 | Step 4 요약·Dialog 본문에 **선택 문구** 포함 |
| AC-16 | Playwright | Step 3 · 경유 0 | **「+ 경유지 추가」** 연속 **3회** | 경유지 입력 블록 **3개** · **상한 안내/비활성 없음** |
| AC-17 | Playwright | AC-16 상태 | 경유지 **1개「삭제」**(또는 remove) | 블록 **2개** · 요약·Dialog **남은 2개** 경유 반영 |
| AC-18 | Playwright | Step 3 | 도착 필수 비우고 **「다음」** | **한국어** 에러 · Step 4 **미진입** |
| AC-19 | Playwright | Step 3 | **「착불」** pill 선택 · 나머지 유효 | Step 4 요약 **착불**(또는 배송비 착불) + **`💳 결제: 월정산`**(또는 **월정산**) **동시 표시** |
| AC-20 | Playwright | Step 3 | **「최대한 빠르게」** 도착 선택 | Step 4 **도착일시** 해당 카피 표시 |
| AC-21 | Playwright | Step 4 | **「출발지 정보 수정」**(또는 동일 shortcut) 클릭 | **Step 2**로 jump · 수정 후 Step 4 복귀 시 **변경값** 요약 반영 |
| AC-22 | Playwright | Step 4 | **「✎ 직접 수정」** (또는 동일) | 편집 가능 UX(해당 step jump 또는 inline — 구현은 jump **필수**) |
| AC-23 | Playwright | Step 4 · 전 단계 유효 | **「퀵 요청 등록하기」** | **미리보기 Dialog** 열림 · 본문 **`새 퀵 요청`**(또는 🚚 prefix) · 물품·차량·출발·**경유 전체**·도착·선불/착불·**월정산**·메모 **반영** |
| AC-24 | Playwright | AC-23 Dialog | **「확인」** | **`POST /api/quick-request/notify`** · **501** · **`카톡 API 연동 후 자동 전송`**(동의어) **토스트/안내** · 클립보드 **복사 성공** 토스트(또는 동등 UX) |
| AC-25 | Playwright | AC-24 후 | Dialog 닫힘 | **`form.reset()`** · Step **1** · 출발 담당 **프로필 기본값** 복원 |
| AC-26 | Playwright | active user | Cmd+K → **「퀵 요청하기」** | `/dashboard/quick/request` (plan 31) |
| AC-27 | Playwright | active user | 페이지 최초 로드 | **`loading.tsx`** → **`PageLoadingSpinner`** (plan 26) |
| AC-28 | API | active 세션 · 유효 body · **stopovers 2건** | `POST /api/quick-request/notify` | **501** · **`x-request-id`** · body parse **stopovers 길이 2** 수용(400 아님) |
| AC-29 | grep | 구현 완료 | `quick-request/notify/route.ts` | **`recordActivityLog` 0건** |
| AC-30 | Playwright | (2차 · mock) notify **200** + `{ redirectUrl }` | Dialog **「확인」** | **새 탭** `redirectUrl` · 1차 E2E **skip 가능** |
| AC-31 | CLI | — | `bunx playwright test e2e/quick-request` | **green** |
| AC-32 | CLI | — | `npm run build` | **통과** |

**타임스탬프:** Dialog·요약·문자열 내 시각은 **`formatAbsoluteDateTimeKo`** only · 상대 시각 **금지**.

---

## 4단계 IA (In Scope UI)

| Step | 제목(참조) | In |
|------|------------|-----|
| **1** | 물품 정보 & 차량 선택 | **물품 내용*** · 차량 **multi-select 카드 9**(`오토바이`,`다마스`,`라보`,`1톤 탑차(윙바디)`,`1톤 오픈형`,`1톤 냉장(냉동)`,`2.5톤`,`5톤`,`기타`+직접입력) · **차량 대수** 1~5 + **직접** |
| **2** | 출발지 (픽업) | Daum+픽업 주소/상세 · 담당/연락* · **픽업 일시*** `즉시 요청` \| datetime · **출발지 특이사항** 카드(복수) · **픽업 메모** |
| **3** | 경유지 & 도착지 | **+ 경유지 추가**(무제한) · 경유별 remove · 경유=location 필드(출발과 동일 subset) · 도착 Daum+필드 · **도착 희망*** `최대한 빠르게` \| datetime · **도착 특이사항** · **추가 메모** · **선불/착불** pill |
| **4** | 완성 | 요약 카드 · **월정산** + 선불/착불 · **직접 수정** + 단계 shortcut(1/2/3) · **퀵 요청 등록하기** → Dialog |

**Stepper:** `useFormStepper` + **`goToStep(stepNumber)`** (jump edit). **AppField 내부 useState 금지** — 스텝별 컴포넌트.

**Shell:** `PageContainer` **`pageTitle="🚚 퀵 배송 요청"`** · **`viewportFill`** · 하단 CTA 고정(모바일 도달).

---

## 경유지 · 폼 모델

| 항목 | 규칙 |
|------|------|
| **Form** | `stopovers: QuickRequestLocation[]` — 0..∞ |
| **추가/삭제** | UI만 제한 없음 · AC-16~17 |
| **메시지** | `formatQuickRequestKakaoMessage` — **모든 경유** 순서대로 블록 |
| **Notify** | `stopovers` **전체 배열** (빈 배열 허용) |

---

## 결제 UX

| 위치 | 표시 |
|------|------|
| Step 3 | **선불** · **착불** (필수 1) |
| Step 4 · Dialog | 사용자 선택(선불/착불) + **고정 「월정산」** (회사 정산 — Step3 선택과 별개) |

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **Page/Feature** | wizard UI · schemas · step components · summary · Dialog |
| 2 | **Hook** | `useFormStepper` **`goToStep`** 확장 |
| 3 | **Message** | `formatQuickRequestKakaoMessage` 확장(물품·차량·경유·일시·특이·결제·월정산) |
| 4 | **API** | `notify` body Zod **확장** · 응답仍 **501** |
| 5 | **E2E** | `e2e/quick-request/` — stepper·경유·결제·jump·Dialog |

### Out of Scope (82 상속)

| 항목 | 비고 |
|------|------|
| **DB 저장** · 요청 내역 | 2차 |
| **실카톡/오픈채팅 API** | Phase 2 별도 plan `[TBD]` |
| **자주 쓰는 주소 · 연락처 칩** | 명시 Out |
| **`/dashboard/quick`** · nav 2항목 | Out |
| **activity_logs** | Out |
| **DELETE** · AlertModal | 해당 없음 |
| sans-quick **픽셀 복제** | WakeOne DS |

### Phase 2 — 실카톡 API (`[TBD]`)

| # | 내용 |
|---|------|
| P2-1 | 운영 **카카오/오픈채팅 API** 스펙 제공 |
| P2-2 | notify **2xx** 프록시 · `redirectUrl` |
| P2-3 | FE 2xx + redirect · 실패 시 **복사 fallback 유지** |
| P2-4 | (선택) 이력 DB · activity log — **별도 plan** |

---

## UI 요구사항

| 항목 | 규칙 |
|------|------|
| 컴포넌트 | `useAppForm` + `useFormFields` · `Icons.*` only · `cn()` |
| 로딩 | `PageLoadingSpinner` (plan 26) |
| 미리보기 | shadcn Dialog · `font-mono text-xs` 권장 |
| Presence | plan 49 — layout 상속 only |

---

## API / DB 요구사항

### DB

- **변경 없음**

### `POST /api/quick-request/notify` (placeholder · 501)

| 항목 | 내용 |
|------|------|
| Auth | `requireSession` · **active** only |
| Body (개요) | `itemDescription`, `vehicleTypes[]`, `vehicleCount`, `vehicleOtherText?`, `origin`(+ schedule, `originNoteIds[]`, `pickupMemo?`), **`stopovers[]`**, `destination`(+ schedule, `destNoteIds[]`, `extraMemo?`), `freightPayment: 'prepaid' \| 'collect'`, `requestedAtIso`, `requesterName` — Zod |
| Response | **501** `{ success: false, message: '카톡 API 연동 후 자동 전송됩니다.' }` (82 정합) |
| Headers | `x-request-id` |
| Activity log | **Out** |

### FE service layer

```
src/features/quick-request/api/
  types.ts
  service.ts
  mutations.ts    → onSettled (invalidate no-op OK)
```

---

## 활동 감사 로그

**activity log 해당 없음** — Read·클라이언트 폼·placeholder **501** · `recordActivityLog` **호출 금지**. 실전송 2xx 전환 시 **신규 plan** + plan 08.

---

## 영향 파일 & 패턴 (예상)

| 팀 | 경로 |
|----|------|
| FE | `src/hooks/use-stepper.tsx`, `src/features/quick-request/**`, `src/app/dashboard/quick/request/*` |
| BE | `src/app/api/quick-request/notify/route.ts` |
| verifier | `e2e/quick-request/*.spec.ts` |

**패턴:** `multi-step-product-form.tsx` · 82 Daum/Dialog/mutation · plan 26·49·31

---

## 리스크 & 완화

| 수준 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 82 E2E 셀렉터 전면 교체 | role/testId stepper 기준 재작성 · AC-31 |
| HIGH | notify Zod ↔ FE payload drift | types 공유 · AC-28 |
| MED | 무제한 경유 DOM 성능 | scroll · E2E는 3 add/1 remove 대표 |
| MED | `goToStep` 미구현 | AC-21 jump 필수 |
| LOW | heading emoji E2E | `getByRole('heading', { name: /퀵 배송 요청/ })` |

---

## 팀별 구현 순서 (권장)

1. **designer** — 4단계 IA · stepper · 카드 grid · summary·월정산 · mobile CTA
2. **backend-dev** — notify schema 확장 ·仍501
3. **frontend-dev** — wizard · stopovers · message · Dialog flow
4. **verifier** — AC-01~32 · build · activity grep · `e2e:cleanup`

---

## 검증 체크리스트 (verifier)

- [ ] `bunx playwright test e2e/quick-request`
- [ ] AC-28 API (Route test or Playwright request)
- [ ] `recordActivityLog` grep 0
- [ ] `npm run build` · `npm run e2e:cleanup` exit 0

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-20 | 최초 작성 · Approved · 82 UI supersede · 참조 이미지 4단계 wizard | planner |
| 2026-10-20 | UI·AC → [86](./86_quick-request-kakao-redesign-plan.md) supersede (카카오 스타일 단일 화면 · wizard 폐기) | planner |
