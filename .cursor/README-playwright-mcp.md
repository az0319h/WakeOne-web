# Playwright MCP (WakeOne)

[Microsoft playwright-mcp](https://github.com/microsoft/playwright-mcp) — **기획서 AC를 브라우저에서 1차 게이트**로 검증한다.

## 설계 원칙

1. **dev 기동**
2. **Playwright MCP** — `docs/plans/NN_*-plan.md` AC 전항목 (**tsc/build보다 먼저**)
3. AC 실패(기획) → **`/planner`** 재기획
4. AC 통과 후 → tsc → lint → react-doctor → build

`/run` 완료 보고 시 **2단계 skip 불가.**

## 설치

- `@playwright/mcp`, `.cursor/mcp.json`, `.cursor/playwright-mcp.config.json`
- Cursor Settings → MCP → **playwright** 연결
- `npx playwright install chromium`
- `.env`: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` (로그인 AC 시)

## 문서

- 에이전트: `.cursor/agents/verifier.md`
- 스킬: `.cursor/skills/playwright-mcp-verifier/SKILL.md`
