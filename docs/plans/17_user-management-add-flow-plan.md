# 사용자 관리 개편 · 사용자 추가 흐름 변경 기획서

> Date: 2026-07-08  
> Status: Approved  
> Author: planner  
> **SQL:** 구현 단계에서 필요 여부 확정  
> **선행:** [02](./02_user-invite-profiles-plan.md), [03](./03_user-lifecycle-profile-plan.md), [04](./04_user-reactivate-plan.md), [05](./05_profile-completion-plan.md), [06](./06_users-profile-modal-plan.md), [08](./08_activity-audit-log-plan.md), [11](./11_password-policy-set-password-removal-plan.md)  
> **Out:** 계약서 관리 페이지 수정은 다음 작업으로 분리

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **02** | 기존 Users 생성은 `사용자 초대` 문구와 Nodemailer/Gmail SMTP 메일 발송 중심. 본 plan에서 이메일 초대를 비활성화하고 관리자 직접 `사용자 추가`로 전환한다. |
| **03** | 계정 비활성화, inactive 로그인 차단, inactive 행 수정 불가, 본인 비활성화 방지 정책은 유지한다. |
| **04** | 재활성화 API/UI와 Users mutation `onSettled` invalidate 패턴은 유지한다. |
| **05** | 프로필 조직 필드와 본인/관리자 수정 권한 분리의 기반을 사용한다. |
| **06** | Users 목록/프로필 모달의 표시 필드를 확장·정리하되, 프로필 상세 Dialog 구조는 기존 방향을 존중한다. |
| **08** | 모든 CUD Route 응답 분기에 `activity_logs` 기록과 `x-request-id`를 포함한다. |
| **11** | 비밀번호 정책은 유지하되, 초기 비밀번호 `12341234a` 생성 후 최초 로그인 변경 강제는 하지 않는다. |

## 한 줄 요약

관리자 Users 화면의 `사용자 초대`를 `사용자 추가`로 바꾸고, 이메일 초대 메일 발송 없이 Supabase Auth 계정을 직접 생성한다. 사용자 추가 필수값은 이메일·소속 부서·직급·직책·시스템역할·생일이며, 초기 비밀번호는 `12341234a`로 고정한다. Users 목록에서는 초대 상태를 제거하고 그 자리에 소속을 표시한다.

## 정책 확정

| 항목 | 확정 |
|------|------|
| **용어** | `사용자 초대` → `사용자 추가` |
| **생성 방식** | admin이 `/dashboard/users`에서 직접 사용자 추가. 이메일 초대 링크·초대 메일 발송 없음 |
| **필수값** | 이메일, 소속 부서, 직급, 직책, 시스템역할, 생일 |
| **초기 비밀번호** | 모든 신규 계정은 `12341234a`로 생성 |
| **최초 로그인 비밀번호 변경 강제** | 하지 않음. 사용자가 필요 시 프로필 비밀번호 변경에서 직접 변경 |
| **계정 전달 방식** | 관리자가 개인적으로 계정 아이디와 초기 비밀번호 전달 |
| **목록 컬럼** | 초대 상태 컬럼/필터/배지 제거. 해당 위치에 `소속` 표시 |
| **계정 상태** | 활성/비활성화 및 재활성화 흐름 유지 |
| **시스템 역할** | 기존 `admin` / `user` 유지 |
| **본인 프로필 수정** | 현재 허용 범위 유지. 단 소속 부서, 직급, 직책, 아바타, 이메일은 관리자만 수정 가능 |
| **이메일 초대 인프라** | 신규 사용자 추가 경로에서 Nodemailer/SMTP 호출 금지. 레거시 코드 제거 또는 미사용 처리 |

## 범위

### In Scope

| 영역 | 내용 |
|------|------|
| Users UI | 버튼, Sheet/Dialog 제목, 설명, 토스트, 빈 상태 등 사용자 생성 관련 문구를 `사용자 추가`로 변경 |
| 사용자 추가 폼 | 필수 필드 6종 추가 및 client/API validation 정비 |
| Users 목록 | 초대 상태 표시 제거, 소속 컬럼 표시 |
| API | `POST /api/users`를 초대 메일 발송 없는 사용자 생성 흐름으로 변경 |
| Supabase Auth | `auth.admin.createUser` 또는 동등 서버 전용 생성 API로 초기 비밀번호 `12341234a` 설정 |
| Profiles | 신규 사용자 생성 시 필수 인사 정보와 시스템 역할, 생일 저장 |
| Profile 권한 | 본인 프로필 수정 가능 범위 유지, 관리자 전용 필드 API 방어 유지/보강 |
| Activity Logs | `user.create`, `user.update`, `user.deactivate`, `user.reactivate`, `profile.update` 기록 대상 명시 및 검증 |
| 검증 | Playwright AC, activity log API 검증, tsc, lint, build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 계약서 관리 페이지 수정 | 다음 작업으로 분리 |
| 최초 로그인 비밀번호 변경 강제 | 이번 plan에서는 하지 않음 |
| 임시 비밀번호 자동 발급/재발급 | 고정 초기 비밀번호만 사용 |
| 이메일 또는 SMS 자동 안내 | 관리자가 개인적으로 전달 |
| 시스템 역할 추가 | `admin` / `user`만 유지 |
| 비활성 계정 수정 허용 | 기존 정책대로 inactive 행은 수정 불가 |

## 사용자 추가 흐름

1. admin이 `/dashboard/users`에서 `사용자 추가`를 연다.
2. 폼에 이메일, 소속 부서, 직급, 직책, 시스템역할, 생일을 입력한다.
3. `mutations.ts`의 사용자 생성 mutation이 `service.ts`를 통해 `POST /api/users`를 호출한다.
4. API Route는 admin 인증/인가를 확인한다.
5. API Route는 필수값과 이메일 중복을 검증한다.
6. Supabase Auth 사용자를 초기 비밀번호 `12341234a`로 생성한다.
7. `profiles`에 이메일, 소속 부서, 직급, 직책, 시스템역할, 생일, 상태 `active`를 저장한다.
8. 성공/실패 모든 응답 분기에서 `activity_logs`에 `user.create`를 기록하고 `x-request-id` 헤더를 반환한다.
9. FE는 성공 토스트를 표시하고 폼을 reset한 뒤 목록을 새로고침 없이 갱신한다.

## 기존 이메일 초대 흐름 변경

| 기존 | 변경 |
|------|------|
| `사용자 초대` 용어 | `사용자 추가` |
| 이메일만 입력해 초대 | 필수 인사 정보까지 입력해 계정 생성 |
| 8자 난수 임시 비밀번호 | 고정 초기 비밀번호 `12341234a` |
| Nodemailer/Gmail SMTP 메일 발송 | 발송하지 않음 |
| 초대 상태 표시 | 제거 |
| `user.invite` activity action | 신규 생성에는 `user.create` 사용 |

구현 단계에서는 기존 invite helper, SMTP 환경변수 사용 지점, 메일 본문 생성 로직이 신규 사용자 추가 경로에서 호출되지 않음을 확인한다. 레거시 코드 제거 여부는 영향 범위를 확인한 뒤 backend-dev/frontend-dev 단계에서 결정한다.

## 데이터 및 API 영향

| 항목 | 계획 |
|------|------|
| `POST /api/users` | 초대 API 의미에서 사용자 생성 API 의미로 변경 |
| Request body | 이메일, 소속 부서, 직급, 직책, 시스템역할, 생일 필수 |
| Response | 초기 비밀번호 값은 응답에 포함하지 않음 |
| `profiles` | 필수 인사 필드 저장. DB NOT NULL 필요 여부는 구현 단계에서 현재 스키마 확인 후 결정 |
| 이메일 중복 | 활성/비활성 모두 중복으로 간주. 기존 재활성화 경로 유지 |
| Auth | 생성 시 email/password 기반 계정으로 로그인 가능해야 함 |
| SMTP | 신규 생성 경로에서는 호출하지 않음 |

## Activity Logs

| action | 신규/기존 | HTTP | Route | 대상 | 비고 |
|------|------|------|------|------|------|
| `user.create` | **신규** | POST | `/api/users` | 생성 대상 user 또는 attempted email | 기존 `user.invite`를 신규 생성 의미로 재사용하지 않음 |
| `user.update` | 기존 유지 | PUT | `/api/users/[id]` | 수정 대상 user | 관리자 전용 필드 수정 포함 |
| `user.deactivate` | 기존 유지 | DELETE | `/api/users/[id]` | 비활성화 대상 user | 기존 비활성화 흐름 유지 |
| `user.reactivate` | 기존 유지 | PATCH | `/api/users/[id]` | 재활성화 대상 user | `user.activate` 신규 추가하지 않음 |
| `profile.update` | 기존 유지 | PATCH | `/api/profile` | 본인 user | 본인 허용 필드만 |

모든 mutation Route는 2xx/4xx/5xx 응답 전 분기에서 1건 append한다. `metadata`에는 비밀번호, 토큰, 초기 비밀번호를 절대 포함하지 않는다. 실패 로그에는 `error_code`, 필드명 중심의 `validation_errors`, `attempted_target` 정도만 허용한다.

## 보안 리스크와 완화

| 리스크 | 완화 |
|------|------|
| 고정 초기 비밀번호 노출 | 응답, 토스트, activity log metadata, 서버 로그에 `12341234a`를 남기지 않는다 |
| 관리자의 전달 실수 | UI copy 또는 운영 가이드에 “초기 비밀번호는 안전한 내부 채널로 전달” 안내를 둘 수 있다 |
| 최초 변경 강제 없음 | 이번 plan에서는 요구사항대로 강제하지 않으며, 추후 별도 plan으로 전환 가능하게 기록 |
| 이메일 초대 레거시 혼재 | 신규 생성 경로에서 SMTP/Nodemailer가 호출되지 않는 AC와 테스트를 둔다 |
| 권한 우회 | Route Handler에서 admin 인증/인가와 본인 프로필 forbidden field 방어를 유지한다 |

## Acceptance Criteria

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin이 `/dashboard/users`에 접근 | 사용자 생성 버튼과 Sheet/Dialog를 확인 | 모든 생성 관련 문구가 `사용자 초대`가 아니라 `사용자 추가`로 표시된다 |
| 2 | Playwright | admin이 사용자 추가 Sheet를 연 상태 | 이메일을 비우고 제출 | 이메일 필드 오류가 표시되고 사용자는 생성되지 않는다 |
| 3 | Playwright | admin이 사용자 추가 Sheet를 연 상태 | 소속 부서, 직급, 직책, 시스템역할, 생일 중 하나를 비우고 제출 | 해당 필드 오류가 표시되고 사용자는 생성되지 않는다 |
| 4 | Playwright | admin이 이메일, 소속 부서, 직급, 직책, 시스템역할, 생일을 모두 입력 | 사용자 추가 제출 | 성공 토스트가 표시되고 Users 목록에 신규 사용자가 새로고침 없이 표시된다 |
| 5 | Playwright/API | AC #4로 생성된 신규 계정 | `/auth/sign-in`에서 이메일과 `12341234a`로 로그인 | 최초 비밀번호 변경 강제 없이 대시보드에 진입한다 |
| 6 | API/로그 | admin이 사용자 추가를 성공 | `POST /api/users` 응답과 `activity_logs` 확인 | 응답에 `x-request-id`가 있고 `user.create` 성공 로그가 1건 기록된다 |
| 7 | API/로그 | admin이 필수값 누락 payload로 사용자 추가 요청 | `POST /api/users` 응답과 `activity_logs` 확인 | 400 응답과 `user.create` 실패 로그가 1건 기록되고 metadata에 비밀번호 값은 없다 |
| 8 | API/로그 | admin이 사용자 추가를 성공 | 서버 호출/mocking 또는 로그를 확인 | Nodemailer/SMTP 초대 메일 발송 흐름이 실행되지 않는다 |
| 9 | Playwright | admin이 Users 목록을 확인 | 테이블 헤더와 행을 확인 | `초대 상태` 컬럼/배지/필터가 없고 해당 위치에 `소속`이 표시된다 |
| 10 | Playwright/API | admin이 기존 active user를 수정 | 소속 부서, 직급, 직책, 아바타, 이메일 중 허용 필드를 변경 저장 | 저장 성공, 목록/프로필 반영, `user.update` 로그가 기록된다 |
| 11 | Playwright/API | 일반 user가 본인 프로필에 접근 | 현재 허용된 본인 수정 필드를 저장 | 저장 성공, `profile.update` 로그가 기록된다 |
| 12 | API | 일반 user가 본인 프로필 API에 관리자 전용 필드 수정 payload를 전송 | `PATCH /api/profile` 호출 | 400 또는 403으로 거부되고 소속 부서, 직급, 직책, 아바타, 이메일은 변경되지 않는다 |
| 13 | Playwright/API | admin이 active user를 비활성화 | 확인 Dialog에서 확정 | 계정이 비활성화되고 `user.deactivate` 로그가 기록된다 |
| 14 | Playwright/API | admin이 inactive user를 재활성화 | 활성화 확인 | 계정이 활성화되고 `user.reactivate` 로그가 기록된다 |
| 15 | CLI | 구현 완료 후 | `bunx playwright test` | 본 plan AC 기반 spec이 모두 통과한다 |
| 16 | CLI | 구현 완료 후 | `tsc`, `lint`, `build` | 모두 통과한다 |

## 구현 팀 전달 메모

### designer

- 기존 오픈소스 admin UI 톤을 유지한다.
- `사용자 추가` Sheet는 모바일에서 CTA가 항상 도달 가능해야 한다.
- 초대 상태 제거 후 소속 컬럼이 목록 밀도를 과하게 높이지 않도록 컬럼 폭과 responsive 표시를 설계한다.

### backend-dev

- `POST /api/users`의 의미 변경과 `user.create` action 추가를 우선 처리한다.
- `recordActivityLog`는 모든 return 분기 직전에 호출한다.
- 초기 비밀번호는 응답/로그/metadata에 포함하지 않는다.
- 기존 `user.invite` action과 호환 필요 여부를 확인하되, 신규 생성에는 `user.create`를 사용한다.
- DB NOT NULL 또는 CHECK 제약 추가가 필요한지 현재 `profiles` 스키마를 확인한다.

### frontend-dev

- CUD는 `src/features/users/api/mutations.ts`의 mutationOptions를 통해서만 실행한다.
- 사용자 추가 성공 시 `form.reset()`을 수행하고, 목록은 `onSettled` invalidate로 갱신한다.
- 컴포넌트에서 `service.ts`를 직접 호출하지 않는다.
- 본인 프로필 수정 권한 UI와 API 방어가 일치하도록 금지 필드를 노출하지 않는다.

### verifier

- Playwright spec은 Given-When-Then AC를 기준으로 작성한다.
- activity log는 UI E2E가 아닌 API 검증으로 `x-request-id`와 action 행을 확인한다.
- 이메일 초대 비활성화는 SMTP/Nodemailer 호출 없음까지 검증한다.
