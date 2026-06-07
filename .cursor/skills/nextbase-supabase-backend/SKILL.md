---
name: nextbase-supabase-backend
description: Nextbase의 Supabase 백엔드 패턴을 WakeOne에 적용하는 가이드. Supabase Auth, SSR 클라이언트 분리, RLS, 타입 생성, 마이그레이션 구조를 참고해 API/데이터 레이어를 설계할 때 사용한다.
disable-model-invocation: true
---

# Nextbase Supabase Backend

## When to use

- WakeOne에서 Supabase 기반 API/서비스 레이어를 설계/수정할 때
- 인증, RLS, 마이그레이션, 타입 생성 흐름을 정리할 때
- `src/app/api/*`와 `src/features/*/api/service.ts`를 연결할 때

## Core reference points from Nextbase

- Supabase Auth를 SSR 문맥(서버/클라이언트/미들웨어)에서 분리해 사용
- 테이블 단위 RLS 정책을 기본으로 두고, 서비스키 사용 범위를 최소화
- SQL 마이그레이션을 누적 파일로 관리하고 타입을 생성해 동기화
- 서버 액션/라우트 핸들러에서 입력 검증과 에러 응답 형태를 일관화

## WakeOne backend rules

1. `src/features/<feature>/api/types.ts` → `service.ts` → `queries.ts` 패턴을 유지한다.
2. 컴포넌트는 `service.ts`만 호출하고 DB 직접 접근을 하지 않는다.
3. Route Handler(`src/app/api`)는 API 경계로 유지하고 권한/검증/에러 변환을 담당한다.
4. Supabase 서비스키는 서버 전용으로만 사용한다.
5. **활동 감사 로그:** Read·로그인·로그아웃 제외, **모든 CUD Route**는 `recordActivityLog`로 **전 return 분기** 기록 (`core-conventions.mdc` §활동 감사 로그 · plan 08).

## SQL migration policy

- SQL 파일은 `supabase/sql/`에만 추가한다.
- 파일명은 항상 숫자 접두사로 누적한다.
  - 예: `01_auth_rbac_base.sql` → `02_users_profile.sql` → `03_products_crud.sql`
- 기존 SQL 파일을 수정하기보다 다음 번호 파일을 추가해 변경 이력을 남긴다.

## Output contract

백엔드 작업 산출 시 아래를 포함한다.

1. 추가된 SQL 파일 목록
2. 변경된 Route Handler 목록
3. 변경된 `service.ts` 함수 목록
4. **activity log:** 신규·수정 mutation Route의 `recordActivityLog` return 매트릭스
5. 필요한 환경변수/Edge Function 요구사항
