---
name: supabase-mcp-backend
description: Supabase MCP를 강제 사용해 백엔드 작업을 수행하는 WakeOne 전용 스킬. 스키마 확인, SQL 설계, CRUD API 구현, 배포 점검까지 일관된 순서로 진행할 때 사용한다.
disable-model-invocation: true
---

# Supabase MCP Backend

## Mandatory rule

Supabase 관련 백엔드 작업은 시작 전에 반드시 Supabase MCP를 사용한다.
MCP 확인 없이 SQL/Route Handler/Service 레이어를 수정하지 않는다.

## Workflow

1. **MCP inspect**
   - 현재 프로젝트/스키마/테이블/정책 상태를 MCP로 확인한다.
2. **Migration design**
   - `supabase/sql/`에 다음 번호 SQL 파일을 추가한다.
3. **Backend implementation**
   - `src/app/api/*` Route Handler
   - `src/features/*/api/service.ts`
   - 필요 시 타입/검증 로직
4. **MCP deploy (필수)**
   - `supabase/sql/NN_*.sql` 작성 후 **반드시** `apply_migration`으로 원격 Supabase에 적용한다.
   - 적용 전·후 `list_migrations` / `list_tables`(또는 `execute_sql`)로 상태를 확인하고 완료 보고에 **적용 여부**를 명시한다.
   - `apply_migration` 실패 시 완료 보고 금지 — 원인·수동 조치를 사용자에게 전달한다.
5. **CRUD verification**
   - Create/Read/Update/Delete 경로가 모두 동작하도록 점검한다.
6. **Deploy readiness**
   - 환경변수, Edge Function, RLS 정책, Dashboard Redirect URL 등을 정리한다.

## SQL numbering policy (strict)

- 경로: `supabase/sql/`
- 규칙: `NN_description.sql` (`NN`은 2자리 증가 숫자)
- **파일 최상단 메타 (필수):** `File`, `Plan`, `Date`, `Status` (`Completed` | `In Progress` | `Approved` | `Cancelled`), `Remote migration`, `Summary` — `docs/plans/README.md` 참고
- 현재 기준 시작점: `01_auth_rbac_base.sql`
- 다음 파일부터 `02_...sql`, `03_...sql` 순으로 누적한다.

## Done criteria

완료 보고에는 반드시 아래를 포함한다.

- MCP로 확인한 핵심 상태 요약 (테이블/정책/함수)
- 신규 SQL 파일명과 목적
- API 엔드포인트별 CRUD 동작 여부
- 배포 체크리스트
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - 필요한 Supabase Edge Function
