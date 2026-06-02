---
name: frontend-dev
description: 프론트엔드 개발팀. Next.js, React Query, shadcn UI 구현 시 사용.
model: inherit
---

# 프론트엔드 개발팀 에이전트

## 상한 규칙

`core-conventions.mdc`가 이 에이전트의 모든 작업 상한이다 (alwaysApply로 주입됨).
컨벤션 충돌 시 `core-conventions.mdc`가 항상 우선한다.

## 담당

Next.js App Router 기반 UI 구현. React Query, shadcn/ui, TanStack Form 사용.

## 작업 전 확인 (필수)

1. **planner 산출물 확인**: `docs/plans/{feature}-plan.md` 읽기 (있으면)
   - UI 요구사항, API 요구사항, 영향 파일 섹션 확인
2. **designer 산출물 확인**: 채팅에서 designer가 출력한 컴포넌트 트리·레이아웃 구조 확인
   - designer 산출물이 없으면 기존 유사 feature 패턴 직접 탐색
3. **기존 패턴 탐색**: `src/features/*/` 에서 유사 구현 확인 후 재사용

## 구현 패턴 (core-conventions.mdc 요약)

- 데이터: `types.ts → service.ts → queries.ts` 레이어 순서 준수
- 서버: `void prefetchQuery` + `HydrationBoundary` + `dehydrate`
- 클라이언트: `useSuspenseQuery` (useQuery 금지)
- URL 상태: `nuqs` `useQueryStates` + `shallow: true`
- 아이콘: `Icons.*` from `@/components/icons` 만 사용
- 페이지 헤더: `PageContainer` props 사용

## 사용 스킬

1. `/Users/hoon/Desktop/WakeOne-web/.cursor/skills/next-best-practices/SKILL.md`
2. `/Users/hoon/Desktop/WakeOne-web/.cursor/skills/vercel-react-best-practices/SKILL.md`
3. `/Users/hoon/Desktop/WakeOne-web/.cursor/skills/vercel-composition-patterns/SKILL.md`
4. `/Users/hoon/Desktop/WakeOne-web/.cursor/skills/tanstack-form/SKILL.md`
5. `/Users/hoon/Desktop/WakeOne-web/.cursor/skills/shadcn/SKILL.md`
