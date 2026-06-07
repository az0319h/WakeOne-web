# 비밀번호 정책 강화·set-password 제거 기획서

> Date: 2026-06-07  
> Status: Approved  
> Author: planner  
> **SQL:** 해당 없음  
> **선행:** [03](./03_user-lifecycle-profile-plan.md), [07](./07_auth-route-guard-plan.md)

## 한 줄 요약

비밀번호는 **8자 이상 + 문자·숫자 조합**만 허용하고, `/auth/set-password`를 제거한다. 비밀번호 변경은 **로그인 후** `ProfilePasswordSheet`(nav-user) → `PATCH /api/profile/password`만 사용한다.

## 정책 확정

| 항목 | 확정 |
|------|------|
| **비밀번호 규칙** | 최소 8자, **영문자 1자 이상 + 숫자 1자 이상** |
| **검증 위치** | `src/lib/password.ts` 공유 · `changePasswordSchema` · API Route |
| **set-password** | 페이지·폼·스키마·middleware/session 리다이렉트 **제거** |
| **password_set_at 가드** | dashboard/API **차단 제거** (초대는 기존처럼 invite 시 설정) |
| **변경 경로** | `ProfilePasswordSheet` → `PATCH /api/profile/password` 유지 |

## AC

| # | Then |
|---|------|
| 1 | 7자 이하 또는 문자만/숫자만 새 비밀번호 → 클라이언트·API **400** |
| 2 | `/auth/set-password` 접근 시 **404** (라우트 없음) |
| 3 | 로그인 user dashboard 접근 시 set-password **리다이렉트 없음** |
| 4 | nav-user 비밀번호 변경 Sheet 정상 동작 |
| 5 | tsc · lint · build 통과 |

## activity log

`profile.password_change` 기존 유지. 신규 Route 없음.
