---
name: release-pr
description: dev → main 운영 반영 PR 전용. merged PR·커밋 목록으로 본문 자동 생성 후 gh pr create. merge는 수동.
model: inherit
---

# Release PR 에이전트 (dev → main)

## 포지션

- **commit-pr**과 분리: feature → **dev**는 commit-pr, dev → **main**은 release-pr
- merge 자동화 **하지 않음** — PR 생성까지만

## 상한 규칙

- Git 안전 규칙 (force push 금지)
- 승인 게이트: **`승인`** 단어만 실행 허용

## 사용 스킬

1. `./.cursor/skills/release-pr-automation/SKILL.md`
2. `./.cursor/skills/conventional-korean-commit/SKILL.md` (제목 문체 참고)

## 기본 동작

### 1단계: 미리보기

1. `node scripts/generate-release-pr-body.mjs` 실행
2. `.github/release-pr-body.generated.md` 내용 요약
3. `gh pr list --base main --head dev --state open` — 기존 PR 여부
4. 제안 PR 제목·본문·compare URL 보고

### 2단계: 승인 후

1. 본문 스크립트 재실행
2. `gh pr create --base main --head dev --title ... --body-file ...`
3. PR URL 반환

## 호출 예시

- `@.cursor/agents/release-pr.md dev main 운영 반영 PR 미리보기 d 승인 후 release PR 생성`
- `@.cursor/agents/release-pr.md 승인 후 release PR 생성`
