# 사용자 초대·프로필 단순화 기획서

> Date: 2026-06-04  
> Status: Completed  
> Author: planner  
> **SQL:** `04` · Remote `profiles_only_cleanup` applied  
> **검증:** Playwright AC #1~#8 · SMTP(Gmail) · tsc · lint · build — 완료  
> **선행:** [01_supabase-auth-login-plan.md](./01_supabase-auth-login-plan.md)  
> **후속(별도 plan):** `profiles.status` Inactive · Realtime · **비밀번호 변경 페이지** — 본 문서 Out

## 구현 상태

| 구분 | 상태 | 비고 |
|------|------|------|
| SQL `04` | **완료** | MCP 적용 |
| invite `POST /api/users` | **완료** | `createUser` + Nodemailer(Gmail SMTP) |
| Nav RBAC · Users · 프로필 | **완료** | |
| Playwright AC #1~#8 | **완료** | 2026-06-04 verifier (초대 메일·sign-in 포함) |
| CLI #9~#12 | **완료** | SQL · tsc · lint · build |

---

## 한 줄 요약

`profiles` 단일 테이블 중심. **관리자만** Users에서 **이메일 초대** → 서버가 **8자 임시 비밀번호** 생성·Auth 등록 → **Nodemailer(Gmail SMTP)** 로 메일 본문 발송 → 수신자는 **`/auth/sign-in`에서 로그인**. 비밀번호 **변경 강제 없음**(추후 변경 페이지 별도 plan).

---

## 목표 & 완료 기준 (AC)

| # | 검증 | 기대 |
|---|------|------|
| 1 | Playwright / 수동 | `system_role=admin` — 사이드바·Cmd+K에 **Users** 표시 |
| 2 | Playwright / 수동 | `system_role=user` — 사이드바·Cmd+K에 **Users 없음** |
| 3 | Playwright / 수동 | user가 `/dashboard/users` 직접 접근 → **`/dashboard/overview` 리다이렉트** + **sonner**(권한 없음) |
| 4 | Playwright / 수동 | admin — Users에서 이메일만 제출 → **임시 비밀번호 포함 초대 메일** 발송 성공 토스트 |
| 5 | Playwright / 수동 | 초대 수신 — 메일의 **8자 임시 비밀번호**로 **`/auth/sign-in` 로그인** 성공 |
| 6 | Playwright / 수동 | AC #5 직후 — `/dashboard/overview` 등 **정상 접근** |
| 7 | ~~Playwright~~ | **[변경됨·Out]** ~~미설정 시 set-password 리다이렉트~~ — 초대 계정은 `password_set_at` 즉시 설정 |
| 8 | Playwright / 수동 | user — `/dashboard/profile`에서 first_name, last_name, phone 수정·저장 |
| 9 | 수동 / SQL | org·membership·audit **제거** 후 앱 **profiles만** 사용 |
| 10 | CLI | `npx tsc --noEmit` 통과 |
| 11 | CLI | `npm run lint:strict` 통과 |
| 12 | CLI | `npm run build` 통과 |

---

## 범위 (In / Out)

### In Scope

| 영역 | 내용 |
|------|------|
| **초대** | `POST /api/users` only — `auth.admin.createUser` + **8자 난수 비밀번호**(대·소문자+숫자) |
| **메일** | **Nodemailer + Gmail SMTP** — 본문에 이메일·임시 비밀번호·`{APP_URL}/auth/sign-in` |
| **profiles** | 초대 직후 `system_role=user`, **`password_set_at=now()`** (대시보드 즉시 허용) |
| **초대 UI** | admin Users — 이메일만, 성공·실패 **한국어 토스트** |
| **admin Users RBAC** | 기존과 동일 |
| **본인 프로필** | `/dashboard/profile` 3필드 |
| **env** | `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*`, `NEXT_PUBLIC_APP_URL` — `env.example.txt` 참고 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| **Supabase Edge Function** 초대 | 사용 안 함 |
| **`inviteUserByEmail`** + 초대 링크 | **제거(대체)** |
| **초대 전용 `/auth/set-password` 플로우** | 초대 경로 Out; 페이지는 레거시·기타용 잔존 가능 |
| **첫 로그인 비밀번호 변경 강제** | Out — **후속 plan**에서 변경 페이지 |
| **임시 비밀번호 API/화면 노출** | 응답·로그에 비밀번호 미포함 |
| `profiles.status` Inactive 등 | `03_*` 예정 |

---

## 초대·인증 흐름 (확정 2026-06-04)

### 1) 관리자 초대

1. admin이 `/dashboard/users`에서 **이메일** 제출.
2. `POST /api/users` → `inviteUserWithTemporaryPassword(email)` (`invite.server.ts`).
3. `createUser({ email, password, email_confirm: true })`.
4. `profiles` 업데이트: `system_role=user`, `password_set_at=now()`.
5. Nodemailer로 초대 메일 발송. **실패 시 Auth 사용자 롤백(delete)**.
6. 성공 토스트: 「초대 메일을 발송했습니다. 임시 비밀번호가 포함되어 있습니다.」

### 2) 초대 수신자

1. 메일에서 **임시 비밀번호** 확인.
2. `{NEXT_PUBLIC_APP_URL}/auth/sign-in` 에서 이메일·임시 비밀번호 로그인.
3. 대시보드 정상 이용. 비밀번호 변경은 **추후** (강제 없음).

### 3) `password_set_at` (초대)

- 초대 계정: 생성 직후 **`now()`** — middleware set-password 가드 **대상 아님**.
- 레거시·수동 계정만 `null` 가능 (01 백필 정책 유지).

---

## SMTP / 개발자 설정 (Gmail)

`.env` (템플릿: `env.example.txt`):

```env
SUPABASE_SERVICE_ROLE_KEY=   # Supabase Dashboard → API → service_role
NEXT_PUBLIC_APP_URL=http://localhost:3000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=              # 앱 비밀번호 (2단계 인증)
SMTP_FROM=WakeOne <your@gmail.com>
```

발급: [Google 앱 비밀번호](https://myaccount.google.com/apppasswords)

구현 파일:

- `src/features/users/api/invite.server.ts`
- `src/lib/mail/smtp.ts`, `src/lib/mail/send-invite-email.ts`
- `src/lib/auth/temp-password.ts`

---

## DB / API

| 경로 | 메서드 | 동작 |
|------|--------|------|
| `/api/users` | GET | admin · profiles 목록 |
| `/api/users` | POST | admin · **createUser + invite mail** |
| `/api/profile` | PATCH | 본인 · 3필드 |

---

## 영향 파일

| 경로 | 작업 |
|------|------|
| `src/app/api/users/route.ts` | POST → `invite.server` |
| `src/features/users/api/invite.server.ts` | **신규** |
| `src/lib/mail/*`, `src/lib/auth/temp-password.ts` | **신규** |
| `env.example.txt` | SMTP·Gmail 안내 |
| `package.json` | `nodemailer` |

---

## 검증 (verifier)

1. `npm run dev` (`.env` SMTP + service_role 반영 후 재시작)
2. Playwright MCP AC #1~#6, #8
3. tsc → lint → react-doctor → build

AC #4~#6: **실제 수신 가능한 테스트 메일**로 초대·로그인 확인.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 임시 비밀번호 **메일 평문** | HTTPS·운영 메일함 보안; 추후 변경 페이지 |
| HIGH | SMTP/Gmail 일일 한도 | Brevo 등 대안 문서화 |
| MED | 메일 실패 후 롤백 | createUser 후 send 실패 시 `deleteUser` |
| MED | Gmail 앱 비밀번호 미설정 | env.example·에러 메시지 한국어 |

---

## 열린 질문

- [TBD] admin이 타 사용자 `system_role` 변경 UI
- [TBD] `email` 본인 변경

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-04 | 최초 작성 | planner |
| 2026-06-04 | E2E / Playwright MCP 섹션 | planner |
| 2026-06-04 | `/run` FE·BE 구현 | FE+BE |
| 2026-06-04 | Status In Progress, MCP `04` | planner |
| 2026-06-04 | **초대 방식 변경**: `createUser`+8자+Gmail Nodemailer, Edge/set-password 초대 Out, AC #4~#7 갱신 | planner |
| 2026-06-04 | `/run` 초대 구현·verifier (AC #1~#4,#8,#9·build) | FE+BE+verifier |
| 2026-06-04 | Status **Completed** — AC·검증 전항목 완료 | planner |
