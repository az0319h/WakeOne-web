# 사무실 간식 목록 페이지 Transfers 스타일 리디자인 기획서

> Date: 2026-06-09
> Status: Approved
> Author: planner
> 선행: `docs/plans/07_auth-route-guard-plan.md`, `docs/plans/08_activity-audit-log-plan.md`, `docs/plans/12_dashboard-skeleton-mobile-sheet-quality-plan.md`

## 한 줄 요약
`/dashboard/office-snacks` 목록 페이지를 shadcn fintech transfers 리스트와 높은 유사도로 리디자인하되, 오피스 스낵 도메인 규칙과 API/라우트/권한 계약은 변경하지 않는다.

## 목표 & 완료 기준

### 목표
- 목록 페이지의 정보 구조를 `탭 + 트랜잭션형 row` 중심으로 재구성해 가독성과 상태 인지를 높인다.
- 시각/인터랙션을 shadcn fintech transfers 레퍼런스에 high match 수준으로 맞춘다.
- 모바일 우선 품질에서 `keyboard focus`와 `tab readability`를 최우선으로 보장한다.

### 완료 기준
- 목록 페이지에 `진행중 / 예정 / 히스토리` 3탭이 제공되고 탭 전환에 따라 올바른 회차만 표시된다.
- 모든 row가 `상태 chip + 우측 정렬 핵심 정보` 구조를 따른다.
- empty/skeleton/error-retry/permission guidance 상태가 명시적으로 제공된다.
- `url_routes`, `vote_rules`, `session_rules`, `api_contract` 응답 형태는 유지한다.
- `auth_rules`는 **웨이크 소속 또는 admin** 접근 정책을 따른다 (아래 §인가).

## 범위 (In / Out)

### In Scope
- `/dashboard/office-snacks` 목록 페이지 IA/레이아웃 리디자인
- 3탭(진행중/예정/히스토리) 구조 및 탭 인터랙션 정비
- transfer-row 스타일의 세션 row 컴포넌트 구조 정비
- 목록 페이지 상태 UI(full spec) 정의 및 적용
- 접근성/모바일 개선(포커스, 탭 가독성)

### Out of Scope
- `/dashboard/office-snacks/[sessionId]` 상세 페이지 구조 변경
- 회차/후보/투표 비즈니스 규칙 변경
- DB 스키마 및 API contract 변경
- 투표·등록 비즈니스 규칙 변경

## 인가 (auth_rules)

| 대상 | 허용 | 거부 시 |
|------|------|---------|
| `/dashboard/office-snacks` 및 하위 경로 | `profiles.affiliation = wake` **또는** `system_role = admin` | `/dashboard/overview` + flash cookie 토스트 (쿼리 `accessDenied` 사용 금지 — RSC 루프 방지) |
| `/api/office-snacks/*` (일반 세션) | 동일 | HTTP **403** |
| nav `Office Snacks` | 동일 (UX 숨김) | — |
| admin 전용 mutation (회차 생성·수정·삭제) | `system_role = admin` (소속 무관) | HTTP **403** |

구현: `canAccessOfficeSnacks()` · middleware · `requireOfficeSnacksPage` · `requireOfficeSnacksSession` · `nav-config` `access.officeSnacks`

## 불변 조건 (Immutable Invariants)
- `auth_rules`: **웨이크 소속 또는 admin** (위 §인가)
- `url_routes`: `/dashboard/office-snacks`, `/dashboard/office-snacks/[sessionId]` 경로 유지
- `vote_rules`: 3순위 가중 투표 규칙 및 제출 제약 유지
- `session_rules`: 회차 상태/기간 계산 로직 유지
- `api_contract`: 기존 office-snacks API 요청/응답 계약 유지

## IA / Layout 상세 명세 (List Page Only)

### 페이지 구조
1. 상단 헤더: 기존 `PageContainer`의 title/description 유지
2. 우측 상단 CTA: admin 전용 `회차 생성` 버튼 위치 유지
3. 메인 컨텐츠:
   - 탭 바: `진행중 | 예정 | 히스토리`
   - 탭별 row list

### 탭 명세
- `진행중`: 등록중/투표중 상태 회차
- `예정`: upcoming 상태 회차
- `히스토리`: closed 상태 회차

### Transfer-Row Anatomy
- 좌측 블록
  - 1행: 회차 제목
  - 2행: 회차 상태 설명(기간/진행 요약)
- 중앙/보조
  - 상태 chip(예: 등록중, 투표중, 예정, 종료)
- 우측 정렬 블록
  - 핵심 정보(예: 생성일 또는 마감 기준 시각/요약 메타)
  - 모바일에서는 우선순위 높은 1~2개 정보만 노출
- row 인터랙션
  - row 전체 클릭/키보드 활성화 시 상세 페이지 이동

## 인터랙션 모델
- 탭 전환: 마우스/터치 + 키보드 포커스 이동 지원
- keyboard focus:
  - 탭 요소, row 링크 요소 모두 명확한 포커스 링 노출
  - 키보드 사용자 기준 탐색 순서가 헤더 → 탭 → 리스트 순으로 일관
- row action:
  - 기본 액션은 상세 이동
  - 권한 필요 액션은 admin 정책 유지(기존과 동일)

## 상태 UI Full Spec

### Empty
- 탭별 전용 empty 메시지 제공
- 진행중 탭 empty 시 admin에게 회차 생성 유도 문구 노출

### Skeleton
- 초기 로딩 및 탭 전환 중 transfer-row 형태 skeleton 표시
- 레이아웃 점프 최소화를 위해 row 높이/간격 고정

### Error + Retry
- 목록 조회 실패 시 에러 메시지 + 재시도 버튼 노출
- 재시도 액션은 기존 query 재호출 경로를 사용

### Permission Guidance
- 권한 없는 사용자는 제한 액션을 숨김/비활성 처리
- 사용자에게 이유를 안내하는 짧은 가이던스 문구 노출

## 구현 단계 (Minimal-Risk Phases)
1. **Phase A — 구조 전환**
   - 기존 섹션형 3카드 레이아웃을 탭 + 단일 리스트 구조로 변경
2. **Phase B — row 컴포넌트 정교화**
   - transfer-row anatomy 반영, 상태 chip/우측 정렬 정보 정착
3. **Phase C — 상태 UI 적용**
   - empty/skeleton/error-retry/permission guidance 분기 구현
4. **Phase D — 접근성/모바일 마감**
   - keyboard focus, 탭 가독성, 모바일 정보 축약 점검

## Playwright 검증 AC (Given / When / Then)

| AC | Given | When | Then |
|---|---|---|---|
| AC-LIST-01 | 목록 페이지 진입 | 초기 렌더 완료 | `진행중/예정/히스토리` 탭이 보인다. |
| AC-LIST-02 | 진행중/예정/히스토리 데이터가 각각 존재 | 각 탭 클릭 | 선택 탭 상태에 맞는 회차만 표시된다. |
| AC-LIST-03 | 임의의 회차 row 렌더됨 | row를 확인 | 상태 chip + 우측 정렬 핵심 정보 구조가 보인다. |
| AC-LIST-04 | 키보드 사용자 | Tab/Enter로 탐색 | 탭과 row 모두 포커스 가능하고 시각적 포커스가 확인된다. |
| AC-LIST-05 | 모바일 viewport | 탭 영역 확인 및 전환 | 탭 텍스트가 읽기 가능하고 전환 동작이 안정적이다. |
| AC-LIST-06 | 특정 탭에 데이터 0건 | 해당 탭 진입 | 탭 전용 empty 문구가 노출된다. |
| AC-LIST-07 | 네트워크 지연 | 목록 로딩 중 | transfer-row 형태 skeleton이 노출된다. |
| AC-LIST-08 | API 에러 발생 | 목록 조회 실패 | 에러 메시지와 재시도 버튼이 보이고, 재시도 시 재요청된다. |
| AC-LIST-09 | 일반 사용자 권한 | admin 전용 행위가 필요한 UI 확인 | 제한 액션이 숨김/비활성되고 안내 문구가 노출된다. |
| AC-LIST-10 | 리디자인 완료 | 기존 API/라우트/규칙 점검 | url/vote/session/api 계약 변경이 없다. |
| AC-AUTH-01 | `affiliation=sans` 일반 user 로그인 | `/dashboard/office-snacks` 직접 입력 | overview + `accessDenied=office-snacks` 토스트 |
| AC-AUTH-02 | `affiliation=wake` user 로그인 | `/dashboard/office-snacks` 진입 | 목록 페이지 정상 표시 |
| AC-AUTH-03 | admin (소속 무관) | `/dashboard/office-snacks` 진입 | 목록 페이지 정상 표시 |
| AC-AUTH-04 | sans user | 사이드바·kbar | Office Snacks 메뉴 미노출 |
| AC-AUTH-05 | sans user | `GET /api/office-snacks/sessions` | HTTP **403** |

## 리스크 & 완화
- HIGH: 레퍼런스 high match 과정에서 도메인 맥락 약화 가능  
  -> row 우측 핵심 정보 필드를 도메인 필수값 중심으로 고정
- MED: 탭 상태 분류 오동작 가능  
  -> 기존 상태 값(`registration/voting/upcoming/closed`) 매핑 재사용
- MED: 모바일 가독성 저하 가능  
  -> 우측 정보 우선순위 기반 축약 규칙을 사전 명시

## Activity Audit Log 연동
- activity log 해당 없음 (READ/UI 리디자인 중심, 신규 CUD 범위 없음)

## Handoff 요약

### /designer 에게
- `탭 + transfer-row` 고유사도 UI 구조를 우선 설계한다.
- 모바일에서 탭 라벨 가독성, 포커스 표시, 우측 정보 축약 규칙을 함께 확정한다.

### /backend-dev 에게
- 본 변경은 목록 UI 리디자인 중심으로 신규 API/DB 변경 없음.
- 기존 contract 불변 여부만 회귀 확인한다.

### /frontend-dev 에게
- 목록 페이지 컴포넌트 계층(`office-snacks-listing-client`, `sessions-list-sections`) 중심으로 구현한다.
- 탭 상태 분기와 full state UI, 접근성 보강을 반영한다.

### /verifier 에게
- AC-LIST-01~10 중심으로 Playwright 검증한다.
- 모바일/키보드 포커스/에러 재시도/권한 가이던스 포함 회귀 확인한다.

## 열린 질문 / TBD
- `[TBD]` 우측 정렬 핵심 정보의 최종 우선순위(생성일 vs 마감시각 vs 카운트)는 디자인 시안에서 확정

## 수정 이력
| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-08 | 최초 작성 (Approved) | planner |
| 2026-06-08 | 프리뷰 카드 보장/쿠팡 allowlist/수동입력 경로/Edge Function 정책 반영 | planner |
| 2026-06-08 | 자동 프리뷰·Edge Function Out, 수동 입력( URL·상품명·가격 필수, 이미지 URL 선택)로 정책 변경 | root |
| 2026-06-09 | 목록 페이지 전용 transfers 스타일 리디자인 범위로 재정의, 탭/row/상태 UI/불변 계약/AC 전면 갱신 | planner |
| 2026-06-09 | 인가: 웨이크 소속 또는 admin만 office-snacks 페이지·API·nav 접근 (AC-AUTH-01~05) | root |
