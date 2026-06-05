# 사용자 재활성화 & Users Mutation 정비 기획서

> Date: 2026-06-05  
> Status: Completed  
> Author: planner  
> **선행:** [03_user-lifecycle-profile-plan.md](./03_user-lifecycle-profile-plan.md) (비활성화·Realtime·초대 중복 — **Completed**)  
> **컨벤션:** `core-conventions.mdc` § Mutation & 캐시 동기화, `.cursor/agents/frontend-dev.md`

## 한 줄 요약

admin Users에서 **비활성 사용자를 재활성화**할 수 있는 API·UI를 추가하고, Users feature의 React Query **뮤테이션·캐시 갱신을 `onSettled` 패턴으로 정비**해 저장·비활성화·활성화 후 목록이 새로고침 없이 즉시 반영되게 한다.

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, `status=inactive` user A | A 행 액션 → **활성화** 확인 | 성공 토스트 · 목록에서 **「비활성」** 배지 제거 · 액션 메뉴에 **수정·비활성화** 다시 표시 |
| 2 | Playwright | A 재활성화 직후 | A로 `/auth/sign-in` 로그인 | **성공** · 대시보드 진입 (「비활성화된 계정」 토스트 없음) |
| 3 | Playwright | admin, 활성 user B | B **비활성화** 후 즉시 목록 | B에 **비활성** 배지 · **새로고침 없이** 반영 (mutation invalidate) |
| 4 | Playwright | admin, 활성 user B | B **수정** Sheet 저장 후 | 목록/Sheet 반영 · **새로고침 없이** 반영 |
| 5 | API | inactive user | `PATCH` 재활성화 | `profiles.status=active`, `deactivated_at=null`, Auth **ban 해제** (`ban_duration: none`) |
| 6 | API | active user | `PATCH` 재활성화 | **400** 「이미 활성화된 사용자입니다」 |
| 7 | API | admin 본인 | 본인 `PATCH` 재활성화 | [TBD: 필요 시 400 — 본인은 inactive UI 없음으로 방어] |
| 8 | CLI | — | `npx tsc --noEmit` | 통과 |
| 9 | CLI | — | `npm run lint:strict` | 통과 |
| 10 | CLI | — | `npm run build` | 통과 |

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | BE — 재활성화 API | `PATCH /api/users/[id]` (`action: 'reactivate'`) · `adminUnbanUser` · profile `active` |
| B | FE — Users UI | inactive 행에 **「활성화」** 메뉴 · 확인 모달 · `reactivateUser` service + `reactivateUserMutation` |
| C | FE — Mutation 정비 | `users/api/mutations.ts` 전체 **`onSettled` → invalidateQueries(userKeys.all)** · 컴포넌트 `onSuccess`는 UI만 |
| D | 검증 | Playwright AC #1~#4 · tsc · lint · build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 비활성 상태에서 **프로필 필드 수정** | 재활성화 **후** 기존 수정 Sheet 사용 (plan 03 유지) |
| 재활성화 시 **임시 비밀번호 재발급** | 별도 plan |
| `products` feature mutation 정비 | Users만 (동일 패턴은 추후) |
| Realtime으로 재활성화 알림 | 로그인 차단 해제만; 세션 강제 생성 없음 |
| 초대 플로우 변경 | inactive 이메일은 계속 초대 400 — **재활성화가 정식 경로** |

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **재활성화 권한** | `requireAdminSession` (plan 03과 동일) |
| **Auth** | `auth.admin.updateUserById(id, { ban_duration: 'none' })` — plan 03 ban 역연산 |
| **DB** | `status='active'`, `deactivated_at=null` (SQL 마이그레이션 **불필요** — plan 03 `05`에 컬럼 존재) |
| **세션** | 재활성화 시 **기존 세션 복구·강제 로그인 없음** — 사용자가 직접 sign-in |
| **본인 행** | inactive인 admin 본인 케이스는 드묾; UI는 plan 03과 같이 self 비활성화 숨김 유지 |
| **이메일 중복** | 재활성화 후에도 `lower(email)` unique 유지 — **새 초대 대신 재활성화** 안내(토스트 문구 optional) |
| **Mutation 규칙** | `mutations.ts`의 **`onSettled`만** invalidate · `user-form-sheet` / `cell-action`에서 `onSuccess` 덮어쓰기해도 캐시 유지 |

---

## A) API — 재활성화

### `PATCH /api/users/[id]`

**Request body (Zod):**

```ts
{ action: z.literal('reactivate') }
```

**처리 순서:**

1. `requireAdminSession`
2. 대상 `profiles` 조회 — 없으면 404
3. `status === 'active'` → 400 「이미 활성화된 사용자입니다」
4. `profiles.update({ status: 'active', deactivated_at: null })`
5. `adminUnbanUser(userId)` (`src/lib/auth/admin-auth.ts` 신규 함수)
6. 200 `{ success: true, message: '사용자가 활성화되었습니다.' }`

**금지:** 재활성화 시 `deleteUser`·`signOut(global)` 호출하지 않음.

### 영향 파일 (BE)

| 파일 | 변경 |
|------|------|
| `src/app/api/users/[id]/route.ts` | `PATCH` 핸들러 추가 |
| `src/lib/auth/admin-auth.ts` | `adminUnbanUser` 추가 |
| `src/features/users/api/service.ts` | `reactivateUser(id)` |
| `src/features/users/api/types.ts` | 필요 시 응답 타입 |

---

## B) FE — Users UI

### `cell-action.tsx`

| `status` | 메뉴 |
|----------|------|
| `active` | 기존: 수정 · 비활성화 (본인 행은 비활성화 숨김) |
| `inactive` | **활성화**만 (수정·비활성화 숨김 — plan 03 유지) |

- **활성화** → `AlertModal` 확인 → `reactivateMutation.mutate(id)`
- 문구 예: 「계정이 다시 활성화됩니다. 사용자는 이전 비밀번호로 로그인할 수 있습니다.」

### `mutations.ts` (신규·정비)

```ts
export const reactivateUserMutation = mutationOptions({
  mutationFn: (id: string) => reactivateUser(id),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});
```

**기존 3종** (`invite` / `update` / `delete`)도 `onSuccess` invalidate → **`onSettled`로 이전**.

### 영향 파일 (FE)

| 파일 | 변경 |
|------|------|
| `src/features/users/api/mutations.ts` | `reactivateUserMutation` + `onSettled` 일괄 |
| `src/features/users/api/service.ts` | `reactivateUser` |
| `src/features/users/components/users-table/cell-action.tsx` | 활성화 UI + mutation |
| `src/features/users/components/user-form-sheet.tsx` | `onSuccess` UI만 (invalidate는 `onSettled`에 의존) |

---

## C) Mutation 정비 (필수 — 본 plan FE 완료 조건)

| 체크 | 내용 |
|------|------|
| C1 | `inviteUserMutation` / `updateUserMutation` / `deleteUserMutation` / `reactivateUserMutation` 모두 **`onSettled` invalidate** |
| C2 | 컴포넌트 `useMutation({ ...xxxMutation, onSuccess: () => notify... })` — **invalidate 코드 없음** |
| C3 | 제출·확인 시 `mutate` / `mutateAsync` 즉시 호출 유지 |
| C4 | 수동 검증: 비활성화·활성화·수정·초대 후 Users 테이블 **F5 없이** 갱신 |

---

## 영향 파일 & 패턴 (정찰)

```
src/features/users/
  api/service.ts, mutations.ts, queries.ts, types.ts
  components/users-table/cell-action.tsx, user-form-sheet.tsx
src/app/api/users/[id]/route.ts
src/lib/auth/admin-auth.ts
```

**따라야 할 패턴:** plan 03 `DELETE` 비활성화 대칭 · `core-conventions.mdc` Mutation § · `frontend-dev.md` 체크리스트

**의존성:**

- 로그인: `service.ts` `profileStatusByEmail` / `profiles.status` — active면 로그인 허용
- middleware: inactive만 차단 — 재활성화 후 해제
- 초대: inactive 이메일은 여전히 「이미 등록된 이메일」→ 운영은 **활성화** 사용

---

## UI 요구사항

- inactive 행: Badge 「비활성」 유지 (plan 03)
- 액션: `Icons`만 사용 · 확인 모달은 기존 `AlertModal` 재사용
- 성공 토스트: 「사용자가 활성화되었습니다.」
- [TBD] 목록 상단 안내 문구(「비활성 계정은 활성화 메뉴를 사용」) — **Out** unless requested

---

## API / DB 요구사항

- **SQL:** 신규 없음 (plan 03 `05_profiles_status_lifecycle.sql` 적용 전제)
- **Env:** `SUPABASE_SERVICE_ROLE_KEY` (기존과 동일)

---

## 리스크 & 완화책

| # | 수준 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | MED | `onSettled` 이전 후에도 컴포넌트가 `onSuccess`에서만 처리해 실패 UI 누락 | AC #3·#4 Playwright · mutation 정비 체크리스트 C1~C4 |
| 2 | LOW | ban 해제 실패 시 DB만 active | PATCH 트랜잭션 순서: profile update 후 ban 해제, 실패 시 500·롤백 [TBD: 단일 try/catch 메시지] |
| 3 | LOW | 재활성화 직후 동시 로그인 레이스 | 허용 — plan 03과 동일 |

---

## 열린 질문

| ID | 질문 | 기본안 |
|----|------|--------|
| Q1 | 재활성화 API를 `PATCH { action }` vs `POST .../reactivate` | **`PATCH { action: 'reactivate' }`** (단일 route 파일) |
| Q2 | 활성화 확인 모달에 비밀번호 안내 문구 노출 여부 | **In** — 「이전 비밀번호로 로그인 가능」 한 줄 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-05 | 최초 작성 (Draft) | planner |
| 2026-06-05 | 구현 완료 — PATCH 재활성화, Users mutation onSettled, 활성화 UI | frontend-dev / backend-dev |
