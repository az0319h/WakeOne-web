---
name: playwright-mcp-verifier
description: |
  Playwright MCP로 기획서 AC를 브라우저에서 1차 게이트 검증한다.
  verifier 2단계( dev 준비 직후 )에서만 사용. 실패 시 기획 문제는 /planner, 구현 문제는 FE/BE.
  /run 완료 보고에 skip 불가.
disable-model-invocation: true
---

# Playwright MCP Verifier (1차 게이트)

## Mandatory rule

- **서버**: Cursor MCP `playwright` — [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- **호출 주체**: `/verifier` **2단계만** (FE/BE/planner는 사용하지 않음)
- **순서**: **dev 준비(1단계) 직후, tsc/lint/build 이전**에 반드시 실행
- **`/run` 완료 보고**: 2단계 **skip 금지** (`E2E_SKIP_BROWSER` 무효)
- **MCP 미연결**: 완료 보고 금지 — Cursor Settings → MCP에서 `playwright` 연결 후 재시도

## Prerequisites

1. `.cursor/mcp.json`에 `playwright` 등록
2. `npm run dev` 기동 중 (`E2E_BASE_URL` 또는 `http://localhost:3000`)
3. `docs/plans/{feature}-plan.md`의 **완료 기준 (AC)** 목록
4. 로그인 AC: `.env`에 `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` (테스트 전용)

## Workflow (verifier 2단계)

### 1. Plan AC 로드

- `docs/plans/{feature}-plan.md`에서 AC 번호·기대 동작·URL을 표로 정리
- AC가 없으면 **완료 보고 금지** → `/planner`에 AC 보강 요청

### 2. 브라우저 실행

- `browser_navigate` → base URL
- AC마다: navigate → interact → `browser_snapshot` → URL·한국어 문구 검증
- 실패 시 `browser_take_screenshot` (가능하면)

### 3. AC 유형별 참고

| AC 유형 | 동작 | 통과 |
|---------|------|------|
| 로그인 | 이메일·비밀번호 제출 | `/dashboard` |
| 미로그인 가드 | `/dashboard/*` 직접 접근 | `/auth/sign-in` |
| 로그인 시 auth 차단 | 로그인 후 `/auth/sign-in` | `/dashboard/overview` |
| 로그아웃 | 사이드바 로그아웃 | `/auth/sign-in` |

### 4. 실패 분류 (라우팅)

| 분류 | 판단 기준 | 다음 팀 |
|------|----------|---------|
| **기획** | AC 문구·플로우·URL이 잘못됐거나 검증 불가능 | **`/planner`** — plan 수정 후 verifier **1단계부터** |
| **구현** | AC는 명확한데 앱 동작만 틀림 | `/frontend-dev` 또는 `/backend-dev` → **1단계부터** |
| **환경** | MCP·dev·E2E 계정·env | 환경 해결 후 **1단계부터** |

**애매하면 `/planner` 우선.**

### 5. 통과 후

- verifier **3단계(tsc)** 로 진행
- 완료 보고에 `Playwright MCP (1차 AC): ✅ n/n` 필수

---

## MCP 도구

- `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_take_screenshot`

---

## NEVER

- tsc/build 통과 후에만 브라우저 확인 (순서 역전)
- 기획 AC 실패를 planner 없이 AC만 무시하고 완료
- `/run`에서 `E2E_SKIP_BROWSER`로 2단계 생략
- 프로덕션 URL·실계정 사용

## ALWAYS

- AC 번호와 결과 1:1 매핑
- 기획 실패 시 planner 재호출을 보고에 명시
- 2단계 실패 시 3~6단계 실행하지 않음
