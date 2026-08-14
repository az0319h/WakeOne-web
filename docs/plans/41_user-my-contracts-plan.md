# 일반 사용자 내 계약서 조회 기획서

> Date: 2026-08-14
> Status: Approved
> Author: planner
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [16](./16_contract-management-plan.md), [18](./18_contract-approved-at-plan.md), [19](./19_user-single-name-plan.md), [33](./33_contract-bulk-download-plan.md), [38](./38_contract-attachment-size-limit-plan.md), [40](./40_filter-shell-loading-ux-plan.md)

## 한 줄 요약

`system_role=user` 중 `profiles.full_name`과 계약 `author_name`이 **이름 매칭**(`normalizePersonName`)되는 경우, `/dashboard/my-contracts`에서 **본인 작성분만 READ-only**로 조회하고 첨부파일을 **다운로드·열기**(inline 새 탭)할 수 있다. admin `/dashboard/contracts`·CUD·bulk ZIP은 기존과 동일하게 **admin-only**를 유지한다.

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **07** | dashboard/page·`/api/*` defense in depth — nav 숨김은 UX, **서버 가드 필수** |
| **08** | 본 plan은 READ-only → **activity log 해당 없음** |
| **16** | 계약서 관리 **기반 feature**. AC-02/03(admin-only) **유지**. user read는 **별도 URL/API**로 확장 |
| **18** | 목록 날짜 필터·정렬·컬럼 = **문서승인일(`approved_at`)** — user 화면도 **동일** |
| **19** | 매칭 키 = `profiles.full_name` |
| **33** | bulk ZIP **admin-only** — user **403 유지** |
| **38** | 첨부 용량·다운로드 대상 파일 정책 동일 |
| **40** | listing filter shell Suspense 밖 · data body `PageLoadingSpinner variant="fill"` |

**중복 금지:** admin `/api/contracts*` mutation·Import·reminder Route 변경 없음. user CUD Route **신규 추가 금지**.

---

## 목표 & 완료 기준

### 목표

- 일반 사용자가 **자신의 이름으로 작성된** 계약서 체결 요청 문서만 목록·상세에서 **읽기 전용**으로 확인한다.
- admin과 **동일 필터**(문서승인일 범위·검색·첨부 상태·pagination·정렬)를 적용하되, 데이터는 **매칭 author_name 행만** 반환한다.
- 활성 첨부파일 **다운로드** 및 PDF/이미지 **열기**(inline 새 탭)를 허용한다.
- 매칭 계약이 **1건 이상**인 user에게만 nav 「내 계약서」를 노출한다.
- plan 16 admin 계약서 관리·plan 33 bulk ZIP은 **회귀 없이** admin-only를 유지한다.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | `system_role=user`, `normalizePersonName(full_name)`과 `normalizePersonName(author_name)`이 일치하는 active 계약 ≥1 | dashboard sidebar 확인 | **「내 계약서」** nav 항목이 보인다 |
| AC-02 | Playwright | AC-01 user | `/dashboard/my-contracts` 이동 | 페이지 제목 **「내 계약서」**, 설명 **「본인 이름으로 작성된 계약서 체결 요청 문서를 확인합니다.」**, 문서승인일 범위 필터·검색·pagination 테이블이 보인다 |
| AC-03 | Playwright | 매칭 계약 A·비매칭 계약 B가 DB에 coexist | AC-01 user가 목록 조회 | **A만** 표시되고 B는 목록에 없다 |
| AC-04 | Playwright | 서로 다른 `approved_at`을 가진 매칭 계약 다수 | 문서승인일 범위 캘린더에서 기간 선택 | plan 18과 동일 기준으로 **선택한 승인일 범위에 포함되는 매칭 행만** 표시된다 |
| AC-05 | Playwright | AC-01 user | 목록 actions·toolbar·상세 Sheet 확인 | **수정·삭제·업로드·첨부 ZIP·「첨부파일 없음」 지정** UI가 **없다** |
| AC-06 | Playwright | 본인 매칭 계약 상세, 활성 첨부 1개 이상 | 「다운로드」 클릭 | **원 파일명**으로 파일이 저장된다 |
| AC-07 | Playwright | PDF 또는 이미지 활성 첨부 | 「열기」 클릭 | **새 탭**에서 inline 미리보기가 열린다 (admin `openContractAttachment`와 동일) |
| AC-08 | API | user 세션, 본인과 **매칭되지 않는** 계약 id | `GET /api/my-contracts/[id]` | HTTP **403**, `{ success: false, message: … }` 형태 응답 |
| AC-09 | API | user 세션 | `PATCH/DELETE /api/contracts/[id]`, `POST …/attachments`, `PATCH …/no-attachment`, `GET …/bulk-download` | HTTP **403** (plan 16·33 admin-only **유지**) |
| AC-10 | Playwright | `system_role=user`, 이름 매칭 active 계약 **0건** | dashboard sidebar 확인 | **「내 계약서」** nav 항목이 **보이지 않는다** |
| AC-11 | Playwright | AC-10 user | `/dashboard/my-contracts` 직접 접근 | `/dashboard/overview`로 이동하고 내 계약서 UI는 렌더되지 않는다 |
| AC-12 | Playwright/API | active user X·Y가 **동일 `full_name`**, 해당 이름의 `author_name` 계약 존재 | X·Y 각각 `GET /api/my-contracts` | **동일한 계약 집합**이 반환된다 (동명이인 정책 **a**) |
| AC-13 | Playwright | admin 로그인 | `/dashboard/contracts` 이동 | plan 16 AC-01 수준 — **「계약서 관리」**·전체 목록·admin CUD/bulk UI **회귀 없음** |
| AC-14 | Playwright | `system_role=user` | `/dashboard/contracts` 직접 접근 | plan 16 AC-02 **유지** — `/dashboard/overview` redirect, 「계약서 관리」 미표시 |

---

## 범위 (In / Out)

### In Scope

- **Page:** `/dashboard/my-contracts` + `loading.tsx`
- **Nav:** Account 그룹 **「내 계약서」** — 매칭 active 계약 **≥1건**일 때만 노출 (kbar 포함)
- **READ API (user 전용):**
  - `GET /api/my-contracts` — 목록·필터·pagination
  - `GET /api/my-contracts/[id]` — 상세
  - `GET /api/my-contracts/[id]/attachments/[attachmentId]/download` — 다운로드·inline 열기
- **매칭 규칙:** `normalizePersonName(profiles.full_name) === normalizePersonName(author_name)` — plan 16 독촉·`service.server.ts`와 **동일** (trim → 연속 공백 1칸 → lowercase)
- **동명이인:** 동일 `full_name`을 가진 active user **복수** → **모두 동일 `author_name` 계약 열람 허용** (정책 **a**)
- **UI:** admin listing과 **동일 필터 shell** (plan 40) · read-only table·detail Sheet
- **첨부:** admin과 동일 download + inline 새 탭 (`canOpenContractAttachment` 기준)

### Out Scope

- user **CUD** (수정·soft delete·첨부 업로드/삭제·no-attachment 지정·reminder)
- **bulk ZIP** (plan 33 — admin-only)
- **`author_user_id`** import 시 자동 연결 · legacy **backfill** (**1차 Out 확정**)
- activity log 신규 action (READ-only)
- OpenClaw Import·admin mutation Route 변경
- 첨부 미리보기 Sheet/뷰어 (plan 16 Out — 열기=새 탭만)
- CSV/Excel export
- admin `/dashboard/contracts` URL·RBAC 변경

### author_user_id · backfill (1차 확정)

| 항목 | 1차 정책 |
|------|----------|
| DB | `contract_documents.author_user_id` 컬럼 존재하나 **대부분 null** |
| 접근 판단 | **`author_name` ↔ `profiles.full_name` 이름 매칭만** |
| import 시 user id 연결 | **Out** |
| 과거 데이터 backfill | **Out (1차 확정, 열린 질문 없음)** |

---

## 권한 / RBAC

| 대상 | admin | user (매칭 ≥1) | user (매칭 0) |
|------|-------|----------------|---------------|
| nav 「계약서 관리」 | ✅ | ❌ | ❌ |
| nav 「내 계약서」 | ❌ | ✅ | ❌ |
| `/dashboard/contracts` | ✅ | redirect overview | redirect overview |
| `/dashboard/my-contracts` | redirect overview | ✅ | redirect overview |
| `GET /api/contracts*` | ✅ | **403** | **403** |
| `GET /api/my-contracts*` | **403** | ✅ (scope 내) | **403** |
| contract mutation·bulk | ✅ | **403** | **403** |

- nav 숨김은 UX일 뿐 — **page·API 서버 가드 필수** (plan 07).
- 상세·download Route는 목록과 **별도로 author scope 재검증** (IDOR 방지).

---

## API / Service Layer

### Feature 구조 (추가·분리)

```txt
src/features/contracts/api/
  types.ts                    — MyContractFilters 등 (기존 ContractFilters 재사용 가능)
  service.server.ts           — countMyContracts, listMyContracts, getMyContractById, assertMyContractAccess
  queries.ts                  — myContractKeys, myContractsQueryOptions
  service.ts                  — listMyContracts, getMyContractById, download/open (my-contracts 경로)

src/lib/normalize-person-name.ts  — normalizePersonName 공유 (독촉·my-contracts)

src/app/api/my-contracts/
  route.ts
  [id]/route.ts
  [id]/attachments/[attachmentId]/download/route.ts
```

### user READ API

| Method | Path | Guard | Log |
|--------|------|-------|-----|
| GET | `/api/my-contracts` | `requireSession` + `system_role=user` + author scope filter | READ **Out** |
| GET | `/api/my-contracts/[id]` | 동일 + id ownership | READ **Out** |
| GET | `/api/my-contracts/[id]/attachments/[attachmentId]/download` | 동일 + attachment ownership | READ **Out** |

### 목록 query (admin과 동일 param)

| Query | 설명 |
|-------|------|
| `page`, `limit` | pagination |
| `from`, `to` | **문서승인일(`approved_at`)** 범위 (plan 18) |
| `search` | 문서번호·작성자·계약대상 |
| `attachment_status` | `missing` / `has_attachment` / `no_attachment_required` / `soft_deleted` |
| `sort` | 기본 `approved_at.desc` |

### 서버 필터 (author scope)

- 세션 `profiles.full_name` → `normalizePersonName` → DB `author_name` 정규화 표현과 **equality** 필터.
- admin Route(`GET /api/contracts*`)에는 author filter **적용하지 않음**.

### Nav 매칭 count

- `dashboard/layout.tsx` (RSC): user일 때만 경량 count (`≥1` boolean).
- `NavAccessProvider`에 `hasMyContracts` 플래그 전달 → `checkNavAccess` 또는 nav item custom flag.

---

## UI 요구사항

### 목록 (`/dashboard/my-contracts`)

- `PageContainer`:
  - `pageTitle="내 계약서"`
  - `pageDescription="본인 이름으로 작성된 계약서 체결 요청 문서를 확인합니다."`
- **Filter shell (plan 40):** 문서승인일·검색·첨부 상태·pagination 툴바는 Suspense **밖**.
- **Data body:** `<Suspense key={querySignature} fallback={<PageLoadingSpinner variant="fill" />}>` 안에 테이블.
- admin `ContractsTable` 패턴 재사용 — **bulk ZIP·row edit/delete·Import 안내 CTA 제외**.
- 테이블 컬럼: admin과 동일(문서승인일·문서번호·작성자·계약대상·계약 내용·금액·첨부 상태) — actions는 **상세 보기만**.

### 상세 (read-only Sheet)

- admin `ContractDetailSheet` 기반 — **수정 버튼·첨부 업로드·no-attachment·soft delete UI 제외**.
- 활성 첨부: **다운로드** + **열기**(inline 새 탭, admin과 동일).
- 날짜 표시: `@/lib/format-date` (`formatAbsoluteDateKo` 등).

### Nav

- `nav-config.ts` Account 그룹:

```typescript
{
  title: '내 계약서',
  url: '/dashboard/my-contracts',
  icon: 'forms', // 구현 시 기존 contracts와 구분 가능하면 대체
  access: { hasMyContracts: true } // NavAccessProvider 플래그 연동
}
```

- admin은 **「내 계약서」 미노출**.

### 로딩

- route `loading.tsx`: `PageLoadingSpinner variant="default"`.
- Sheet Read: `PageLoadingSpinner variant="compact"`.

---

## 활동 감사 로그

**activity log 해당 없음** — 본 plan은 READ-only(목록·상세·첨부 download/open). plan 08·plan 16 AC-13과 동일하게 GET/download는 **기록하지 않음**. user CUD Route **없음**.

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/lib/normalize-person-name.ts` | 신규 — `normalizePersonName` 공유 |
| `src/features/contracts/api/service.server.ts` | my-contracts scope query · download ownership |
| `src/features/contracts/api/queries.ts`, `service.ts`, `types.ts` | my-contracts Read 경로 |
| `src/app/api/my-contracts/**` | 신규 READ Route |
| `src/app/dashboard/my-contracts/page.tsx`, `loading.tsx` | 신규 page |
| `src/features/contracts/components/my-contracts-*` 또는 variant | read-only listing/detail |
| `src/features/auth/api/session.server.ts` | `requireMyContractsPage()` |
| `src/config/nav-config.ts` | 「내 계약서」 |
| `src/contexts/nav-access.tsx`, `src/types/index.ts` | `hasMyContracts` flag |
| `src/app/dashboard/layout.tsx` | 매칭 count → nav flag |
| `e2e/contracts/my-contracts.spec.ts` | AC 01–14 |
| `e2e/contracts/rbac.spec.ts` | AC-14 회귀 유지 |

**SQL:** 1차 **migration 불필요** (service role + 서버 필터). RLS policy 추가는 **선택**(defense in depth) — 구현팀 판단.

---

## 리스크 & 완화책

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | admin API에 author filter 누락 | **별도 `/api/my-contracts*`** · admin Route 무변경 |
| 2 | IDOR — 타인 계약 id/direct download | list·detail·download **각각** scope 재검증 → 403 |
| 3 | TS/SQL normalize 불일치 | **단일 TS 함수** + Postgres 동치 expression · 단위 테스트 |
| 4 | 동명이인 데이터 공유 | plan·AC-12에 **명시** · 1차 `author_user_id` 미사용 |
| 5 | layout count 쿼리 부하 | head/count only · admin skip |
| 6 | read-only UI에 admin CTA 잔존 | explicit `mode: 'user'` variant · AC-05 grep/Playwright |

---

## 구현 순서 제안

1. `normalizePersonName` 공유 모듈 + service scope 함수
2. `GET /api/my-contracts*` Route + download ownership
3. dashboard layout nav flag + nav-config
4. `/dashboard/my-contracts` page · read-only table/detail
5. Playwright spec (AC-01–14) + admin 회귀
6. tsc · lint · build

---

## E2E spec 구조

```
e2e/contracts/
  my-contracts.spec.ts   — AC-01~12 (user happy path·RBAC·동명이인)
  rbac.spec.ts           — AC-14 유지 + 필요 시 보강
```

- 셀렉터: `getByRole` · `getByPlaceholder` · `getByTestId` only.
- 인증: `storageState` 재사용.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-14 | 최초 작성 · `/root` planner Phase 3+4 · Status Approved | planner |
