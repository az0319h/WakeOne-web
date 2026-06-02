# WakeOne Web

WakeOne의 Next.js 16 App Router 기반 어드민/운영 대시보드 프로젝트입니다.  
기존 오픈소스 템플릿을 기반으로 시작했지만, 현재는 WakeOne 규칙과 워크플로우에 맞게 커스터마이징되어 있습니다.

## 핵심 스택

- Next.js 16 (App Router)
- React 19
- TypeScript 5.7 (strict)
- Tailwind CSS v4
- shadcn/ui (New York style)
- Supabase (DB/Auth)
- TanStack React Query
- TanStack Form + Zod
- Bun (권장 패키지 매니저)

## 빠른 시작

```bash
bun install
cp env.example.txt .env.local
bun run dev
```

앱 실행 후 `http://localhost:3000` 에서 확인할 수 있습니다.

## 환경 변수

필수/권장 값은 `env.example.txt`를 기준으로 설정합니다.

특히 Supabase 사용 시:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이며 `NEXT_PUBLIC_`를 붙이면 안 됩니다.

## 프로젝트 구조 (요약)

```text
src/
  app/              # Next.js App Router
  features/         # 기능 단위 모듈
  components/       # 공통 컴포넌트
  lib/              # 공용 유틸리티
  hooks/            # 커스텀 훅
  config/           # 설정 파일
docs/
.cursor/
  rules/            # 전역 규칙
  agents/           # 팀별 에이전트
  skills/           # 스킬
```

## 개발 규칙 요약

- 데이터 레이어: `types.ts -> service.ts -> queries.ts`
- React Query: 서버 prefetch + `HydrationBoundary`, 클라이언트 `useSuspenseQuery`
- 아이콘: `@/components/icons`의 `Icons.*`만 사용
- 페이지 헤더: `PageContainer` props 사용
- 폼: `useAppForm` + `useFormFields<T>()` + Zod
- `any` 타입 금지 (TypeScript strict 유지)

상세 규칙은 아래 파일을 우선 확인합니다.

- `./.cursor/rules/core-conventions.mdc`
- `./.cursor/rules/global-orchestrator.mdc`

## 에이전트 워크플로우

- 전체 실행(`/run`): `planner -> designer -> frontend-dev -> backend-dev -> verifier`
- 직접 호출(별도 `/run` 불필요): `@.cursor/agents/{agent}.md`
- 커밋/PR 전용: `@.cursor/agents/commit-pr.md`
  - 미리보기 후, 사용자 응답이 정확히 `승인`일 때만 원격 반영

## 검증 명령

```bash
bun run tsc --noEmit
bun run lint:strict
bun run build
```

## PR 작성

`.github/pull_request_template.md` 템플릿을 사용합니다.
