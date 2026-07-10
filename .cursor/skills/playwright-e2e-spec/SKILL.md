---
name: playwright-e2e-spec
description: |
  기획 plan AC를 e2e/{feature}/*.spec.ts로 변환한다.
  verifier 2단계 직전에 실행. Playwright CLI 판정용 spec만 생성(MCP 판정 금지).
disable-model-invocation: true
---

# Playwright E2E Spec 생성 (plan → .spec.ts)

## Mandatory rule

- **판정**: spec 작성 후 **`npx playwright test`** (또는 `npm run test:e2e`)만 사용. Playwright MCP로 AC 판정 **금지**.
- **시점**: verifier **2단계 직전** — plan 구현(FE/BE) 완료 후, Playwright 실행 전.
- **입력**: `docs/plans/{NN}_{feature}-plan.md` §완료 기준 (AC) 표.
- **출력**: `e2e/{feature-slug}/` 아래 `.spec.ts` (plan 1개 : spec N개, 1:N).

## Workflow

### 1. Plan AC 분류

| AC `검증` 열 | spec 유형 | 파일 예 |
|-------------|----------|---------|
| Playwright | UI E2E | `e2e/{feature}/list.spec.ts`, `rbac.spec.ts` |
| API | `request` fixture API test | `e2e/{feature}/import.api.spec.ts` |
| Playwright/API | UI + API 각각 또는 통합 | 흐름별 분리 |
| grep | verifier가 `rg` 실행 (spec 불필요) | — |

독촉 메일 등 plan Out Scope AC는 **skip** + 완료 보고에 명시.

### 2. 파일·구조 규칙

```
e2e/
  auth.setup.ts              # admin storageState
  auth.user.setup.ts         # user storageState (RBAC AC)
  {feature}/
    list.spec.ts             # 목록·필터·페이지네이션
    rbac.spec.ts             # 권한 거부 (user project)
    import.api.spec.ts       # Import/CUD API + activity log
```

- `test.describe('{흐름명}')` → 개별 `test('AC-XX: ...')`
- 셀렉터: **`getByRole` · `getByPlaceholder` · `getByTestId`만** (CSS/DOM 클래스 금지)
- 인증: admin 테스트 → `storageState: e2e/.auth/admin.json` (setup project 의존)
- RBAC user → `storageState: e2e/.auth/user.json` (별도 setup project)

### 3. API spec 패턴

```typescript
import { expect, test } from '@playwright/test';

test.describe('계약 Import API', () => {
  test('AC-06: valid import returns 201 and x-request-id', async ({ request }) => {
    const token = process.env.CONTRACT_IMPORT_TOKEN;
    test.skip(!token, 'CONTRACT_IMPORT_TOKEN required');

    const response = await request.post('/api/contracts/import', {
      headers: { Authorization: `Bearer ${token}` },
      data: { /* plan payload */ }
    });
    expect(response.status()).toBe(201);
    expect(response.headers()['x-request-id']).toBeTruthy();
  });
});
```

- activity log AC: admin `storageState`로 `GET /api/activity-logs?action=...` 검증
- service token API: `request` fixture (쿠키 없음)

### 4. 기존 spec 확인

- `e2e/{feature}/`에 plan AC를 커버하는 spec이 **이미 있으면** 재생성하지 않고 누락 AC만 추가.
- AC 번호가 test title에 포함되어야 verifier가 1:1 매핑 가능.

### 5. 실행

```bash
npx playwright test e2e/{feature}/
```

- `.env`: `E2E_ADMIN_*`, `E2E_USER_*`, `CONTRACT_IMPORT_TOKEN` 등 필수 env 확인
- `playwright.config.ts`: `.env` 로드 · **`globalSetup`**(계정 prep) · **`globalTeardown`**(목 데이터 삭제) 확인
- teardown 실패 = 테스트 실패 — `npm run e2e:cleanup`으로 수동 재시도

## 실패 라우팅

| 원인 | 조치 |
|------|------|
| AC 모호·테스트 불가 | `/planner` — AC Given-When-Then 수정 |
| spec은 맞으나 UI/API 미구현 | FE/BE 수정 후 spec 재실행 |
| env 누락 | `.env` / `env.example.txt` 보강 후 재실행 |

## NEVER

- Playwright MCP로 AC pass/fail 판정
- CSS selector·class 기반 셀렉터
- plan Out Scope AC를 spec에 포함

## ALWAYS

- plan 경로·AC 번호를 spec test title에 명시
- CUD activity log는 API spec으로 분리
- 생성한 spec 파일 경로를 verifier 완료 보고에 나열
