<!--
feat/* → dev PR 템플릿
commit-pr 에이전트 기본 사용 · GitHub compare URL: ?template=feature-to-dev.md
-->

## PR 유형

- [ ] Feature (`feat`)
- [ ] Bugfix (`fix`)
- [ ] Docs (`docs`)
- [ ] Style (`style`)
- [ ] Refactor (`refactor`)
- [ ] Test (`test`)
- [ ] Chore (`chore`)

## 요약 (Why)

<!-- 무엇을 왜 바꾸는지 2~4줄 -->

-

## 현재 동작 (Current Behavior)

-

## 변경 후 동작 (New Behavior)

-

## 관련 이슈

- N/A

## 테스트 계획

### 로컬 검증

- [ ] `bun run tsc --noEmit` (또는 `npx tsc --noEmit`)
- [ ] `bun run lint:strict`
- [ ] `bun run build`

### 기능 검증

- [ ] 정상 시나리오 확인
- [ ] 에러/빈 상태/로딩 상태 확인
- [ ] 권한/인증 시나리오 확인 (해당 시)
- [ ] 모바일/반응형 확인 (UI 변경 시)

## 체크리스트

- [ ] TypeScript strict 유지
- [ ] 서비스 레이어 / React Query / mutations 패턴 준수
- [ ] DB/API 변경 시 SQL/RLS/auth check 반영
- [ ] activity log (CUD Route) 연동 (해당 시)
- [ ] plan·dev-checklist 반영 (해당 시)

## Breaking Change 여부

- [ ] Yes
- [x] No

## 리뷰어 참고사항

- 중점 확인 영역:
- 트레이드오프:

## 리스크 및 롤백

- 리스크:
- 롤백 방법: dev에서 revert

## merge 대상

- **base:** `dev` (운영 반영은 별도 dev→main release PR)
