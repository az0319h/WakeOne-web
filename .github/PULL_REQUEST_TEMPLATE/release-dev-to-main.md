<!--
dev → main 운영 반영 PR 템플릿
release-pr 에이전트 · GitHub compare URL: compare/main...dev?template=release-dev-to-main.md
-->

## PR 유형

- [ ] Feature (`feat`)
- [ ] Bugfix (`fix`)
- [ ] Docs (`docs`)
- [ ] Style (`style`)
- [ ] Refactor (`refactor`)
- [ ] Test (`test`)
- [x] Chore (`chore`)

## 요약 (Why)

dev 브랜치에 검증 완료된 변경을 main(운영)에 반영합니다.

## 포함된 변경 (main..dev)

<!-- release-pr 에이전트가 자동 채움 · 수동 수정 가능 -->

### Merged PR (base: dev)

{{MERGED_PRS}}

### 커밋 요약

```
{{COMMIT_LOG}}
```

## Supabase / migration

- [ ] dev Supabase에 SQL migration 적용 완료
- [ ] 운영 Supabase migration 계획 확인 (merge 후 적용 시 명시)

<!-- 예: supabase/sql/45_*.sql, 46_*.sql -->

-

## 테스트 계획

### dev 환경 검증

- [ ] dev에서 기능 QA·checklist 완료
- [ ] tsc / build 통과 확인

### 운영 반영 후

- [ ] smoke test (로그인, 핵심 플로우)
- [ ] migration 적용 (해당 시)

## Breaking Change 여부

- [ ] Yes
- [ ] No

## 리스크 및 롤백

- 리스크:
- 롤백 방법: main revert PR 또는 hotfix branch

## merge 대상

- **base:** `main`
- **head:** `dev`
- merge는 **리뷰·체크리스트 확인 후** 수동 수행
