# 로그아웃 「이 기기만」 전환 기획서

> Date: 2026-10-29
> Status: Completed
> Author: planner

## 한 줄 요약

로그아웃과 로그인 실패 정리를 **이 기기(브라우저)만** 끊도록 바꿔서, 휴대폰에서 로그아웃해도 PC 로그인이 유지되게 한다. 비활성 계정 처리는 지금처럼 **모든 기기**를 끊는다.

---

## 배경 · 원인 (root 조사 2026-10-29)

- 사용자 제보: PC와 휴대폰에 같이 로그인해 두면 한쪽 로그아웃 시 다른 쪽도 로그아웃된다. Supabase 「Enforce single session per user」는 **꺼져 있음**.
- 원인: `supabase.auth.signOut()`을 옵션 없이 부르면 기본값이 `scope: 'global'`이라 **그 사용자의 모든 기기 세션을 서버에서 삭제**한다(설치본 `@supabase/auth-js` 2.106.2 `GoTrueClient.js:3176` `signOut(options = { scope: 'global' })`).
- Dev 서버 증거(홍성훈 계정, KST): 15:58 Mac 로그인 → 16:20 iPhone 로그인(Mac 유지) → 16:22:55 iPhone `POST /auth/v1/logout?scope=global` → 16:24 Mac `Session not found`.
- 서버 설정·DB 트리거 문제 아님(`on_auth_user_created`만 존재). 로그인 시 세션을 지우는 로직 없음.
- `scope: 'local'`도 **이 세션은 서버에서 삭제**(`POST /logout?scope=local`)하고 쿠키를 지운다. 다른 세션만 남는다(설치본 `_signOut` 확인).

---

## 선행 plan 참조

| plan | 가져온 제약 · 관계 |
|------|-------------------|
| **01** | 로그아웃 = `signOut()` → `/auth/sign-in`. 범위(local/global) 미정 → **이번에 확정(수정)** |
| **07** | 「비밀번호 변경 후 타 기기 세션 무효화」 후속 과제 — `/api/profile/password` 410 종료로 **해당 없음** |
| **44** | 강제 PW 변경 후 서버 `adminSignOutGlobal` — 이메일 로그인 종료로 도달 불가. **변경 없음** |
| **45 · 57** | 로그아웃은 activity log **Out** 유지. 57의 pending/rejected 「callback 후 session signOut」 의도 = 방금 만든 세션 정리 → **local로 구현 정정** |
| **81** | Tasks 연결 실패 시 「session 정리 · 로그인 실패」 — 정리 범위를 **이 브라우저만**으로 확정 |
| **91** | D-6·M-6 「로그아웃 → 그 기기 구독만 삭제 · 다른 기기 로그인 유지」가 원래 의도. AC-17(`signOut()`이 `unsubscribePushOnThisDevice` 먼저 호출) **유지**. `push_subscription.delete` 로그 **그대로** |

관계: 01·57·81의 **버그 수정(구현 정정)**. 91 의도 회복. DB·API 신규 없음.

---

## 인터뷰 결정 (Phase 1 · 사용자 「전부 추천대로」)

| # | 결정 |
|---|------|
| D-1 | 로그아웃 버튼은 **「이 기기만」 하나**. 「모든 기기에서 로그아웃」 버튼 **만들지 않음**. 관리자·직원 동일 |
| D-2 | Google 로그인 callback 실패 분기(프로필 확인 실패·Tasks 연결 실패·승인 대기·거절/비활성)는 **방금 로그인하던 브라우저만** 정리. 다른 기기 유지 |
| D-3 | 제외: 비활성 계정 처리(middleware·실시간 감지·관리자 비활성화)는 **모든 기기 끊기 유지**. 안 쓰는 비밀번호 화면 **삭제 안 함**. 이미 끊긴 사용자 **안내 문구 없음** |
| D-4 | 완료 기준: Playwright 자동 테스트(같은 계정 2개 컨텍스트) + 사용자 수동 확인 1건(PC·아이폰) |

---

## 목표 & 완료 기준

- **목표:** 한 기기에서 로그아웃하거나 로그인에 실패해도 같은 계정의 다른 기기 로그인은 그대로 유지된다.
- **완료:** 아래 AC 전부 green + tsc·lint:strict·build 0 + cleanup 잔여 0. 수동 QA M-1은 「사용자 직접 확인 필요」로 최종 보고에 넘긴다.

---

## 범위 (In / Out)

### In

| # | 대상 | 변경 |
|---|------|------|
| 1 | `src/features/auth/api/service.ts` `signOut()` | `signOut(options?: { scope?: 'local' \| 'global' })` · **기본 `'local'`** · `supabase.auth.signOut({ scope })`로 **항상 범위 명시** · `unsubscribePushOnThisDevice()` 선행 호출 유지 |
| 2 | `src/app/api/auth/google/callback/route.ts` 4곳(196·252·336·343행 부근) | `supabase.auth.signOut({ scope: 'local' })` |
| 3 | `src/lib/supabase/middleware.ts:115` (status≠active) | `supabase.auth.signOut({ scope: 'global' })` **명시** + 주석 1줄(「비활성·비승인 계정은 모든 기기 세션을 끊는다 — plan 104」) |
| 4 | `src/features/auth/components/profile-status-realtime.tsx:72` (inactive 실시간 감지) | `signOut({ scope: 'global' })` **명시** (판단 근거 아래) |

**profile-status-realtime 판단 (global 명시):** 관리자 비활성화 Route는 이미 `revoke_user_sessions`와 ban으로 모든 세션을 지운다. 하지만 Route를 거치지 않고 DB에서 status만 바뀌는 경우도 있다(Dev MCP 수동 수정, e2e `setProfileStatus`). 그때도 「모든 기기 끊기」가 지켜지도록 global을 명시한다. 영향은 이미 비활성이 된 본인 계정에만 미친다.

호출부 변경 없음(인자 없이 `signOut()` → 이 기기만): `src/components/nav-user.tsx:61`, `profile-security-section.tsx:9`, `profile-password-sheet.tsx:66`, `force-password-change-form.tsx:41`.

### Out

| 항목 | 이유 |
|------|------|
| 「모든 기기에서 로그아웃」 버튼 | D-1 |
| 관리자 비활성화 `adminSignOutGlobal`·ban (`src/app/api/users/[id]/route.ts:880`) | 지금처럼 유지 (D-3) |
| 비밀번호 화면 삭제(`ProfileSecuritySection`·`ProfilePasswordSheet`·`/auth/force-password-change`) | D-3 · 어디서도 import 안 됨/도달 불가 — 정리는 별도 과제 |
| 이미 끊긴 사용자 안내 문구 | D-3 · 다시 로그인하면 됨 |
| 로그아웃 activity log | 기록 대상 아님(45·core-conventions) |
| DB·SQL·RLS·신규 API | 없음 |
| UI·문구 | 없음 (버튼 이름 「로그아웃」 그대로) |
| `e2e/quick-round2/helpers.ts:177` 우회 주석 | **수정하지 않음.** 테스트 헬퍼가 직접 만든 supabase-js 클라이언트의 라이브러리 기본값(global)을 설명하는 주석이라, 앱 코드를 바꿔도 여전히 맞다 |
| ESLint 규칙으로 bare `signOut()` 금지 | AC-08 grep으로 대신함 |

---

## 영향 파일 & 패턴

| 파일 | 담당 | 이유 |
|------|------|------|
| `src/app/api/auth/google/callback/route.ts` | backend-dev | 실패 분기 4곳 local |
| `src/lib/supabase/middleware.ts` | backend-dev | 비활성 global 명시 + 주석 |
| `src/features/auth/api/service.ts` | frontend-dev | 공용 `signOut` 기본 local · 옵션 인자 |
| `src/features/auth/components/profile-status-realtime.tsx` | frontend-dev | global 명시 |
| `e2e/auth/104-logout-this-device.spec.ts` (신규) | verifier | AC spec |

패턴: e2e 일회용 사용자 `createActiveTestUser` + `signInWithSupabasePassword` 2회로 **서로 다른 세션 2개** 만들기(`e2e/helpers/supabase-direct-auth.ts`) · 푸시 mock 구독 `registerMockDevice`·service-role 조회(`e2e/helpers/push-mock.ts`) · 사용자 삭제 `admin.auth.admin.deleteUser`.

호출자: 공용 `signOut()` 6곳(위 In/호출부 목록). 서버 `auth.signOut` 5곳(callback 4 + middleware 1). 정적 e2e(`google-auth/pending-admin-notifications.api.spec.ts` AC-12 정규식·`email-safety.spec.ts`)는 이번 변경과 충돌 없음(확인함).

---

## 리스크 & 완화책

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 공용 `signOut` 기본값을 local로 바꾸면 비활성 실시간 감지도 local이 됨 | realtime에 `{ scope: 'global' }` 명시(In #4) · AC-06·AC-08 |
| HIGH | 로그아웃 테스트를 공유 계정(`e2e/.auth/user.json`)으로 돌리면 회귀 시 다른 spec 세션이 전부 끊김 | **일회용 사용자만** 사용 · afterAll `deleteUser` · AC-10 |
| MED | callback 실제 경로는 Google 동의 화면이 필요해 자동 테스트 불가 | AC-05(같은 호출 `signOut({ scope: 'local' })`의 서버 동작 검증) + AC-07·08 grep |
| MED | 헤드리스에서 실제 푸시 구독 불가 → 「A 구독만 삭제」 판정 어려움 | `addInitScript`로 `PushManager.prototype.getSubscription` stub(endpoint = A mock) · `navigator.serviceWorker.ready` 대기 후 로그아웃 |
| LOW | refresh token 재사용 감지로 테스트 세션이 꼬임 | 살아 있음 판정은 `GET /api/notifications`(서버 `getUser`가 세션 존재 확인)로 하고, refresh 호출은 「죽었는지」 판정(AC-06)에만 사용 |
| LOW | 「모든 기기 로그아웃」 수단이 사라짐(휴대폰 분실 등) | 열린 질문 OQ-1 · 당장은 관리자 비활성화→재활성화로 대체 |

---

## UI 요구사항

없음. 버튼 위치·문구(「로그아웃」)·이동(`/auth/sign-in`) 그대로. **designer 단계 생략 권고** (화면 변경 0).

## API / DB 요구사항

없음. 신규 Route·SQL·RLS·env 없음. 메일 발송 Route 호출 없음.

## 활동 감사 로그

**activity log 해당 없음** — 로그아웃·로그인 실패 정리는 기록 대상이 아니다(plan 45). 로그아웃할 때 나가는 `DELETE /api/notifications/push/subscriptions` → `push_subscription.delete` 기록은 plan 91 그대로.

---

## 수용 기준 (AC · Given-When-Then)

공통: Dev DB · `npx playwright test e2e/auth/104-logout-this-device.spec.ts --project=chromium` · **일회용 active 사용자**(`createActiveTestUser('p104-…')`)만 사용 · 같은 사용자로 `signInWithSupabasePassword`를 2번 해서 세션 A·B를 각각 브라우저 컨텍스트에 넣는다 · 메일 Route 호출 금지 · `.env`의 `E2E_REMINDER_DRY_RUN=1`·`E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1` 유지.

| AC | 방법 | Given | When | Then |
|----|------|-------|------|------|
| AC-01 | Playwright | 사용자 U의 컨텍스트 A·B가 둘 다 `/dashboard/overview`를 열어 둠. A 쿠키(storageState)를 미리 저장 | A에서 사이드바 사용자 메뉴 → 「로그아웃」 클릭 | A는 `/auth/sign-in`으로 이동. A에서 `/dashboard/overview` 다시 열면 `/auth/sign-in`(redirectTo 포함)으로 돌아감 |
| AC-02 | Playwright | AC-01 직후 | B 페이지 새로고침 후 `/dashboard/notifications` 이동 | B는 로그인 화면으로 가지 않음. URL이 `/dashboard/…` 유지 · 사이드바 사용자 메뉴(U 이름) 보임 |
| AC-03 | API | AC-01 직후 | (1) B 컨텍스트 request로 `GET /api/notifications?limit=1` (2) 미리 저장한 A 쿠키로 같은 요청 | (1) **200** (B 세션이 서버에 살아 있음) (2) **401** (A 세션은 서버에서 삭제됨) |
| AC-04 | Playwright + DB | U의 A·B가 각자 mock 구독 EA·EB 등록(`POST /api/notifications/push/subscriptions` 각 1건 · DB `push_subscriptions` U 2행). A 페이지는 브라우저 현재 구독이 EA로 보이도록 stub · `navigator.serviceWorker.ready` 대기 | A에서 「로그아웃」 | service-role 조회: EA 행 **0** · EB 행 **1** (A 기기 구독만 삭제) |
| AC-05 | API (callback 실패 분기와 같은 호출) | U의 새 세션 C·D | C 세션으로 `auth.signOut({ scope: 'local' })` 호출 | D로 `GET /api/notifications?limit=1` **200** · C 쿠키로 같은 요청 **401** |
| AC-06 | Playwright + API (비활성 회귀 · 모든 기기 유지) | 다른 일회용 사용자 V의 컨텍스트 A(`/dashboard/overview` 열림)와 세션 B(요청 안 함, refresh token 보관) | service-role로 V `profiles.status='inactive'` (관리자 Route 미경유) | A는 `/auth/sign-in?accountDisabled=1`로 이동. 15초 안에 B refresh token으로 `refreshSession` **실패** (모든 기기 세션 종료) |
| AC-07 | grep | 구현 완료 | `src/app/api/auth/google/callback/route.ts` 검사 | `auth.signOut({ scope: 'local' })` **4건** · 옵션 없는 `auth.signOut()` **0건** |
| AC-08 | grep | 구현 완료 | `grep -rnE "auth\.signOut\(\s*\)" src` 및 범위 검사 | 매치 **0건**. `src/lib/supabase/middleware.ts`에 `signOut({ scope: 'global' })` 1건 + 바로 위 주석 1줄. `profile-status-realtime.tsx`에 `signOut({ scope: 'global' })` 1건. `service.ts` `signOut` 기본값 `'local'` |
| AC-09 | grep (plan 91 AC-17 회귀) | 구현 완료 | `src/features/auth/api/service.ts` 검사 | `signOut` 안에서 `await unsubscribePushOnThisDevice()`가 `supabase.auth.signOut(` 보다 **먼저** 나온다 |
| AC-10 | cleanup | spec 종료 | afterAll | 일회용 사용자 U·V `auth.admin.deleteUser` 완료 · U·V `push_subscriptions` 잔여 0 · `scripts/cleanup-e2e-mock-data.mjs` remaining 0 |
| AC-11 | 정적 검사 | 구현 완료 | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 오류 0 |

### 수동 QA (사용자 직접 확인 필요)

| # | 기기 | 순서 | 기대 |
|---|------|------|------|
| M-1 | 실제 PC + 아이폰 (수정 배포된 환경) | 둘 다 로그인 → 아이폰에서 로그아웃 → PC 새로고침. 반대로 PC 로그아웃 → 아이폰 새로고침 | 로그아웃 안 한 기기는 계속 대시보드 사용 가능 |

---

## 실행 계획 (battle-plan)

```
SCOPE
  Goal: 로그아웃·로그인 실패 정리를 이 기기만 끊도록 바꾼다
  Done when: AC-01~11 green + M-1 사용자 이관
  Not doing: 모든 기기 로그아웃 버튼 · 비활성 처리 변경 · 비밀번호 화면 삭제 · 안내 문구 · DB

STEPS
  0. [ ] root: Step 0 백업
  1. [ ] designer: 생략 (UI 변경 0)                                   Confidence: HIGH
  2. [ ] backend-dev: callback 4곳 local · middleware global 명시+주석   Confidence: HIGH
  3. [ ] frontend-dev: service.signOut 옵션·기본 local · realtime global Confidence: HIGH
  4. [ ] verifier: 104 spec(일회용 사용자) · grep · tsc/lint:strict/build · cleanup
         Confidence: MED (푸시 stub·SW 준비 타이밍)

ROLLBACK
  코드 4파일 revert만 하면 됨 (DB 변경 없음)

ESTIMATE
  코드 4파일 ~15줄 + spec ~180줄 · Simple
  ~30–50분 (구현 10–15 · spec·검증 20–35)
  Checkpoint: Step 3 끝난 뒤 AC-07~09 grep 먼저 green 확인
```

---

## 팀 전달

- **designer:** 생략 권고. 화면·문구·이동 변경이 없다.
- **backend-dev:** callback `signOut` 4곳을 `{ scope: 'local' }`로 바꾸고, `middleware.ts:115`에 `{ scope: 'global' }`와 주석 1줄을 단다. SQL·activity log 변경 없음.
- **frontend-dev:** `service.ts`를 `signOut(options?: { scope?: 'local' | 'global' })`(기본 local, 푸시 해제 선행 유지)로 바꾸고, `profile-status-realtime.tsx`는 `signOut({ scope: 'global' })`. 나머지 호출부는 그대로 둔다.
- **verifier:** `e2e/auth/104-logout-this-device.spec.ts` 신규(일회용 사용자 U·V만, afterAll 삭제) → AC-01~11. 메일 Route 호출 금지. `helpers.ts:177` 주석은 그대로 둔다. M-1은 최종 보고에 「사용자 직접 확인 필요」로 적는다.

---

## 열린 질문

| # | 내용 |
|---|------|
| OQ-1 | 휴대폰 분실 같은 경우 「모든 기기에서 로그아웃」할 방법이 사라진다. 당장은 관리자 비활성화→재활성화로 대체하고, 필요하면 후속 plan [TBD] |
| OQ-2 | 안 쓰는 비밀번호 화면·Route(`ProfileSecuritySection`·`ProfilePasswordSheet`·`/auth/force-password-change`·`/api/profile/password` 410) 정리는 별도 후속 [TBD] |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-29 | 최초 작성 · Approved(/root 단일 게이트 · deep-interview 4문항 전부 추천안) · 로그아웃·callback 실패 정리 local · 비활성 처리 global 명시(middleware·realtime) · DB·UI·activity log 없음 · AC 11 + 수동 QA 1 · designer 생략 권고 | planner |
| 2026-10-29 | **관계 메모(내용 변경 없음):** 같은 날 승인된 [105](./105_push-resume-after-relogin-plan.md)(로그아웃 후 같은 계정 재로그인 시 휴대폰 알림 자동 복구)가 이 plan의 `signOut(options?: { scope })`에 `reason?: 'user' \| 'forced'`를 더한다. `profile-status-realtime`은 `signOut({ scope: 'global', reason: 'forced' })`가 된다. 105 이후 AC-09는 「푸시 처리 호출(`signOutPushOnThisDevice()` 또는 `unsubscribePushOnThisDevice()`)이 `supabase.auth.signOut(`보다 먼저」로 읽는다. 구현 순서는 **104 → 105**를 권장한다. scope 결정(기본 local · 비활성 global)은 105가 그대로 따른다 | planner |
