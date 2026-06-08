## 대시보드 스켈레톤·모바일 Sheet 접근성 품질 개선 기획서

> Date: 2026-06-08
> Status: Approved
> Author: planner

## 한 줄 요약
대시보드 전체/사용자 관리/프로필 영역에서 스켈레톤 누락과 모바일 Sheet CTA 접근성 문제를 우선순위 기반으로 점검·보강하기 위한 구현 전 기획이다.

## 확정 범위 및 우선순위

### 범위 (In)
- 대시보드 전체 (`/dashboard/*`)
- 사용자 관리 페이지 (`/dashboard/users`)
- 프로필 페이지 (`/dashboard/profile`)

### 제외 (Out)
- 신규 기능 추가
- 디자인 리뉴얼
- API/DB 스키마 변경
- 자동 E2E 시나리오 신규 작성

### 우선순위
1. 모바일 접근성 이슈 (CTA 도달 불가, 스크롤 불가) 우선
2. 사용자 영향도 높은 화면(Users/Profile) 우선
3. 이후 대시보드 전반으로 확장

## 선행 plan 참조 및 연계
- `06_users-profile-modal-plan.md`: Users/Profile 계열 시트 UI 흐름 참조
- `10_dashboard-birthday-profile-sheet-plan.md`: 대시보드 시트 기반 인터랙션 연계
- `08_activity-audit-log-plan.md`: CUD 정책 참고 (본 기획은 Read 품질 점검 중심)

## 적용 표준 패턴

### 스켈레톤 표준
- 비동기 Read 경로(RSC fetch, `useSuspenseQuery`, Suspense)가 있으면 로딩 상태 필수
- 공용 skeleton 우선 재사용:
  - `src/components/ui/table/data-table-skeleton.tsx`
  - `src/components/form-card-skeleton.tsx`
- 공용 재사용이 어려운 경우 feature 전용 `{Feature}Skeleton` 추가
- 초기 진입/필터 변경/느린 네트워크에서 과도한 레이아웃 점프 방지

### 모바일 Sheet 표준 (기준 구현: `/dashboard/users` 수정 시트)
- `SheetContent`: `flex flex-col`
- 본문 래퍼: `flex-1 overflow-auto`
- `SheetFooter`: 본문 스크롤 영역 바깥 고정 배치
- 금지: `SheetFooter`를 `form` 내부 끝에 배치해 모바일에서 CTA 접근이 어려워지는 구조

## AC (Acceptance Criteria)
- AC-01: 대상 화면 인벤토리가 확정되어 각 화면의 스켈레톤/모바일 점검 상태를 확인할 수 있다.
- AC-02: Users/Profile의 Sheet 기반 폼은 모바일에서 스크롤 가능하며 CTA 버튼이 항상 도달 가능하다.
- AC-03: 비동기 Read 경로가 있는 대상 화면은 공용 skeleton 재사용 또는 feature skeleton을 갖는다.
- AC-04: 공용/feature skeleton 적용 후 초기 진입 및 필터 변경 시 레이아웃 점프가 과도하지 않다.
- AC-05: 검증 수준 A(코드 기준 + 수동 체크리스트)로 Pass/Fail 판단이 가능하다.

## 점검 매트릭스 (화면 x 스켈레톤/모바일)

| 화면/영역 | 스켈레톤 점검 | 모바일 Sheet/CTA 점검 | 우선순위 |
|---|---|---|---|
| `/dashboard/users` | 목록/필터/비동기 read 경로 skeleton 여부 | 수정/초대 Sheet에서 스크롤·CTA 도달성 점검 | P0 |
| `/dashboard/profile` | 프로필 데이터 로딩 skeleton 여부 | 프로필 수정/비밀번호 Sheet의 footer 접근성 점검 | P0 |
| `/dashboard/overview` 및 하위 슬롯 | 슬롯별 loading/fallback 유무 및 일관성 | Sheet 사용 시 동일 패턴 적용 여부 점검 | P1 |
| `/dashboard/*` 기타 페이지 | 비동기 read 경로 중심 skeleton 누락 탐지 | Sheet 기반 UI 존재 시 동일 패턴 점검 | P2 |

## 검증 수준 A 체크리스트 (코드 기준 + 수동)

### 코드 기준 체크
- [ ] 대상 화면별 비동기 Read 경로 존재 여부를 식별했다.
- [ ] Read 경로에 `loading.tsx` 또는 `Suspense fallback`이 있다.
- [ ] 스켈레톤은 공용 컴포넌트를 우선 재사용했다.
- [ ] 공용 재사용이 어려운 경우 feature skeleton이 추가되었다.
- [ ] Sheet 폼은 `SheetContent flex flex-col` + 본문 `flex-1 overflow-auto` + `SheetFooter` 바깥 배치를 따른다.

### 수동 체크 (모바일/느린 네트워크 포함)
- [ ] 모바일 뷰포트에서 Sheet 본문이 실제로 스크롤된다.
- [ ] 모바일 뷰포트에서 하단 CTA(저장/확인)가 항상 보이거나 도달 가능하다.
- [ ] 초기 진입 시 빈 화면/깜빡임 대신 skeleton이 먼저 노출된다.
- [ ] 필터 변경/재조회 시 skeleton 전환이 자연스럽고 레이아웃 점프가 과도하지 않다.

## 실행 순서 (구현 단계 전달용)
1. P0: `/dashboard/users`, `/dashboard/profile` 우선 점검·보강
2. P1: `/dashboard/overview` 및 병렬 슬롯 일관성 정리
3. P2: 대시보드 기타 화면으로 확대 적용

## 활동 감사 로그
activity log 해당 없음 (본 기획 범위는 Read 품질 점검/보강 중심).

## 열린 질문
- [TBD] 대시보드 기타 페이지 중 우선 사용자 트래픽 상위 페이지 확정(Phase 구현 시작 전)

## 수정 이력
| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-08 | 최초 작성 (Approved) | planner |
