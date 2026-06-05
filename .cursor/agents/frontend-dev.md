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

- 데이터: `types.ts → service.ts → queries.ts → mutations.ts` 레이어 순서 준수
- 서버: `void prefetchQuery` + `HydrationBoundary` + `dehydrate`
- 클라이언트 Read: `useSuspenseQuery` (useQuery 금지)
- 클라이언트 CUD: `useMutation` + `api/mutations.ts` (**필수**, 아래 체크리스트)
- URL 상태: `nuqs` `useQueryStates` + `shallow: true`
- 아이콘: `Icons.*` from `@/components/icons` 만 사용
- 페이지 헤더: `PageContainer` props 사용

## Mutation 필수 워크플로 (CUD — 누락 시 작업 미완료)

`core-conventions.mdc` § Mutation & 캐시 동기화를 **항상** 따른다. Read만 있는 작업은 예외.

### 작업 순서 (CUD가 하나라도 있으면)

1. `service.ts` — API 호출 함수 (이미 있으면 재사용)
2. `mutations.ts` — `mutationOptions` + **`onSettled`에서 `invalidateQueries`(`entityKeys.all`)**
3. UI — `useMutation({ ...xxxMutation, onSuccess: UI만 })`, 제출/확인 시 **`mutateAsync` / `mutate`**
4. 목록·상세가 `useSuspenseQuery`로 보이는지 확인 → 저장/삭제 후 **새로고침 없이** 반영되는지 자체 검증

### NEVER

- 폼·버튼에서 `service.ts` 또는 raw `fetch` **직접 호출**
- CUD 후 `router.refresh()`만으로 테이블/캐시 갱신에 의존
- `mutations.ts` 없이 `useMutation({ mutationFn: ... })`만 인라인 정의
- `onSuccess`에만 `invalidateQueries` — 컴포넌트 `onSuccess` 덮어쓰기로 캐시 갱신이 빠짐
- API Route·Sheet·폼 UI만 만들고 **뮤테이션·invalidate 미구현**으로 완료 보고

### ALWAYS

- 사용자 액션(저장, 삭제, 비활성화, 초대 등) → **즉시** 뮤테이션 실행
- 캐시 무효화는 **`mutations.ts`의 `onSettled`**
- 기존 feature 수정 시 `useMutation` + `onSuccess` 오버라이드 grep → invalidate가 `onSettled`에 있는지 확인·수정

### 완료 전 체크리스트

- [ ] `src/features/{feature}/api/mutations.ts` 존재 (CUD 시)
- [ ] 모든 CUD 경로가 `useMutation` + `mutate`/`mutateAsync` 사용
- [ ] `onSettled` → `invalidateQueries({ queryKey: *Keys.all })`
- [ ] 수동 새로고침 없이 UI에 변경 반영 확인

## 사용 스킬

1. `./.cursor/skills/next-best-practices/SKILL.md`
2. `./.cursor/skills/vercel-react-best-practices/SKILL.md`
3. `./.cursor/skills/vercel-composition-patterns/SKILL.md`
4. `./.cursor/skills/tanstack-form/SKILL.md`
5. `./.cursor/skills/shadcn/SKILL.md`
