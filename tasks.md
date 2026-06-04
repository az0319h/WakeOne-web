# Next Session Tasks

작성일: 2026-06-02

다음에 다시 접속하면 아래 순서대로 진행.

## 1) 빌드 실패 원인 파악 후 수정

- [ ] 현재 빌드 실패 재현 (`npm run build`)
- [ ] 타입 에러 원인 파악
  - 대상 파일: `src/app/api/users/route.ts`
  - 현재 확인된 이슈: `organizations` 타입 접근 오류(`code` 속성)
- [ ] 수정 후 재빌드로 통과 확인 및 vercel.com 배포

## 2) `middleware.ts` 생성

- [x] 프로젝트 루트 `middleware.ts` 생성 (`src/proxy.ts` 제거)
- [x] 환경별 허용 URL 정책 반영
  - 로컬: `http://localhost:3000`
  - 배포: `.env`의 `NEXT_PUBLIC_APP_URL` (필수)
- [x] 로컬/배포 각각 동작 확인

## 3) Auth 정리 작업 (완료)

- [x] 인증 관련 코드/설정/문서 사용처 전수 검색
- [x] 사용하지 않는 인증 공급자 의존 제거
- [x] 환경변수/설정 파일의 불필요 항목 제거
- [x] Supabase Auth 기준으로 대체 경로 정리

## 4) 기획 문서/인증 1차

- [x] 레거시 제거: `docs/plans/auth-rbac-supabase-plan.md`
- [x] 기획서 복원: `docs/plans/01_supabase-auth-login-plan.md`
- [x] SQL 복원: `supabase/sql/02_auth_user_auto_profile.sql`, `03_fix_profiles_rls_recursion.sql`
- [x] 앱 코드 재구현 (기획서 §구현 상태) — `/run` 완료
- [ ] **git commit** 권장

## 5) 최종 검증

- [ ] `npm run build` 통과
- [ ] 주요 문서 링크 깨짐 없는지 확인
- [ ] 변경사항 요약 작성 후 커밋/PR 진행
