<!--
Thanks for submitting a pull request.
Please provide enough context for fast and high-quality review.
This template follows high-star OSS patterns (React / Angular / Kubernetes)
and is adapted to WakeOne conventions.
-->

## PR 유형

<!-- 해당 항목에 체크하세요 -->

- [ ] Feature (`feat`)
- [ ] Bugfix (`fix`)
- [ ] Docs (`docs`)
- [ ] Style (`style`)
- [ ] Refactor (`refactor`)
- [ ] Test (`test`)
- [ ] Chore (`chore`)

## 요약 (Why)

<!-- 무엇을 왜 바꾸는지 2~4줄로 설명 -->

-

## 현재 동작 (Current Behavior)

<!-- 기존에 어떤 문제가 있었는지 -->

-

## 변경 후 동작 (New Behavior)

<!-- 이번 PR로 어떤 점이 달라지는지 -->

-

## 관련 이슈

<!-- Closes #123, Related #456 / 없으면 N/A -->

- N/A

## 테스트 계획

### 로컬 검증

- [ ] `bun run tsc --noEmit`
- [ ] `bun run lint:strict`
- [ ] `bun run build`

### 기능 검증

- [ ] 정상 시나리오 확인
- [ ] 에러/빈 상태/로딩 상태 확인
- [ ] 권한/인증 시나리오 확인 (해당 시)
- [ ] 모바일/반응형 확인 (UI 변경 시)

## 체크리스트

- [ ] TypeScript strict 유지 (`any` 추가 없음)
- [ ] 서비스 레이어 패턴 준수 (`types.ts -> service.ts -> queries.ts`)
- [ ] React Query 패턴 준수 (`useSuspenseQuery`, invalidate 반영)
- [ ] 아이콘 규칙 준수 (`@/components/icons`만 사용)
- [ ] 페이지 헤더 규칙 준수 (`PageContainer` props 사용)
- [ ] 폼 변경 시 Zod + `useAppForm` 적용
- [ ] DB/API 변경 시 SQL/RLS/auth check 반영
- [ ] 문서/플랜 업데이트 (필요 시)

## Breaking Change 여부

- [ ] Yes
- [ ] No

<!-- Yes 인 경우 하위에 상세 작성 -->
BREAKING CHANGE:

## 리뷰어 참고사항

<!-- 리뷰어가 집중해서 봐야 할 포인트 -->

- 중점 확인 영역:
- 트레이드오프:

## 리스크 및 롤백

- 리스크:
- 롤백 방법:
