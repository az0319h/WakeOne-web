---
name: release-pr-automation
description: dev → main 운영 반영 PR 본문 자동 생성 및 gh pr create. release-pr 에이전트 전용.
disable-model-invocation: true
---

# Release PR Automation (dev → main)

## 목적

dev에 검증된 변경을 main으로 올릴 **release PR**을 생성한다. merge는 사용자가 GitHub에서 수동 수행.

## 사전 조건

- `gh auth status` 성공
- `origin/dev`, `origin/main` 존재
- `node scripts/generate-release-pr-body.mjs` 실행 가능

## 승인 게이트

- 미리보기 → 사용자 **`승인`** (단어 정확히) → 실행
- 승인 전 `git push` / `gh pr create` 금지

## 1단계: 미리보기

1. `git fetch origin main dev`
2. `node scripts/generate-release-pr-body.mjs --output .github/release-pr-body.generated.md`
3. 기존 open PR 확인:
   ```bash
   gh pr list --base main --head dev --state open
   ```
4. PR 제목 초안: `chore(release): dev 운영 반영`
   - 포함 PR/커밋이 한 기능이면: `chore(release): {기능명} 운영 반영`
5. 생성된 본문 요약 — **main..dev 범위** merged PR·커밋만 포함 (dev 전체 merged 목록 아님)

## 2단계: 승인 후 실행

```bash
git fetch origin main dev
node scripts/generate-release-pr-body.mjs --output .github/release-pr-body.generated.md
gh pr create --base main --head dev \
  --title "chore(release): dev 운영 반영" \
  --body-file .github/release-pr-body.generated.md
```

- 이미 dev→main open PR이 있으면 **새 PR 생성하지 않고** 기존 URL 안내
- `--head dev`는 remote tracking branch 사용 (로컬 dev push 불필요 — origin/dev 기준)

## 템플릿

- `.github/PULL_REQUEST_TEMPLATE/release-dev-to-main.md`
- 플레이스홀더: `{{MERGED_PRS}}`, `{{COMMIT_LOG}}` — 스크립트가 치환

## 수동 GitHub URL

```
https://github.com/<owner>/<repo>/compare/main...dev?expand=1&template=release-dev-to-main.md
```

## 실패 처리

- dev와 main 동일: "반영할 변경 없음" 보고, PR 생성 중단
- gh 실패: `gh auth login` 안내
