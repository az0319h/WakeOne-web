# Users 프로필 모달 기획서

> Date: 2026-06-05  
> Status: Completed  
> Author: planner  
> **선행 plan 참조:** [03](./03_user-lifecycle-profile-plan.md), [04](./04_user-reactivate-plan.md), [05](./05_profile-completion-plan.md) (Completed)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **05** | `avatar_url`·조직 필드·`User` 타입·`GET /api/users` select 확장 **완료** · 목록 소속·부서 **텍스트 컬럼 Out**(AC #11) 유지 |
| **04** | Users mutation `onSettled` invalidate · 재활성화 UI |
| **03** | inactive 수정 불가 · 본인 행 비활성화 숨김 · admin RBAC |

**본 plan:** 05 후속 — 목록에 **아바타 이미지 컬럼만** 추가, 클릭 시 **read-only 대형 Dialog** 조회. 수정은 기존 `UserFormSheet` 유지.

---

## 한 줄 요약

admin Users 테이블에 **아바타 컬럼**을 추가하고, 아바타 클릭 시 plan 05 프로필 필드를 **대형 Dialog**로 read-only 조회하며, **active user**에 한해 푸터 **「조직 정보 수정」**으로 기존 `UserFormSheet`에 진입한다.

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **테이블 컬럼 순서** | **아바타 → 이름 → 연락처** → 시스템 역할 · 초대 상태 · 계정 상태 · 액션 (기존 유지) |
| **아바타 컬럼** | `Avatar` + `AvatarImage` + 이니셜 Fallback · 클릭 가능(`button` 또는 `role="button"`) |
| **모달 트리거** | **아바타 클릭만** (이름·연락처 셀 클릭은 모달 X) |
| **모달 컨테이너** | shadcn **Dialog** · `max-w-4xl`~`5xl` · `max-h-[90vh]` · 내부 `overflow-y-auto` |
| **모달 모드** | **read-only 조회** (입력 필드·PATCH 없음) |
| **모달 레이아웃** | 참조 이미지는 힌트만 — gradient 배너·큰 아바타·이름·서브(직책·소속) 헤더 + 2컬럼 정보(인사·조직 / 사이드 요약: 역할·상태 배지). **탭 없음** (정보 단일 뷰) |
| **표시 필드** | `avatar_url`, 이름, `email`, `phone`, `affiliation`, `department`, `rank`, `job_title`, `food_restrictions`, `system_role`, `status`, `invite_status` |
| **미설정 표시** | plan 05와 동일 **「미설정」** muted |
| **수정 진입** | 모달 푸터 **「조직 정보 수정」** → 기존 `UserFormSheet` 오픈 (**active user만**) |
| **가드** | `status=inactive` → 수정 버튼 **숨김** (plan 03) · admin **본인 행** → 수정 버튼 **숨김** (plan 03, `cell-action`과 동일 `isSelf` 판별) |
| **Dialog + Sheet** | 수정 Sheet 오픈 시 프로필 Dialog **유지**(스택). Sheet 닫기 후 Dialog는 사용자가 닫을 때까지 유지 |
| **데이터 소스** | 테이블 row `User` 객체 (추가 API 호출 없음) |
| **BE** | **변경 없음** — `GET /api/users`가 이미 전 필드 반환 |

### plan 05와의 관계

- **05 AC #11** 「소속·부서 **텍스트 컬럼** 없음」— **유지**. 아바타 이미지 컬럼은 **신규 In**.
- 05 Out 항목(성장 탭·생일·닉네임·이미지 업로드·목록 텍스트 컬럼) — **본 plan에서도 Out**.

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, `/dashboard/users` | 테이블 헤더·첫 데이터 열 확인 | 컬럼 순서 **아바타 · 이름 · 연락처** (소속·부서 **텍스트 컬럼 없음**) |
| 2 | Playwright | user B, `avatar_url` 설정됨 | B 행 **아바타** 클릭 | 대형 Dialog 오픈 · **이미지** 표시 · Fallback 아님 |
| 3 | Playwright | user C, `avatar_url` null | C 행 아바타 클릭 | Dialog 오픈 · **이니셜 Fallback** 아바타 |
| 4 | Playwright | user B, 소속 `wake`·부서 `마케팅팀`·직급 `대리`·직책 설정 | Dialog 정보 영역 확인 | 「웨이크」「마케팅팀」「대리」등 **read-only** · 입력 필드 없음 · 미설정 필드는 「미설정」 |
| 5 | Playwright | user B | Dialog 본문 | **이름·이메일·연락처·못 먹는 음식** 표시 · **시스템 역할·계정 상태·초대 상태** 배지(또는 동등 라벨) |
| 6 | Playwright | **active** user B (본인·타인 무관, inactive 아님, **본인 행 제외**) | Dialog 푸터 | **「조직 정보 수정」** 버튼 표시 |
| 7 | Playwright | AC #6 조건에서 「조직 정보 수정」 클릭 | — | 기존 **UserFormSheet** 오픈 · Dialog **유지** · Sheet에 cascade 조직 필드·아바타 URL·시스템 역할 |
| 8 | Playwright | `status=inactive` user **또는** admin **본인 행** | Dialog 푸터 | **「조직 정보 수정」 없음** |
| 9 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

> RBAC(non-admin `/dashboard/users` 차단)은 plan 01·기존 구현으로 verifier **회귀 확인**만 수행 (별도 AC 번호 없음).

---

## 범위 (In / Out)

### In Scope (구현 순서: **designer → FE** · BE 생략)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | FE — 테이블 | `columns.tsx` 아바타 컬럼 추가·순서 재배치 (이름 셀에서 이메일 sub 유지 가능) |
| B | FE — 모달 | `user-profile-modal.tsx` (신규) — Dialog read-only 레이아웃 |
| C | FE — 연동 | 아바타 클릭 state · active/self/inactive 가드 · `UserFormSheet` 트리거 |
| D | FE — 재사용 | `profile-page-content`의 Avatar·ReadOnlyField·`getAffiliationLabel` 패턴 (extract 또는 import) |
| E | 검증 | Playwright AC #1~#8 · tsc · lint · build (AC #9) |

### Out of Scope

| 항목 | 비고 |
|------|------|
| **backend-dev** | `GET /api/users` 필드 충분 · SQL·신규 Route **없음** |
| 성장 탭·탭 UI 전반 | 참조 이미지 Out |
| 생일·닉네임·plan 05 외 직무 필드 | DB·스키마 없음 |
| 목록 소속·부서 **텍스트** 컬럼 | plan 05 Out 유지 |
| 모달 내 인라인 편집 | Sheet만 |
| 이름·연락처·음식 대리 수정 | plan 05 Out 유지 |
| `GET /api/users/[id]` detail API | row 데이터로 충분 |
| 이미지 업로드·Storage | plan 05 Out |
| 참조 이미지 픽셀 단위 복제 | WakeOne 톤·shadcn 토큰으로 재해석 |

---

## UI 요구사항

### Users 테이블 — 아바타 컬럼

- 위치: **첫 번째 데이터 컬럼** (이름 앞)
- 크기: 테이블 행에 맞는 compact Avatar (예: `h-9 w-9` 또는 `h-10 w-10`)
- 클릭: 포인터 커서 · 키보드 접근(`button`)
- `onError` → 이니셜 Fallback (plan 05·`profile-page-content` 동일)

### 프로필 조회 Dialog

**크기:** `DialogContent`에 `className` override — `sm:max-w-4xl` 또는 `sm:max-w-5xl`, `max-h-[90vh] overflow-y-auto` (`src/components/ui/dialog.tsx` **직접 수정 금지**)

**헤더 영역 (참조 힌트):**

- 상단 gradient 배너 (테마 토큰 기반, 과도한 커스텀 색 금지)
- 배너 하단 오버랩 **큰 Avatar** (`h-20`~`h-24`급)
- 이름 (`first_name` + `last_name`)
- 서브라인: `job_title` · `getAffiliationLabel(affiliation)` (미설정 시 생략 또는 「미설정」)

**본문 2컬럼 (md+):**

| 좌 (인사·기본) | 우 (사이드 요약) |
|----------------|------------------|
| 이메일, 연락처 | 시스템 역할 Badge |
| 소속, 부서, 직급, 직책 | 계정 상태 Badge (활성/비활성) |
| 못 먹는 음식 | 초대 상태 Badge |

**푸터:**

- `active` && !`isSelf` → `Button` 「조직 정보 수정」
- 그 외 → 푸터 버튼 없음 (Dialog 기본 닫기만)

---

## API / DB 요구사항

### BE — **생략 (변경 없음)**

`GET /api/users` (admin)가 이미 아래 필드를 select·매핑함:

`avatar_url`, `affiliation`, `department`, `rank`, `job_title`, `food_restrictions`, `status`, `system_role`, `password_set_at`(→ `invite_status`)

- 신규 SQL: **없음**
- 신규 Route Handler: **없음**
- `PUT /api/users/[id]` · `UserFormSheet` — plan 05·04 그대로

---

## 영향 파일

| 경로 | 작업 |
|------|------|
| `src/features/users/components/users-table/columns.tsx` | 아바타 컬럼·순서 |
| `src/features/users/components/user-profile-modal.tsx` | **신규** — Dialog read-only |
| `src/features/users/components/users-table/index.tsx` 또는 columns | 모달 open state·user 전달 |
| `src/features/auth/components/profile-page-content.tsx` | read-only 블록 **공유 extract** (선택) |
| `src/features/users/components/user-form-sheet.tsx` | 변경 최소 — 모달에서 `open` 트리거만 |
| `src/features/users/components/users-table/cell-action.tsx` | 참고 — `isSelf`·`isInactive` 가드 로직 재사용 |

**변경 없음:**

- `src/app/api/users/route.ts` · `service.server.ts`
- `supabase/sql/*`

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | HIGH — 아바타 클릭과 행/정렬 이벤트 충돌 | `button` + `stopPropagation` · AC #2 명시 |
| 2 | MED — Dialog+Sheet 포커스·z-index | Radix 기본 스택 · Sheet 닫기 후 Dialog 포커스 복귀 |
| 3 | MED — 테이블 row 데이터 stale | 수정 Sheet `onSettled` invalidate 후 Dialog 필드는 **다음 오픈** 시 갱신 (동일 세션 내 Sheet 저장 후 Dialog 수동 닫기·재오픈으로 반영 — [TBD: Sheet 저장 성공 시 Dialog user props 동기화는 FE 구현 선택]) |
| 4 | LOW — 05 plan 「columns 변경 없음」 문구 | 06에서 아바타만 In · 05와 독립 Completed 유지 |

---

## 열린 질문

| ID | 항목 | 결정 |
|----|------|------|
| Q1 | 모달 컨테이너 | **Dialog** (`max-w-4xl`~`5xl`) |
| Q2 | 수정 진입 | **active && !isSelf** 만 「조직 정보 수정」 |
| Q3 | Sheet 저장 후 Dialog 동기화 | FE: invalidate 후 **모달 user state를 목록 캐시에서 갱신** 권장 (구현 시) |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-05 | 최초 작성 (Approved) — plan 05 후속, 아바타 컬럼·대형 Dialog·active 수정 진입 | planner |
