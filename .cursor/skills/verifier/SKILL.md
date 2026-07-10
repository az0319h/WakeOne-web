---
name: verifier
description: |
  WakeOne 확인팀. dev 준비 → plan AC 기반 e2e spec 생성 → Playwright CLI 판정 → tsc → lint → react-doctor → build.
  AC 실패(기획) 시 /planner 재기획. spec green + build 통과 전까지 완료 보고 금지.
disable-model-invocation: true
---

# WakeOne Verifier

## `/root` 모드

- root는 **`Task(subagent_type="verifier")`로만** 호출. root가 tsc/build만 실행하면 **2단계 Playwright 우회**.
- `verifier.md` §6단계 표 순서 · `playwright-e2e-spec/SKILL.md` **Read 후** spec 생성 → CLI 실행.

## 역할

구현 완료 주장을 **Playwright CLI(AC) → 정적·빌드** 순으로 검증한다.
기획이 현실과 맞지 않으면 **구현·빌드 통과 전에** `/planner`로 되돌린다.

---

## 검증 체크리스트 (순서 고정)

| 단계 | 명령 / 도구 | 기준 |
|------|-------------|------|
| 1. Dev 준비 | `npm run dev` 기동·유지 | `E2E_BASE_URL`(기본 localhost:3000) 응답 |
| 2a. **E2E spec 생성** | `playwright-e2e-spec/SKILL.md` | plan AC → `e2e/{feature}/*.spec.ts` (누락분만) |
| 2b. **Playwright CLI (판정)** | **`npx playwright test`** | plan AC spec **전항목 green** |
| 3. 타입 | `npx tsc --noEmit` | 타입 에러 0 |
| 4. Lint | `npm run lint:strict` | 경고 0 |
| 5. React | `npx react-doctor@latest --verbose --diff` | 점수 회귀 없음 |
| 6. Build | `npm run build` | exit 0 |
| 7. **원격 cleanup** | `e2e-remote-cleanup/SKILL.md` · `npm run e2e:cleanup` | E2E 목 데이터 0건 |

> 2a: `.cursor/skills/playwright-e2e-spec/SKILL.md`
> 2b: **Playwright MCP 판정 금지** — CLI만 사용
> 7: Playwright `globalTeardown`이 자동 실행. verifier는 **`npm run e2e:cleanup`** 또는 MCP로 **2b~6 pass 후** 잔존 확인

**2b를 3~6단계보다 먼저 실행한다.** 2b 실패 시 3~6단계로 넘어가지 않는다. **Step 7은 2b~6 전부 통과 후에만** 실행한다.

---

## 2단계 실패 → 팀 라우팅 (필수)

| 판단 | 증상 예 | 다음 팀 | 재검증 |
|------|---------|---------|--------|
| **기획** | AC 모호, 누락, 잘못된 URL/플로우, 기획과 화면 불일치 | **`/planner`** | plan 수정 후 **1단계부터** |
| **구현** | 리다이렉트·로그인·RLS·폼·토스트·레이아웃 버그 | `/frontend-dev` 또는 `/backend-dev` | 수정 후 **1단계부터** |
| **환경** | dev 미기동, E2E 계정·CONTRACT_IMPORT_TOKEN 없음 | `.env` 보강 | 해결 후 **2단계부터** |

기획 vs 구현이 애매하면 **기획(`/planner`) 우선** 검토한다.

---

## 반복 루프

```
[1. dev 준비]
    ↓
[2a. spec 생성] → [2b. playwright test] ──기획 실패──→ /planner → plan 수정 → 1부터
    ↓ 구현 실패
    FE/BE 수정 → 1부터 재실행
    ↓ 통과
[3. tsc → 4. lint → 5. react-doctor → 6. build]
    ↓ 실패 → 해당 팀 수정 → 1부터 재검증 (2b Playwright 반드시 재실행)
    ↓ 전부 통과
[7. 원격 Supabase E2E 목 데이터 cleanup]
    ↓ 실패 → MCP/SQL 재시도 — 완료 보고 금지
    ↓ pass
[완료 보고]
```

---

## 성공 기준 & 완료 보고

**2b + 6 + 7 pass** 후에만 출력.

```
✅ 검증 완료: {기능명}
기획서: docs/plans/{feature}-plan.md
spec: e2e/{feature}/*.spec.ts

검증 결과:
- Playwright CLI (AC spec)  : ✅ {통과}/{전체}
- tsc --noEmit              : ✅
- lint:strict               : ✅
- react-doctor              : ✅
- build                     : ✅
- 원격 목 데이터 cleanup    : ✅ (contracts: 0, users: 0)

반복 횟수: {N}회
수정된 팀: {planner|FE|BE|없음}

다음 단계: PR 생성
```

---

## `/run` 파이프라인 규칙

- `/verifier`는 구현 팀(FE/BE) **이후** 실행
- **2b 실패로 `/run` 완료 보고 금지**
- Playwright 계정: `.env`의 `E2E_ADMIN_*`, `E2E_USER_*`, `E2E_USER2_*`
- `E2E_SKIP_BROWSER=1`은 **로컬 임시 디버그용**이며 `/run`·완료 보고에 사용하지 않는다

---

## NEVER

- Playwright MCP로 AC pass/fail 판정
- 2b skip 후 완료 보고 (`/run` 포함)
- spec 없이 build만 맞추고 완료 처리
- **2b~6 pass 전** 원격 목 데이터 삭제
- cleanup skip 후 `/root` 완료 보고

## ALWAYS

- `docs/plans/{feature}-plan.md` 경로를 prompt에 명시
- AC 번호별 통과/실패를 spec test title과 1:1 보고
- CUD activity log는 API spec으로 검증
- **2b~6 pass 후** `e2e-remote-cleanup/SKILL.md` Read → **`npm run e2e:cleanup`** (Playwright teardown과 동일). teardown이 이미 실행됐으면 remaining 0건 확인만
