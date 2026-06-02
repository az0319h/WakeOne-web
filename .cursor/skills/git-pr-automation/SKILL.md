---
name: git-pr-automation
description: 변경사항을 기준으로 브랜치 생성, 스테이징, 한국어 Conventional Commit 생성, push, PR 생성까지 자동 수행한다. 커밋/PR 자동화 요청 시 사용한다.
disable-model-invocation: true
---

# Git PR Automation

## 목적

사용자 승인 기반으로 커밋/PR 자동화를 수행한다.

- 1단계(미리보기): 브랜치명/커밋 메시지/PR 초안을 제안
- 2단계(실행): 사용자 승인 후 로컬/원격 git 작업 수행

## 사전 조건

- `gh auth status`가 성공해야 한다.
- 기본 원격은 `origin`을 사용한다.
- 파괴적 git 명령은 금지한다.

## 실행 절차

### 0) 승인 게이트 (필수)

- 기본값은 **미리보기 모드**다.
- 실행 모드 전환 조건은 아래 하나만 허용한다:
  - 사용자의 응답이 **정확히** `승인` 단일 단어인 경우
- `승인합니다`, `진행`, `ok`, `go`, `푸시해` 등 변형 문구는 모두 거부한다.
- 승인 전에는 절대 `git push`/`gh pr create`를 실행하지 않는다.

### 1) 상태 점검 (미리보기)

- `git status --short`
- `git rev-parse --abbrev-ref HEAD`
- 변경사항이 없으면 종료한다.

### 2) 브랜치명 생성 (미리보기)

- 규칙: `<type>/<slug>`
- 예: `feat/user-table-filter`, `fix/login-redirect`
- 이미 존재하면 숫자 suffix를 붙인다 (`-2`, `-3`).

### 3) 커밋 메시지/PR 초안 생성 (미리보기)

- `.cursor/skills/conventional-korean-commit/SKILL.md` 규칙으로 커밋 메시지 초안을 생성
- `.github/pull_request_template.md`를 채운 PR 제목/본문 초안을 생성
- 사용자에게 아래 형식으로 먼저 출력:

```text
[미리보기]
브랜치: <type/slug>
커밋 메시지:
<title>
<body>

PR 제목: <title>
PR 본문 요약: <섹션 요약>

승인 시 다음을 실행합니다:
- git checkout -b <branch> (또는 switch)
- git add .
- git commit ...
- git push -u origin <branch>
- gh pr create ...
```

### 4) 승인 후 실행

- 사용자 응답이 정확히 `승인`인지 확인 후에만 아래를 순서대로 실행:
  1. 브랜치 생성/전환
  2. `git add .`
  3. 커밋
  4. `git push -u origin <branch>`
  5. `gh pr create`

커밋은 HEREDOC으로 수행한다.

```bash
git commit -m "$(cat <<'EOF'
type(scope): 한국어 제목

- 변경 의도 1
- 변경 의도 2
EOF
)"
```

### 5) PR 생성

- 제목: 커밋 제목과 동일
- 본문: `.github/pull_request_template.md` 구조를 채운다 (이미지 섹션은 빈값 허용)
- `gh pr create --title ... --body ...`

본문 최소 포함 섹션:

- 요약
- 관련 이슈
- 변경 내용
- 테스트 계획
- 체크리스트
- 리스크 및 롤백

## 실패 처리

- commit 실패(훅/lint)는 에러 로그를 보여주고 수정 후 재시도한다.
- push 실패(auth/권한)는 원인과 해결 액션(`gh auth login`)을 안내한다.
- PR 생성 실패 시 현재 브랜치/원격 상태를 요약하고 수동 명령을 제시한다.
- 승인 전 원격 작업이 실행되었으면 실패로 간주하고 즉시 중단/보고한다.
