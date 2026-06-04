---
name: conventional-korean-commit
description: Conventional Commits 형식으로 한국어 커밋 메시지를 생성한다. 커밋 타입은 feat/fix/docs/style/refactor/test/chore 7종만 허용한다.
disable-model-invocation: true
---

# Conventional Korean Commit

## 목적

변경사항에 맞는 Conventional Commits 타입을 고르고, 제목/본문을 한국어로 작성한다.

## 규칙

- 형식: `type(scope): 제목`
- 제목: 50자 내외, 한국어, **명사형 종결**
- 본문: 왜(의도/맥락) 중심 1-3줄
- Breaking change가 있으면 본문에 `BREAKING CHANGE:` 추가

### 제목 문체 강제 규칙 (필수)

- commit-pr 호출로 생성/제안하는 커밋 제목은 항상 **명사형 종결**로 작성한다.
- `-함`, `-하기`, `-추가`, `-수정`, `-개선`, `-정리`, `-복구`, `-도입` 같은 명사형 표현만 허용한다.
- `~한다`, `~했습니다`, `~해라` 같은 서술형/명령형 종결은 금지한다.

예시:

- `feat(auth): 인증 UI 셸 복구`
- `fix(proxy): 배포 origin 검증 로직 수정`
- `refactor(nav): 계정 메뉴 구조 정리`

## 타입 가이드

허용 타입은 아래 7종으로 고정한다.

- `feat`: 사용자 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 포맷/스타일(동작 변화 없음)
- `refactor`: 리팩터링(기능 변화 없음)
- `test`: 테스트 추가/수정
- `chore`: 설정/빌드/잡무성 변경

허용되지 않는 타입(`ci`, `build`, `perf`, `revert` 등)은 사용하지 않는다.

## 생성 절차

1. `git diff --cached --name-only`로 변경 파일 분류
2. 목적이 가장 큰 변경을 기준으로 타입 1개 선택
3. 스코프는 feature 또는 디렉터리 단위로 선택 (예: `auth`, `users`, `ui`)
4. 아래 템플릿으로 메시지 작성

```text
type(scope): 한국어 제목

- 변경 의도 1
- 변경 의도 2
```
