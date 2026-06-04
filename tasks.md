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

- [x] `middleware.ts` 파일 생성
- [x] 환경별 허용 URL 정책 반영
  - 로컬: `http://localhost:3000`
  - 배포: `.env`의 배포 도메인
- [x] 로컬/배포 각각 동작 확인

## 3) Auth 정리 작업 (완료)

- [x] 인증 관련 코드/설정/문서 사용처 전수 검색
- [x] 사용하지 않는 인증 공급자 의존 제거
- [x] 환경변수/설정 파일의 불필요 항목 제거
- [x] Supabase Auth 기준으로 대체 경로 정리

## 4) 기획 문서/관련 파일 정리

- [ ] 아래 문서 검토 후 제거 여부 확정
  - `docs/plans/auth-rbac-supabase-plan.md`
- [ ] 기획 문서 제거 시 관련 참조 파일도 함께 정리
  - 기획은 에초에 처음부터 다시 작업을 할 예정

## 5) 최종 검증

- [ ] `npm run build` 통과
- [ ] 주요 문서 링크 깨짐 없는지 확인
- [ ] 변경사항 요약 작성 후 커밋/PR 진행
