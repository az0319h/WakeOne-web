# 인증/인가 기획서 (Supabase 기반)

- 작성일: 2026-06-01
- 단계: 백엔드 개발
- 다음 단계: 프론트 데이터 연결

## Execution Checklist

- [x] 기획 문서 생성/수정/삭제 반영
- [x] 디자인 설계 반영 (기존 UI 재사용 근거 포함)
- [x] 프론트 개발 완료
- [x] 백엔드 개발 완료
- [x] MCP 적용 완료 (적용 결과 기록)
- [ ] 프론트 데이터 연결 완료
- [ ] 검증 및 완료 보고

## Backend/MCP 적용 로그

- SQL 파일: `supabase/sql/01_auth_rbac_base.sql`
- MCP 적용 도구: `user-supabase-mcp.apply_migration`
- 적용 결과: 성공 (`01_auth_rbac_base`)
- 생성 테이블:
  - `public.organizations` (RLS enabled)
  - `public.profiles` (RLS enabled)
  - `public.organization_memberships` (RLS enabled)
  - `public.audit_logs` (RLS enabled)
- 배포 Edge Function:
  - `invite-user` (verify_jwt=true, status=ACTIVE)
- 프로젝트 URL 확인:
  - `https://agbdnrzjhkuxlxnowmta.supabase.co`

## 1. 목표

- Supabase를 사용해 인증/인가를 구현한다.
- 회원가입은 공개 방식으로 받지 않고, 관리자 초대 방식만 허용한다.
- 로그인 방식은 이메일/비밀번호만 사용한다.
- OAuth(구글/깃허브)는 사용하지 않는다.
- 조직도 기반으로 조직 소속과 권한을 관리한다.

## 2. 범위

### In Scope

- 공개 회원가입 차단
- `sign-in` 중심 인증 플로우
- `Users` 페이지에서 관리자 `Add User` 기능
- Edge Function을 통한 초대 이메일 발송
- 전역 권한(`admin`/`user`) + 조직 역할(`org_role`) 기반 인가

### Out of Scope

- 소셜 로그인
- 공개 회원가입 페이지 운영
- 인증 외 비즈니스 기능 확장

## 3. 핵심 정책

### 가입 정책

- Self Sign-up 비활성화
- 관리자 초대 링크를 통한 최초 가입/비밀번호 설정만 허용

### 인증 정책

- 이메일/비밀번호만 허용
- 기본 라우트는 `sign-in`만 유지

### 권한 정책

- 전역 권한 컬럼 `system_role`: `admin` | `user`
- 조직 역할 컬럼 `org_role`: `owner` | `manager` | `member` | `viewer`
- 전역 관리자만 사용자 초대/관리 가능
- 조직 데이터 접근은 조직 소속 + 조직 역할로 제한

### 조직 중복 정책

- 조직도 상 중복 인원은 기본 소속을 WAKE로 지정
- 다중 소속은 허용하되 `is_primary=true`는 1개만 유지

## 4. 사용자 흐름

1. 관리자(`system_role=admin`)가 `Users` 페이지에서 `Add User` 실행
2. 이메일, 전역 권한, 조직, 조직 역할 입력 후 저장
3. Edge Function이 Supabase Admin API로 초대 메일 발송
4. 사용자가 초대 링크로 비밀번호 설정
5. 활성화 후 `sign-in`으로 로그인
6. 로그인 후 권한/소속 기반으로 메뉴 및 데이터 접근 제어

## 5. 데이터 모델 (초안)

### `profiles`

- `user_id` (PK, `auth.users.id` FK)
- `email`
- `display_name`
- `system_role` (`admin` | `user`)  // 전역 관리자/일반사용자 구분
- `status` (`invited` | `active` | `disabled`)
- `created_at`
- `updated_at`

### `organizations`

- `id`
- `name`
- `code` (`wake` | `sans` | `ansan`)
- `created_at`

### `organization_memberships`

- `id`
- `user_id` (FK)
- `organization_id` (FK)
- `org_role`
- `is_primary` (boolean)
- `invited_by`
- `invited_at`
- `accepted_at`

### `audit_logs`

- `id`
- `actor_user_id`
- `action`
- `target_user_id`
- `meta` (jsonb)
- `created_at`

## 6. 화면/기능 변경

### 인증 라우트

- `sign-up` 페이지는 제거 또는 `sign-in`으로 리다이렉트
- `sign-in` 페이지는 이메일/비밀번호 입력만 제공

### Users 페이지

- `Add User` 폼 필드
  - `email`
  - `system_role` (`admin` | `user`)
  - `organization`
  - `org_role`
- 목록 컬럼
  - 이메일
  - 전역 권한
  - 조직/조직 역할
  - 초대 상태(`pending`/`accepted`)

## 7. Supabase 구현 원칙 (MCP 기준)

- Auth에서 Self Sign-up 비활성화
- OAuth provider 비활성화
- Edge Function `invite-user` 생성
- 서비스 키는 Edge Function 서버 환경에서만 사용
- RLS는 최소 권한부터 적용

## 8. 인가 규칙 (RLS 방향)

- `admin`만 사용자 초대 API 호출 가능
- 일반 사용자는 본인 프로필 읽기/수정만 가능
- 조직 데이터는 `organization_memberships` 기반 접근만 허용
- 다중 소속 시 조회 범위는 소속 조직 집합으로 제한

## 9. 수용 기준 (Acceptance Criteria)

- [ ] 공개 회원가입이 차단된다.
- [ ] `system_role=admin`만 `Add User` 가능하다.
- [ ] Add User 시 초대 메일이 발송된다.
- [ ] 초대 링크를 통해서만 최초 가입/비밀번호 설정이 가능하다.
- [ ] 로그인은 이메일/비밀번호만 가능하다.
- [ ] `system_role` 기준으로 관리자 기능이 분리된다.
- [ ] `org_role` 기준으로 조직 데이터 접근이 분리된다.
- [ ] 중복 인원의 기본 소속이 WAKE로 반영된다.

## 10. 구현 TODO (다음 단계 입력용)

1. Supabase Auth 설정 변경 (Self Sign-up/OAuth 정책)
2. 테이블 생성 및 마이그레이션 작성
3. RLS 정책 작성
4. `invite-user` Edge Function 구현
5. Users 페이지 `Add User` 폼/목록 컬럼 확장
6. `sign-up` 제거/리다이렉트 처리
7. 통합 테스트 (초대 -> 가입 -> 로그인 -> 권한검증)

### SQL 마이그레이션 규칙

- 모든 SQL 파일은 `supabase/sql/`에 저장한다.
- 파일명은 숫자 누적형 `<순번>_<작업명>.sql`을 사용한다.
- 순번 예시: `01`, `02`, `100`, `1000`
- SQL 작성 직후 Supabase MCP로 즉시 적용한다.

## 11. Users 페이지 커스텀 디자인 설계 (기존 UI 재활용)

요청 경로: `http://localhost:3000/dashboard/users`

### 디자인 원칙

- 기존 Pull 받은 UI 컴포넌트를 최대한 재사용한다.
- 신규 컴포넌트는 최소화하고, 기존 폼/테이블 패턴 확장으로 해결한다.
- 권한 이슈 방지를 위해 입력 단계에서 조직/부서/권한을 명시적으로 분리한다.

### 재사용 대상 (현재 코드 기준)

- 페이지 컨테이너: `PageContainer`
- 등록 액션: `UserFormSheetTrigger`, `UserFormSheet`
- 폼 시스템: `useAppForm`, `useFormFields`
- 테이블 시스템: `DataTable`, `columns.tsx`, 기존 필터/정렬 패턴
- 배지/버튼/시트: shadcn 기본 컴포넌트

### Add User 시트 UI 변경안

현재 필드: 이름, 이메일, 전화, role, status  
확장 필드:

1. `system_role` (`admin` | `user`)
2. `organization` (예: WAKE, SANS, ANSAN)
3. `department` (조직 하위 부서, 조직 선택 후 종속 로딩)
4. `org_role` (`owner` | `manager` | `member` | `viewer`)
5. `status` (`Invited` 기본값 고정)

입력 순서(UX):

1. 기본정보(이름/이메일/전화)
2. 전역권한(`system_role`)
3. 조직(`organization`)
4. 부서(`department`)
5. 조직권한(`org_role`)
6. 저장(Add User + Invite)

### 조직-부서 종속 선택 규칙

- 조직 미선택 시 부서 드롭다운 비활성화
- 조직 선택 시 해당 조직 부서만 노출
- 조직 변경 시 부서 값 초기화
- 부서가 없는 조직은 `기타/공통` 선택지 제공

### 조직도 기반 부서 옵션(1차안)

- WAKE: 콘텐츠팀, 사업기획팀, 마케팅팀, 디자인팀, 구매물류팀, 인사팀, 회계팀
- SANS: 익선(본점), 신세계강남 스위트파크
- 안산공장: 생산팀, 품질팀, 공무팀, 지원팀, 물류팀

중복 인원 정책:

- 동일 인물이 다중 조직에 존재할 경우 기본 소속은 WAKE
- `organization_memberships.is_primary=true`는 WAKE에 우선 부여

### Users 목록 테이블 확장안

기존 컬럼에 아래 컬럼 추가:

- `system_role` (전역 권한 배지)
- `organization` (기본 소속 조직)
- `department` (기본 소속 부서)
- `org_role` (조직 권한 배지)
- `invite_status` (`pending` | `accepted` | `expired`)

필터 추가:

- 조직 필터
- 부서 필터
- 전역권한 필터(`admin`/`user`)
- 조직권한 필터

### 권한 충돌 방지 UI 규칙

- `system_role=admin`이 아닌 사용자는 `Add User` 버튼 숨김
- 관리자도 본인 `system_role`을 `user`로 변경 불가(락)
- 초대 보낸 뒤에는 조직/부서/권한 변경 시 재초대 확인 모달 표시

### 디자인 단계 수용 기준

- [ ] 기존 컴포넌트 재사용 범위가 문서에 명시되었다.
- [ ] Add User에 조직 하위 부서 선택 UX가 반영되었다.
- [ ] 조직-부서 종속 로직(비활성화/초기화)이 정의되었다.
- [ ] Users 테이블에 권한/조직/부서 컬럼 확장안이 정의되었다.
- [ ] 권한 충돌 방지 규칙이 명시되었다.
