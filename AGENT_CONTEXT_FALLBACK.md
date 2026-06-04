# Agent Context Fallback Note

작성일: 2026-06-02

## 배경

- 현재는 특정 에이전트 직접 호출 시(예: `/run` 없이) 먼저 사용해 본다.
- 우선은 현재 설정으로 운영한다.
- 나중에 에이전트가 맥락 파악을 못 하는 문제가 생기면 규칙을 강화한다.

## 문제 발생 시 적용할 강화 규칙

각 에이전트가 작업 전에 아래를 **무조건** 수행하도록 수정한다.

1. `git status` 확인
2. `git diff` 확인
3. `docs/plans/` 내부 변경/관련 문서 확인
4. 위 내용을 바탕으로 맥락 파악 후 작업 시작

## 적용 대상

- `./.cursor/agents/planner.md`
- `./.cursor/agents/designer.md`
- `./.cursor/agents/frontend-dev.md`
- `./.cursor/agents/backend-dev.md`
- `./.cursor/agents/verifier.md`

## 메모

- 지금은 즉시 적용하지 않는다.
- 실제로 맥락 누락 이슈가 확인되면 위 규칙을 에이전트별 `작업 전 확인` 섹션에 반영한다.
