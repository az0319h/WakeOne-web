# 승인 시 생일 선택 · 사용자 추가 제거 기획서

> Date: 2026-10-02
> Status: Completed
> Author: planner
> **SQL:** 없음 (profiles.birthday는 이미 nullable)
> **선행:** [09](./09_profile-phone-birthday-plan.md), [17](./17_user-management-add-flow-plan.md), [57](./57_google-auth-approval-migration-plan.md)

## 한 줄 요약

Google 승인 대기 사용자 **수락** 시 생일을 **미설정(null)** 할 수 있게 하고, 생일 미설정 active 사용자는 **overview 생일 배너**에 노출하지 않는다. 관리자 **사용자 추가** UI·API는 plan 57 Google 전용 정책에 맞춰 **완전 제거**한다.

---

## deep-interview 확정 (2026-10-02)

| 항목 | 결정 |
|------|------|
| 사용자 추가 | **완전 삭제** (UI + POST create API) |
| 승인 생일 UX | 생일 폼 기본 표시 · **미설정** 클릭 시 연·월·일 Select **disable** + `birthday=null` |
| 대시보드 생일 | **overview 생일 배너만** — `birthday` null 사용자 제외 (Users 테이블 `—` 표시 유지) |

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **09** | 생일 Calendar/Select 컴포넌트 · `BirthdayField` 확장 |
| **17** | 사용자 추가 흐름 — **supersede(제거)** |
| **57** | Google OAuth 승인제 — 신규 유입은 승인만, password/add-user Out |
| **10** | overview 생일 배너 — null birthday active 사용자 Out |

---

## 목표와 완료 기준

### 목표

- 관리자 **수락** Sheet에서 생일을 선택 입력 또는 **미설정**으로 저장할 수 있다.
- **미설정** 상태에서는 참조 UI처럼 연·월·일 Select가 disabled 이다.
- `birthday`가 null인 active 사용자는 `/dashboard/overview` 생일 축하 배너·슬라이드에 **나타나지 않는다**.
- `/dashboard/users` **사용자 추가** CTA·Sheet create 모드·`POST /api/users` 생성 경로를 제거한다.

### 완료 기준

- pending 사용자 수락 시 생일 미설정으로 active 전환 가능 (API 200, DB `birthday IS NULL`).
- pending 사용자 수락 시 생일 입력 후 active 전환 가능 (기존과 동일).
- 생일 미설정 active 사용자가 overview 생일 API/배너 응답에 포함되지 않는다.
- Users 페이지에 **사용자 추가** 버튼이 없다.
- `POST /api/users`는 410(또는 동등한 Gone) 응답 — activity log 포함.
- `bunx playwright test` (관련 spec green), tsc, lint, build 통과.

---

## 범위 In/Out

### In Scope

| 영역 | 내용 |
|------|------|
| Approve schema | `approveUserSchema` 분리 — 생일 nullable·미설정 허용 |
| Approve API | `POST /api/users/[id]/approval/approve` — `birthday: null` 저장 |
| Approve UI | `UserApprovalSheet` 전용 필드 또는 `BirthdayField` `allowUnsetToggle` |
| BirthdayField | **미설정** 항상 노출 · toggle 시 Select disabled + null |
| User add removal | `UserFormSheetTrigger` 제거 · `UserFormSheet` edit-only |
| API removal | `POST /api/users` 410 + activity log |
| Birthday banner | `getBirthdayCelebrantsServer` null 제외 **회귀 AC** (이미 구현) |
| E2E | google-auth approval null birthday · add-flow UI 제거 · API 410 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| admin 사용자 **수정** Sheet 생일 정책 변경 | 기존 optional/nullable 유지 |
| Users 테이블 생일 컬럼 숨김 | null은 `—` 표시 유지 |
| overview 외 생일 UI | Out |
| SQL migration | `profiles.birthday` 이미 nullable |
| 이메일 발송 | Out |

---

## UX — 승인 Sheet 생일

```
[생일]                    [ⓧ 미설정]  ← 항상 표시
[2009년 ▼] [월 ▼] [일 ▼]              ← 미설정 ON: disabled + 값 null
                                      ← 미설정 OFF: 입력 가능, 완성 시 ISO 저장
```

- 승인 Sheet **초기값:** 미설정 ON (Select disabled, `birthday=null`).
- 미설정 OFF로 전환 시 Select 활성화 — 연·월·일 모두 선택 시에만 유효 birthday.
- 미설정 ON으로 전환 시 Select disabled, 필드값 초기화, `birthday=null`.

---

## 기록 연동 (activity log)

| Route | action | 비고 |
|-------|--------|------|
| `POST /api/users/[id]/approval/approve` | `user.approve` | 기존 유지 · metadata에 `birthday_set: boolean` allowlist |
| `POST /api/users` | `user.create` | **410 Gone** — 전 return 분기 log (attempted) |

---

## Acceptance Criteria (Given-When-Then)

### AC-01 · 승인 — 생일 미설정

- **Given** admin이 pending 사용자 수락 Sheet를 연다
- **When** 미설정 상태(Select disabled)에서 필수 프로필만 입력하고 승인한다
- **Then** 200 응답 · 사용자 `status=active` · `birthday IS NULL` · toast「사용자가 승인되었습니다.」

### AC-02 · 승인 — 생일 입력

- **Given** admin이 pending 사용자 수락 Sheet를 연다
- **When** 미설정을 해제하고 유효한 생일을 선택한 뒤 승인한다
- **Then** 200 · `birthday`가 `YYYY-MM-DD`로 저장된다

### AC-03 · 미설정 UX

- **Given** 수락 Sheet의 생일 필드
- **When** admin이 **미설정**을 클릭한다
- **Then** 연·월·일 Select가 disabled 이고 폼 값은 null이다
- **When** admin이 **미설정**을 다시 해제(토글 off)한다
- **Then** Select가 enabled 된다

### AC-04 · overview 생일 배너 제외

- **Given** `birthday`가 null인 active 사용자 A와, 이번 달 생일이 있는 active 사용자 B
- **When** admin이 `/dashboard/overview`를 연다
- **Then** 생일 배너/슬라이드에 B만 표시되고 A는 표시되지 않는다

### AC-05 · 사용자 추가 UI 제거

- **Given** admin이 `/dashboard/users`에 있다
- **When** 페이지 헤더를 본다
- **Then** **사용자 추가** 버튼이 없다

### AC-06 · 사용자 생성 API 제거

- **Given** admin 세션
- **When** `POST /api/users`로 create body를 전송한다
- **Then** 410 응답 · `activity_logs`에 `user.create` 실패/거부 행이 있다

### AC-07 · dashboard layout

- **Given** `/dashboard/users` 페이지
- **When** 렌더링된다
- **Then** `dashboard/layout` 하위 · `DashboardPresenceTrack` 상속 (plan 49)

---

## 영향 파일 (정찰)

| 파일 | 변경 |
|------|------|
| `src/features/users/schemas/user.ts` | `approveUserSchema` 분리 |
| `src/app/api/users/[id]/approval/approve/route.ts` | birthday optional |
| `src/features/users/api/types.ts` | `ApproveUserPayload.birthday` nullable |
| `src/features/users/components/user-approval-sheet.tsx` | null payload · approval fields |
| `src/components/forms/fields/birthday-field.tsx` | `allowUnsetToggle` |
| `src/features/users/components/user-edit-form-fields.tsx` | approval 전용 fields |
| `src/features/users/components/user-form-sheet.tsx` | edit-only |
| `src/app/dashboard/users/page.tsx` | trigger 제거 |
| `src/app/api/users/route.ts` | POST 410 |
| `e2e/google-auth/` | null birthday approve spec |
| `e2e/users/add-flow*.spec.ts` | UI 제거/410 반영 |

---

## E2E 시드 전략 (POST /api/users 제거 후)

- UI E2E: `e2e/helpers/supabase-direct-auth.ts` 또는 기존 admin PATCH/update 경로로 테스트 사용자 준비.
- `POST /api/users` 호출 spec은 410 AC 또는 direct-auth 헬퍼로 **마이그레이션** (본 plan AC 범위).

---

## 리스크

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 다수 E2E가 POST /api/users에 의존 | direct-auth 헬퍼 통일 · verifier에서 전체 green |
| MED | BirthdayField toggle이 edit 폼 회귀 | `allowUnsetToggle` opt-in — approval Sheet만 |
| LOW | 미설정 기본 ON에서 admin이 생일 입력 의도 놓침 | Sheet description 1줄 안내 |

---

## 팀 전달 요약

| 팀 | 작업 |
|----|------|
| designer | Approval Sheet 생일 헤더+미설정 toggle 레이아웃 (참조 이미지) |
| backend-dev | approve schema null · POST /api/users 410 + log |
| frontend-dev | BirthdayField toggle · approval fields · add UI 제거 |
| verifier | AC spec · E2E seed 마이그레이션 · build |
