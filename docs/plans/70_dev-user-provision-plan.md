# dev 전용 사용자 사전 등록 (Google pre-provision) 기획서

> Date: 2026-10-06
> Status: Approved
> Author: planner
> **SQL:** 구현 단계에서 `supabase/sql/` 최대 번호 확인 후 신규 migration (OAuth active status 보호)
> **선행:** [17](./17_user-management-add-flow-plan.md), [57](./57_google-auth-approval-migration-plan.md), [58](./58_approval-birthday-optional-user-add-removal-plan.md), [08](./08_activity-audit-log-plan.md)

## 한 줄 요약

**dev 환경(`WAKEONE_ENV=development`)에서만** admin이 승인 Sheet와 **동일 폼**(`approveUserSchema` / `UserApprovalOrgFormFields`)으로 이메일·업무 프로필을 입력해 **active** 계정을 사전 등록한다. main/production은 plan 58대로 사용자 추가 UI·API **410 유지**. 사전 등록된 이메일로 Google OAuth 시 **pending 없이** dashboard 진입.

---

## deep-interview · battle-plan 확정 (2026-10-06)

| 항목 | 결정 |
|------|------|
| **활성 범위** | local + dev Supabase + Vercel **dev branch** (main/production **제외**) |
| **환경 게이트** | `WAKEONE_ENV=development` (서버) · UI 노출용 `NEXT_PUBLIC_WAKEONE_ENV=development` |
| **UI/폼** | `UserApprovalSheet`와 동일 — `approveUserSchema` + `UserApprovalOrgFormFields` (plan 17 create 폼 **사용 안 함**) |
| **Auth 생성** | `auth.admin.createUser({ email, email_confirm: true })` — password 없음, `provider=google` **미설정** |
| **생일** | optional / null 허용 (승인 Sheet와 동일 · `BirthdayField allowUnsetToggle`) |
| **사전 등록 status** | `active` |
| **충돌 pending** | 409 — 「승인 대기 중 — 목록에서 수락해 주세요」 |
| **충돌 active** | 409 — 「이미 등록된 이메일입니다」 |
| **충돌 rejected** | 409 — 「거절된 계정 — 사용자 추가 불가」 |
| **충돌 inactive** | 409 — 「비활성화된 계정 — 활성화 후 이용해 주세요」 |

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **17** | 사용자 추가 흐름 — password·plan 17 create 폼은 **복원하지 않음**. 업무 필드 개념만 참조 |
| **57** | Google OAuth 전용 · 신규 self-signup은 pending. 본 plan은 **dev admin pre-provision만** active shortcut |
| **58** | production `POST /api/users` 410 · UI 제거 — **non-dev에서 유지** |
| **08** | `user.create` activity log 전 HTTP 분기 |
| **04** | inactive → **reactivate** flow (add로 재등록 **금지**) |

---

## 목표와 완료 기준

### 목표

- dev에서 admin **「사용자 추가」** CTA + Sheet로 active 사전 등록
- production/main/dev branch 외 환경에서 UI·API **변경 없음** (410)
- pre-provision → 동일 이메일 Google OAuth → `status=active` 유지 · dashboard 진입
- `user.create` activity log · 충돌 매트릭스 · E2E dev/non-dev 분기

### 완료 기준

- `WAKEONE_ENV=development`일 때만 CTA + `POST /api/users` 201
- 그 외 환경 410 (plan 58 AC-06 유지)
- OAuth link BLOCKER: pre-provision 후 Google 로그인 시 **동일 `user_id`** · active 유지
- Playwright spec green · tsc · lint · build · `npm run e2e:cleanup` exit 0

---

## 범위 In/Out

### In Scope

| 영역 | 내용 |
|------|------|
| Env | `isDevUserProvisioningEnabled()` · `.env.example` · Vercel dev branch 가이드 |
| API | `POST /api/users` dev create / non-dev 410 |
| Auth | email-only `admin.createUser` + profile active upsert |
| SQL/RPC | active pre-provision + Google link 시 status downgrade 방지 (필요 시) |
| UI | `UserProvisionSheet` + Trigger · `users/page.tsx` `pageHeaderAction` |
| Schema | POST body = `approveUserSchema` (서버 Zod) |
| Activity log | `user.create` 전 return 분기 |
| E2E | dev 201 + conflicts · non-dev 410 · UI smoke · OAuth BLOCKER |

### Out of Scope

| 항목 | 비고 |
|------|------|
| main/production 사용자 추가 | UI 없음 · 410 |
| password·초기 PW·이메일 발송 | Out |
| rejected 재등록 via add | Out — 거절 상태 유지 |
| inactive 재등록 via add | Out — reactivate flow |
| plan 17 `createUserSchema` / legacy create Sheet | Out |
| self-service signup 정책 변경 | production Google pending 유지 |

---

## 환경 게이트

| 변수 | 용도 |
|------|------|
| `WAKEONE_ENV=development` | 서버 API create 허용 (필수) |
| `NEXT_PUBLIC_WAKEONE_ENV=development` | 클라이언트 CTA 노출 |

**활성 대상:** local · dev Supabase · Vercel **dev branch**  
**비활성:** main · production · preview(명시 없으면)

서버 게이트가 **최종 권한** — 클라이언트 CTA만 숨겨도 API는 410/403.

---

## 사용자 추가 흐름 (dev only)

1. admin이 `/dashboard/users`에서 **「사용자 추가」** 클릭 (`WAKEONE_ENV=development`일 때만 CTA 표시)
2. `UserProvisionSheet` — 승인 Sheet와 동일 필드 (`approveUserSchema`, `UserApprovalOrgFormFields`, 생일 미설정 toggle)
3. `createUserMutation` → `POST /api/users`
4. API: admin 인증 → env gate → body Zod → 이메일 충돌 매트릭스
5. `auth.admin.createUser({ email, email_confirm: true })`
6. `profiles` upsert: 업무 필드 + `status='active'`
7. `user.create` success log → 201
8. FE: toast「사용자가 추가되었습니다.」·`form.reset()`·Sheet 닫기·`onSettled` invalidate

### Google OAuth 후속 (동일 이메일)

1. 사용자 Google OAuth → Supabase email auto-link (동일 `auth.users.id` 기대)
2. `ensure_google_auth_profile` → `status=active` → `auth.sign_in` → dashboard
3. **BLOCKER:** 새 `user_id` 생성 또는 active→pending downgrade 시 main release 금지

---

## 이메일 충돌 매트릭스

| 기존 `profiles.status` | HTTP | 응답 메시지 (한국어) |
|------------------------|------|----------------------|
| (없음) | 201 | — |
| `pending_approval` | 409 | 승인 대기 중인 이메일입니다. 사용자 목록에서 수락해 주세요. |
| `active` | 409 | 이미 등록된 이메일입니다. |
| `rejected` | 409 | 거절된 계정입니다. 사용자 추가로 재등록할 수 없습니다. |
| `inactive` | 409 | 비활성화된 계정입니다. 활성화 후 이용해 주세요. |

모든 거부 분기: `user.create` failure log (`error_code`, `attempted_target`).

---

## 기록 연동 (activity log)

| Route | action | 분기 | HTTP | 기록 |
|-------|--------|------|------|------|
| `POST /api/users` | `user.create` | non-dev env | 410 | failure 1건 |
| 동일 | `user.create` | 401 unauthenticated | 401 | failure 1건 |
| 동일 | `user.create` | 403 non-admin | 403 | failure 1건 |
| 동일 | `user.create` | 400 validation | 400 | failure 1건 |
| 동일 | `user.create` | 409 conflict | 409 | failure 1건 |
| 동일 | `user.create` | success | 201 | success 1건 |
| 동일 | `user.create` | catch/internal | 500 | failure 1건 |

metadata allowlist: `error_code`, `message`, `attempted_target`, `changed_fields`, `birthday_set` (boolean). password·token **금지**.

---

## UI 요구사항

- CTA: `PageContainer` `pageHeaderAction` — 「사용자 추가」 (dev only)
- Sheet: `UserProvisionSheet` — 제목「사용자 추가」, 설명 1줄 (Google 로그인 안내)
- 필드: `UserApprovalOrgFormFields` + `BirthdayField allowUnsetToggle` (승인 Sheet와 동일)
- Sheet 모바일: `flex-col` + `SheetFooter` 스크롤 바깥 고정
- 성공: toast + `form.reset()` + invalidate
- `/dashboard/users`는 `dashboard/layout` 하위 · **`DashboardPresenceTrack` 상속** (plan 49)

---

## Acceptance Criteria (Given-When-Then)

### Env · API gate

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | `WAKEONE_ENV`가 development가 **아님** | admin이 create body로 `POST /api/users` | 410 응답 · plan 58 메시지 · `user.create` log 1건 · `x-request-id` |
| AC-02 | API | `WAKEONE_ENV=development`, admin 세션 | 유효한 `approveUserSchema` body로 `POST /api/users` | 201 · `status=active` profile · `user.create` success log |

### 충돌

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-03 | API | dev, 이메일이 `pending_approval` | `POST /api/users` | 409 · 「승인 대기 중」 메시지 · failure log |
| AC-04 | API | dev, 이메일이 `active` | `POST /api/users` | 409 · 「이미 등록된」 메시지 · failure log |
| AC-05 | API | dev, 이메일이 `rejected` | `POST /api/users` | 409 · 「거절된 계정」 메시지 · failure log |
| AC-06 | API | dev, 이메일이 `inactive` | `POST /api/users` | 409 · 「비활성화된 계정」 메시지 · failure log |

### UI · 폼

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-07 | Playwright | `NEXT_PUBLIC_WAKEONE_ENV=development`, admin | `/dashboard/users` 로드 | **「사용자 추가」** 버튼이 보인다 |
| AC-08 | Playwright | non-dev env, admin | `/dashboard/users` 로드 | **「사용자 추가」** 버튼이 **없다** |
| AC-09 | Playwright | dev, admin, 사용자 추가 Sheet | 필수 필드 비우고 제출 | 필드 오류 표시 · 제출 차단 |
| AC-10 | Playwright | dev, admin | 승인 Sheet와 동일 필드 입력 후 제출 | toast「사용자가 추가되었습니다.」·목록에 신규 행 · 새로고침 없이 갱신 |
| AC-11 | Playwright | dev, admin, Sheet 생일 필드 | **미설정** ON 상태로 제출 | `birthday IS NULL`로 저장 |

### OAuth BLOCKER

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-12 | Dev BLOCKER | dev, admin이 이메일 X로 pre-provision (active) | 동일 이메일 Google OAuth 완료 | **동일 `profiles.user_id`** · `status=active` · dashboard 진입 · pending toast **없음** |
| AC-13 | Dev BLOCKER | AC-12 실패 (새 user_id 또는 pending 전환) | — | 구현 **BLOCKER** · main release 금지 |

### Activity · layout · CLI

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-14 | API | dev, validation 실패 body | `POST /api/users` | 400 · `user.create` failure log · metadata에 password 없음 |
| AC-15 | Playwright | `/dashboard/users` | 페이지 렌더 | `dashboard/layout` 하위 · 별도 presence track **없음** |
| AC-16 | CLI | 구현 완료 | `bunx playwright test` (관련 spec) | green |
| AC-17 | CLI | 구현 완료 | tsc, lint, build | 모두 통과 |

---

## 영향 파일 (예상)

| 파일 | 변경 |
|------|------|
| `src/lib/env/wakeone-env.ts` | env helper (신규) |
| `src/app/api/users/route.ts` | dev create / non-dev 410 |
| `src/features/users/api/service.server.ts` | `createUserForAdmin` |
| `src/features/users/schemas/user.ts` | POST = approveUserSchema |
| `src/features/users/components/user-provision-sheet.tsx` | 신규 |
| `src/features/users/components/user-provision-trigger.tsx` | 신규 |
| `src/app/dashboard/users/page.tsx` | conditional header action |
| `supabase/sql/NN_*.sql` | active status 보호 (필요 시) |
| `e2e/users/dev-provision*.spec.ts` | 신규 |
| `e2e/users/add-flow.api.spec.ts` | non-dev 410 유지 |

---

## 리스크

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | Google OAuth 새 user_id | AC-12 BLOCKER · trigger/RPC status 보호 |
| HIGH | production dev create 노출 | server env hard gate · AC-01 · AC-08 |
| MED | Vercel env misconfig | dev branch만 문서화 |
| MED | Sheet drift | shared schema + OrgFormFields only |

---

## 팀 전달 요약

| 팀 | 작업 |
|----|------|
| designer | UserProvisionSheet = Approval Sheet 레이아웃 · dev-only CTA |
| backend-dev | env gate · POST create · conflict matrix · SQL status 보호 · user.create log |
| frontend-dev | ProvisionSheet/Trigger · mutations · env gate CTA |
| verifier | AC spec · dev/non-dev 분기 · OAuth BLOCKER · cleanup |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-06 | 최초 작성 (Approved) — dev-only pre-provision, approveUserSchema reuse, OAuth BLOCKER | planner |
