---
name: e2e-remote-cleanup
description: |
  Playwright/운영 검증 후 원격 Supabase(EC2)에 남은 E2E·수동 검증 목 데이터를 삭제한다.
  /root verifier Step 7, /verifier 완료 직전 필수. Supabase MCP execute_sql 사용.
disable-model-invocation: true
---

# E2E 원격 목 데이터 정리

## 목적

`/root` 파이프라인 **마지막 검증(verifier Step 2b~6) 통과 후**, Playwright·API 검증·운영 수동 호출로 **원격 Supabase DB**에 쌓인 목 데이터를 **반드시** 삭제한다.

> 사용자 표현 **「EC2 목 데이터」** = 이 프로젝트의 **원격 Supabase Postgres** (로컬 in-memory mock 아님).

## 자동 cleanup (Playwright)

`playwright.config.ts`의 **`globalTeardown`** (`e2e/global-teardown.ts`)이 **모든 E2E 프로젝트 종료 후** `node scripts/cleanup-e2e-mock-data.mjs`를 실행한다.

| 항목 | 내용 |
|------|------|
| 스크립트 | `scripts/cleanup-e2e-mock-data.mjs` |
| RPC | `public.cleanup_e2e_mock_data()` — `supabase/sql/27_e2e_cleanup_rpc.sql` |
| 수동 실행 | `npm run e2e:cleanup` |
| 디버그 skip | `E2E_SKIP_CLEANUP=1` (완료 보고·CI에는 사용 금지) |
| 사전 준비 | `globalSetup` → `scripts/e2e-plan03-prep.cjs` (E2E 계정 비밀번호·active 복구) |

**테스트 중 생성된 목 데이터는 teardown 실패 시 Playwright exit code ≠ 0** — 잔존 데이터 방치 금지.

## 언제 실행 (verifier Step 7)

| 조건 | Step 7 실행 |
|------|-------------|
| verifier Step 2b Playwright **실행됨** + Step 2b~6 **전부 통과** | **필수** |
| Playwright skip / 미실행 | skip (사유 1줄) |
| Step 2b~6 중 하나라도 실패 (재시도 중) | **실행 금지** — 디버깅용 데이터 유지 |
| root **3회 실패 중단** 직전 | **권장** — 사용자에게 잔존 목 데이터 안내 + cleanup 실행 여부 제안 |

## 담당

- **`/root`:** verifier Task prompt에 이 스킬 **Read + Step 7** 포함. root 완료 보고 전 cleanup pass 확인.
- **`/verifier`:** Step 6 build 통과 **직후** Step 7 수행. cleanup 실패 시 **완료 보고 금지**.

## 워크플로 (고정)

1. **Read** `scripts/cleanup-e2e-mock-data.sql` (삭제 대상·순서 확인)
2. **우선** `node scripts/cleanup-e2e-mock-data.mjs` (Playwright globalTeardown과 동일 RPC)
3. **대안** Supabase MCP `execute_sql` — `scripts/cleanup-e2e-mock-data.sql` 전체 1회 (`apply_migration` **금지**)
4. **검증** — RPC `remaining` 또는 아래 쿼리로 잔존 0건 확인:

```sql
select
  (select count(*) from public.contract_documents where document_number ~ '^(AC|E2E|PV)') as contracts,
  (select count(*) from public.contract_reminder_runs where run_key ~ '^(AC|E2E|PV)') as reminder_runs,
  (select count(*) from auth.users where email ilike '%@example.com' or email in ('e2e@test.local', 'prod-verify@test.local')) as users;
```

4. **완료 보고** — 삭제 전·후 count 또는 「0건 확인」 명시

## 삭제 대상 (allowlist)

| 대상 | 식별 규칙 | 근거 |
|------|-----------|------|
| 계약 | `document_number ~ '^(AC\|E2E\|PV)-'` | `e2e/helpers/contracts.ts`, import/list spec, 운영 PV-* 검증 |
| 독촉 run | `run_key ~ '^(AC\|E2E\|PV)-'` | `e2e/helpers/reminders.ts`, contract-reminder API spec |
| 사용자 | `email ilike '%@example.com'` | users E2E API/UI spec |
| 사용자 | `e2e@test.local`, `prod-verify@test.local` | contract import / prod verify |
| activity_logs | metadata `document_number` 또는 `email` 위 패턴 일치 | 검증 중 생성된 감사 로그 |

**운영 실데이터 보호:** 위 패턴 **외** 행은 삭제하지 않는다. `DELETE` without WHERE on 전체 테이블 **금지**.

## MCP 사용

- Server: `user-WakeOne-Mcp`
- Tool: `execute_sql` (스키마 descriptor Read 후 호출)
- DDL·migration 아님 — **row DELETE만**

## 실패 처리

| 상황 | 조치 |
|------|------|
| MCP 미연결 | root **완료 보고 금지** — 사용자에게 MCP 연결 요청 |
| SQL 오류 (FK·trigger) | `scripts/cleanup-e2e-mock-data.sql` 순서 확인 후 재실행 |
| 잔존 count > 0 | 패턴 추가 필요 시 스크립트·스킬 업데이트 후 재실행 |

## NEVER

- 검증 **성공 전** 목 데이터 삭제 (실패 재현 불가)
- `apply_migration`으로 cleanup SQL 적용
- allowlist 밖 `DELETE FROM …` (전체 truncate)

## ALWAYS

- Step 2b~6 pass **이후에만** 실행
- cleanup pass/fail을 verifier·root 완료 보고에 포함
- 신규 E2E 접두·이메일 도메인 추가 시 **이 스크립트 + 스킬** 동시 갱신
