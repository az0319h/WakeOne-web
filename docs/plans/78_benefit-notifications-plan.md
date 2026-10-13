# 복지비 등록·취소·복구 인앱 알림 기획서

> Date: 2026-10-13
> Status: Approved
> Author: planner
> **SQL 예정:** `77` · `supabase/sql/77_notifications_benefit_types.sql` (현재 실제 최대 `76`, 구현 시 재확인)
> **선행:** [08](./08_activity-audit-log-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [29](./29_profile-name-live-display-plan.md), [47](./47_contract-import-notifications-plan.md), [49](./49_live-users-presence-plan.md), [59](./59_google-auth-admin-notif-activity-log-result-plan.md), [76](./76_hr-benefits-manager-access-plan.md), [77](./77_benefit-document-manual-cancel-plan.md)

## 한 줄 요약

도서·체력증진·외부교육 복지비가 외부 API로 신규 등록되거나 관리자·Wake HR에 의해 수동 취소·복구되면, 이벤트 시점의 active admin·active Wake HR·신청자를 `user_id`로 중복 제거해 행별 Realtime 인앱 알림을 발송한다.

---

## 선행 plan 참조와 관계

| Plan | Status | 관계 |
|------|--------|------|
| **08** | Approved | 기존 import·취소·복구 CUD Route의 모든 응답 분기 activity log와 `x-request-id`를 유지한다. 파생 notification INSERT는 별도 activity log를 만들지 않는다. |
| **27** | Approved | `notifications` 테이블, 수신자별 Realtime INSERT 구독, 조회·읽음 처리, 타입별 CTA 구조를 재사용한다. |
| **29** | Approved | 과거 notification row를 live 이름으로 수정하지 않는다. title/body는 이벤트 시점 스냅샷으로 유지한다. |
| **47** | Approved | 외부 import 성공 시 운영/개인 타입 분리, active 수신자 fan-out, duplicate·failed skip, best-effort 오류 격리 패턴을 재사용한다. |
| **49** | Approved | 신규 dashboard 페이지가 없으며 기존 `/dashboard/*` 화면은 `dashboard/layout`의 `DashboardPresenceTrack`을 그대로 상속한다. 별도 presence 코드는 추가하지 않는다. |
| **59** | Completed | active admin bulk fan-out, 기존 알림 UI·Realtime 재사용, notification INSERT activity log Out 원칙을 따른다. |
| **76** | Completed | Wake HR은 `system_role=user AND affiliation=wake AND rank=인사팀`이며 active 상태인 경우에만 운영 알림 대상이다. |
| **77** | Completed | UI·API 동작은 물리 삭제/활성화가 아니라 수동 **취소/복구**다. 취소 건 재import는 duplicate이며 자동 복구하지 않는다. |

**관계:** 기존 복지비 import와 plan 77 취소·복구에 파생 알림만 추가하는 확장 plan이다. 복지비 원장·합계·한도·취소 상태 의미는 변경하지 않는다.

---

## 목표

- 외부 API의 신규 복지비 등록을 운영 담당자와 신청자가 즉시 확인한다.
- 수동 취소·복구를 신청자와 모든 운영 담당자가 동일한 이벤트 스냅샷으로 확인한다.
- actor가 신청자 또는 운영 수신자와 겹쳐도 누락 없이 한 사람당 한 건만 생성한다.
- 알림 실패가 복지비 원장 mutation과 기존 HTTP 응답을 훼손하지 않게 한다.
- 기존 Notification Center·목록·Realtime·읽음 처리·절대 시각 UI를 그대로 활용한다.

---

## 정책 확정안

### 이벤트

| 이벤트 | 알림 조건 | 알림 제외 |
|--------|-----------|-----------|
| 외부 등록 | `POST /api/benefits/import` 결과가 `status='created'` | duplicate, JSON/Zod validation, 이름 미매칭·동명이인, 인증 실패, 서버 오류 |
| 수동 취소 | `PATCH /api/benefits/documents/[id]/cancel` 200 성공 | 4xx/5xx, 이미 취소됨 |
| 수동 복구 | `PATCH /api/benefits/documents/[id]/restore` 200 성공 | 4xx/5xx, 취소되지 않은 문서 |

- `book`, `fitness`, `education` 모두 In.
- 외부 API에서 생성된 **행마다** 알림을 만들며 여러 행을 한 알림으로 묶지 않는다.
- 채널은 인앱 Realtime만 사용하고 이메일·push·SMS는 발송하지 않는다.

### 유형 라벨

| `benefit_type` | `{유형명}` |
|----------------|------------|
| `book` | `도서` |
| `fitness` | `체력증진` |
| `education` | `외부교육` |

### 수신자 스냅샷·중복 정책

1. 이벤트 시점의 `profiles.system_role='admin' AND status='active'` 전원
2. 이벤트 시점의 `profiles.system_role='user' AND affiliation='wake' AND rank='인사팀' AND status='active'` 전원
3. 해당 `benefit_documents.applicant_user_id`
4. 위 집합을 `user_id` 기준으로 dedupe
5. actor도 수신 집합에서 제외하지 않음
6. 신청자가 운영 수신자이기도 하면 **운영 알림 1건만** 생성하며 운영 카피·CTA가 우선
7. 이후 role/status가 변경되어도 기존 notification row는 유지

예시:

- 홍성훈이 김민정의 체력증진 건을 취소하면 홍성훈을 포함한 active admin·Wake HR은 운영 카피를, 일반 신청자 김민정은 신청자 카피를 받는다.
- Wake HR 김아영이 본인 외부교육 건을 취소하면 김아영은 운영·신청자 집합에 모두 속하지만 운영 우선 알림 1건만 받으며 본문은 `김아영님이 본인의 ...` 형식이다.

---

## 알림 카피·CTA

### 전체 카피 매트릭스

| 이벤트 | 대상 | title | body | CTA |
|--------|------|-------|------|-----|
| 외부 등록 | 운영 | `{유형명} 신청이 등록되었습니다` | `{신청자명}님의 {유형명} 신청(문서번호 {document_number})이 Gmail/Flex에서 등록되었습니다.` | `복지비 관리` → `/dashboard/benefits` |
| 외부 등록 | 신청자 | `{유형명} 신청이 등록되었습니다` | `회원님의 {유형명} 신청(문서번호 {document_number})이 등록되었습니다.` | `내 복지비 보기` → `/dashboard/my-benefits` |
| 수동 취소 | 운영·actor≠applicant | `{유형명} 신청이 취소되었습니다` | `{actor명}님이 {신청자명}님의 {유형명} 신청(문서번호 {document_number})을 취소했습니다.` | `복지비 관리` → `/dashboard/benefits` |
| 수동 취소 | 운영·actor=applicant | `{유형명} 신청이 취소되었습니다` | `{actor명}님이 본인의 {유형명} 신청(문서번호 {document_number})을 취소했습니다.` | `복지비 관리` → `/dashboard/benefits` |
| 수동 취소 | 신청자 | `{유형명} 신청이 취소되었습니다` | `회원님의 {유형명} 신청(문서번호 {document_number})이 취소되었습니다.` | `내 복지비 보기` → `/dashboard/my-benefits` |
| 수동 복구 | 운영·actor≠applicant | `{유형명} 신청이 복구되었습니다` | `{actor명}님이 {신청자명}님의 {유형명} 신청(문서번호 {document_number})을 복구했습니다.` | `복지비 관리` → `/dashboard/benefits` |
| 수동 복구 | 운영·actor=applicant | `{유형명} 신청이 복구되었습니다` | `{actor명}님이 본인의 {유형명} 신청(문서번호 {document_number})을 복구했습니다.` | `복지비 관리` → `/dashboard/benefits` |
| 수동 복구 | 신청자 | `{유형명} 신청이 복구되었습니다` | `회원님의 {유형명} 신청(문서번호 {document_number})이 복구되었습니다.` | `내 복지비 보기` → `/dashboard/my-benefits` |

### 구체 예시

| 유형 | 예시 |
|------|------|
| 도서 | `이민호님의 도서 신청(문서번호 BEN-BOOK-101)이 Gmail/Flex에서 등록되었습니다.` |
| 체력증진 | `홍성훈님이 김민정님의 체력증진 신청(문서번호 BEN-FIT-102)을 취소했습니다.` |
| 외부교육 | `김아영님이 본인의 외부교육 신청(문서번호 BEN-EDU-103)을 복구했습니다.` |

**정보 정책:** 문서번호는 포함한다. 금액·이메일·원문 URL·token 및 기타 민감 정보는 title/body/metadata에 포함하지 않는다. 신청자·actor 이름은 운영 body의 이벤트 스냅샷으로만 저장하며 metadata에는 저장하지 않는다.

---

## 알림 타입·metadata

### 타입 6종

- `benefit.import_operations`
- `benefit.import_applicant`
- `benefit.document_cancel_operations`
- `benefit.document_cancel_applicant`
- `benefit.document_restore_operations`
- `benefit.document_restore_applicant`

### metadata allowlist

| 키 | 적용 | 비고 |
|----|------|------|
| `kind` | 전체 | 위 notification type과 동일 |
| `benefit_document_id` | 전체 | DB 식별자 |
| `document_number` | 전체 | CTA·검증용 문서번호 |
| `benefit_type` | 전체 | `book` / `fitness` / `education` |
| `applicant_user_id` | 전체 | 수신자 dedupe·검증 |
| `actor_user_id` | 취소·복구만 | import system actor에는 저장하지 않음 |

**금지:** 신청자명·actor명, amount, email, `source_document_url`, `source_message_id`, 인증 token, 외부 payload 전체.

---

## 목표 & 완료 기준 (Given-When-Then AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API/Playwright | active admin·Wake HR·일반 신청자와 `book` 신규 payload | 외부 import 성공 | HTTP 201, 운영 수신자는 `benefit.import_operations`, 신청자는 `benefit.import_applicant` 각 1건; title/body에 `도서`·문서번호; 각 CTA가 권한별 경로로 이동 |
| AC-02 | API/Playwright | AC-01과 동일한 `fitness` 신규 payload | 외부 import 성공 | 운영·신청자 각 1건; title/body에 `체력증진`·문서번호; CTA 정상 |
| AC-03 | API/Playwright | AC-01과 동일한 `education` 신규 payload | 외부 import 성공 | 운영·신청자 각 1건; title/body에 `외부교육`·문서번호; CTA 정상 |
| AC-04 | API | 이미 존재하는 document_number 또는 task_key | 외부 import 재호출 | HTTP 200 duplicate, 신규 benefit notification 0건, 취소 상태 자동 복구 없음 |
| AC-05 | API | 잘못된 JSON 또는 Zod validation payload | 외부 import | 기존 400 응답·`benefit.import_failed` log 유지, notification 0건 |
| AC-06 | API | applicant_name 미매칭 또는 동명이인 | 외부 import | 기존 422 응답·실패 log 유지, notification 0건 |
| AC-07 | API | import service 내부 오류 환경 | 외부 import | 기존 500 응답·실패 log 유지, notification 0건 |
| AC-08 | API/Playwright | admin 홍성훈, 일반 신청자 김민정, 활성 문서 | 홍성훈이 문서를 수동 취소 | 200, 모든 active 운영 수신자와 김민정에게 각 1건; 운영 body `홍성훈님이 김민정님의 ... 취소했습니다.`; 신청자 body는 actor 미표시 |
| AC-09 | API/Playwright | Wake HR actor, 다른 일반 신청자의 취소 문서 | HR이 문서를 수동 복구 | 200, 모든 active 운영 수신자와 신청자에게 각 1건; 운영 body에 actor·신청자·유형·문서번호 |
| AC-10 | API/Playwright | Wake HR 김아영이 본인 문서의 신청자이며 운영 수신자 | 김아영이 본인 문서 취소 | 김아영에게 중복 없이 `benefit.document_cancel_operations` 1건; body `김아영님이 본인의 ... 취소했습니다.`; 운영 CTA만 표시 |
| AC-11 | API | active admin·active Wake HR·inactive admin·inactive Wake HR·active non-HR user가 존재 | 등록·취소·복구 각 이벤트 발생 | operations 알림은 active admin·active Wake HR에게만 생성; inactive와 non-HR user 제외 |
| AC-12 | API | 신청자가 active admin 또는 active Wake HR이지만 actor는 다른 운영자 | 취소 또는 복구 성공 | 해당 신청자에게 operations 우선 알림 1건만 생성되고 applicant 타입 중복 없음 |
| AC-13 | API/DB | notification INSERT가 실패하도록 격리 | 신규 import 성공 | import HTTP 201과 benefit_documents 생성 유지; 알림 행 없음; 서버 오류 로그만 남음 |
| AC-14 | API/DB | notification INSERT 실패 환경과 활성 문서 | 취소 성공 | HTTP 200과 `cancelled_at` 변경 유지; 알림 실패가 응답·원장 변경을 롤백하지 않음 |
| AC-15 | API/DB | notification INSERT 실패 환경과 취소 문서 | 복구 성공 | HTTP 200과 `cancelled_at=null` 유지; 알림 실패가 응답·원장 변경을 롤백하지 않음 |
| AC-16 | Playwright | 수신자 로그인 상태, 신규 benefit notification | 이벤트 발생 후 헤더 벨과 `/dashboard/notifications` 확인 | 기존 Realtime INSERT 구독으로 badge·카드가 새로고침 없이 갱신되고 절대 시각 `yyyy-MM-dd (EEE) HH:mm:ss` 표시 |
| AC-17 | Playwright | operations 타입 알림 | `복지비 관리` 클릭 | `/dashboard/benefits` 이동; applicant 타입 `내 복지비 보기` 클릭 시 `/dashboard/my-benefits` 이동 |
| AC-18 | grep/mock | import·취소·복구 성공 | 전체 실행 경로 검사 | 이메일 client·send 함수 호출 0건; in-app notification INSERT만 수행 |
| AC-19 | API/로그 | 신규 import 성공·duplicate·실패 | 응답의 `x-request-id`로 activity log 조회 | 기존 `benefit.import_create|duplicate|failed` action과 HTTP status 유지; notification INSERT용 추가 action 없음 |
| AC-20 | API/로그 | 취소·복구 성공 및 기존 오류 분기 | `x-request-id`로 activity log 조회 | 기존 `benefit.document_cancel|restore` action 유지; Route의 기존 2xx/4xx/5xx 기록 정책 회귀 없음; notification INSERT용 추가 action 없음 |
| AC-21 | DB/코드 | SQL 77 적용 | 6개 신규 type과 임의 미등록 type INSERT 시도 | 6개 타입 허용, 미등록 타입 CHECK 거부; metadata에 allowlist 외 민감 키와 amount 없음 |
| AC-22 | 코드/Playwright | 신규 dashboard page 없음 | `/dashboard/benefits`, `/dashboard/my-benefits`, `/dashboard/notifications` 사용 | 기존 `dashboard/layout`의 `DashboardPresenceTrack` 상속; 별도 presence track 없음 |
| AC-23 | CLI/cleanup | E2E 완료 | 관련 spec 후 `npm run e2e:cleanup` 및 정적·빌드 검증 | cleanup exit 0, `remaining.users=0`, `remaining.profiles_e2e=0`; 생성 benefit_documents·notifications fixture도 지원되는 helper/RPC로 제거; `bunx playwright test e2e/benefits/`, `npx tsc --noEmit`, lint, react-doctor, build 모두 통과 |

**Playwright 셀렉터:** `getByRole`, `getByPlaceholder`, `getByTestId`만 사용한다. 픽셀 검증은 하지 않는다. API/DB 검증과 브라우저 CTA·Realtime 검증을 분리한다.

---

## 범위

### In Scope

| 영역 | 내용 |
|------|------|
| DB | 최신 실제 SQL 최대 `76` 다음인 SQL `77`로 `notifications.type` CHECK에 6종 additive 추가 |
| BE 수신자 | active admin + active Wake HR 조회 helper, applicant 합집합, `user_id` dedupe, operations 우선 map |
| BE fan-out | import created, cancel 200, restore 200 직후 이벤트별 rows 생성·best-effort INSERT |
| BE 카피 | 유형 라벨·actor/applicant 관계에 따른 title/body builder |
| FE 타입 | `NotificationType`, metadata allowlist 확장 |
| FE CTA | operations `복지비 관리`, applicant `내 복지비 보기` |
| 회귀 | 기존 Notification Center·목록·읽음·Realtime·절대 시각·admin viewer 유지 |
| 감사 | 기존 benefit activity action·전 분기·`x-request-id` 유지 |
| 검증 | API/DB specs, Playwright CLI, cleanup, tsc/lint/react-doctor/build |

### Out of Scope

- 복지비 원장·월 합계·한도·차트 계산 변경
- 취소를 물리 DELETE로 변경하거나 복구를 “활성화”로 변경
- duplicate import의 자동 복구 또는 알림
- validation·이름 매칭·서버 실패 운영 알림
- 이메일·push·SMS·Slack 발송
- 알림 배치 요약, 재시도 queue, dead-letter, 재발송 UI
- 신규 dashboard page·새 알림 카드 레이아웃·새 Realtime channel
- notification INSERT 자체의 activity log action
- 과거 notification title/body/수신자 재계산·UPDATE
- 금액·이메일·URL·token·원문 payload 저장

---

## DB / API / Service 요구사항

### SQL `77_notifications_benefit_types.sql` 예정

- 실제 `supabase/sql/` 최대 접두는 Phase 3 조사 시점 `76`.
- 기존 허용 타입 전체를 보존한 채 6개 신규 타입을 CHECK에 additive 추가한다.
- notifications RLS·인덱스·Realtime publication은 변경하지 않는다.
- SQL은 backend-dev 단계에서 작성·적용하며 본 plan 단계에서는 생성하지 않는다.

### fan-out

`src/features/notifications/api/fan-out.server.ts`에 다음 책임을 추가한다.

1. `listActiveBenefitOperationsUserIds()`:
   - active admin
   - active Wake HR (`system_role=user`, `affiliation=wake`, `rank=인사팀`)
2. 이벤트 입력에서 applicant·actor·문서·유형 정보를 수신한다.
3. `Map<user_id, audience>`를 구성하며 operations가 applicant보다 우선한다.
4. 동일 user에는 한 이벤트당 notification row 한 건만 만든다.
5. 한 import row마다 독립 fan-out한다.
6. service-role bulk INSERT를 사용한다.
7. 오류는 throw하고 Route에서 독립 `try/catch`로 격리한다.

### Route 연결

| Route | 기존 결과 | fan-out 지점 |
|-------|-----------|--------------|
| `POST /api/benefits/import` | `created` 201 | document와 import event 저장 성공 후, 응답 직전 |
| `POST /api/benefits/import` | duplicate 200 / error | 호출하지 않음 |
| `PATCH /api/benefits/documents/[id]/cancel` | 200 | `cancelBenefitDocument` 성공 후, 응답 직전 |
| `PATCH /api/benefits/documents/[id]/restore` | 200 | `restoreBenefitDocument` 성공 후, 응답 직전 |

fan-out 실패는 구조화된 서버 오류 로그만 남기고 기존 HTTP body/status와 DB 변경을 유지한다. 이름·금액·payload 전체를 서버 로그에 출력하지 않는다.

---

## FE / Realtime 요구사항

- 신규 페이지·폼·Dialog는 없다.
- `src/features/notifications/api/types.ts`에 type·metadata만 확장한다.
- `notification-helpers.ts`에 다음 action을 추가한다.
  - `view-benefits` → `복지비 관리` → `/dashboard/benefits`
  - `view-my-benefits` → `내 복지비 보기` → `/dashboard/my-benefits`
- 기존 `NotificationCard`, Notification Center, `/dashboard/notifications`, 읽음 optimistic mutation을 재사용한다.
- 기존 `NotificationsRealtime`은 수신자별 `notifications` INSERT 전체에 반응하므로 type별 구독 변경이나 신규 channel이 필요 없다.
- timestamp는 기존 `formatAbsoluteDateTimeKo` 절대 시각을 유지한다.
- 신규 `/dashboard/*` route가 없어 plan 49 presence 구현 변경은 없다.

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

### 기존 action 유지

| Route | action | 기록 분기 |
|-------|--------|-----------|
| `POST /api/benefits/import` | `benefit.import_create` | created 201 |
| `POST /api/benefits/import` | `benefit.import_duplicate` | duplicate 200 |
| `POST /api/benefits/import` | `benefit.import_failed` | 401 · 400 · 422 · 500 등 기존 실패 분기 |
| `PATCH .../[id]/cancel` | `benefit.document_cancel` | 기존 인증·검증·404·409·200·오류 분기 |
| `PATCH .../[id]/restore` | `benefit.document_restore` | 기존 인증·검증·404·409·200·오류 분기 |

- 각 mutation의 기존 `requestId`와 응답 `x-request-id`를 유지한다.
- 구현 시 cancel/restore 인증 실패를 포함한 모든 실제 return 분기가 기존 action으로 기록되는지 재검증하고, 누락이 있으면 동일 action으로 보완한다.
- notification INSERT는 원 mutation에서 파생된 전달 데이터이므로 별도 `ActivityAction`을 추가하지 않는다.
- fan-out 실패를 원 mutation 실패 action으로 바꾸지 않는다.
- AC-19~20에서 원 action 1건과 notification 전용 action 부재를 확인한다.

---

## 영향 파일

| 파일 | 변경 |
|------|------|
| `supabase/sql/77_notifications_benefit_types.sql` | 구현 시 신규; 6개 type CHECK |
| `src/features/notifications/api/types.ts` | type·metadata |
| `src/features/notifications/api/fan-out.server.ts` | operations 조회·dedupe·카피·fan-out |
| `src/features/notifications/components/notification-helpers.ts` | CTA 2종 |
| `src/app/api/benefits/import/route.ts` | created-only best-effort 호출 |
| `src/app/api/benefits/documents/[id]/cancel/route.ts` | 200 후 best-effort 호출 |
| `src/app/api/benefits/documents/[id]/restore/route.ts` | 200 후 best-effort 호출 |
| `e2e/benefits/benefit-notifications.api.spec.ts` | API/DB·수신자·오류 격리·로그 |
| `e2e/benefits/benefit-notifications.spec.ts` | Realtime·카피·CTA |
| `e2e/helpers/*` 또는 cleanup SQL/RPC | fixture 생성·정리 지원 범위 내 확장 |

확인만 하고 변경하지 않는 파일:

- `src/features/notifications/components/notifications-realtime.tsx` — type 무관 INSERT invalidate 재사용
- `src/components/ui/notification-card.tsx` — 기존 카드·절대 시각 재사용
- `src/features/benefits/api/service.server.ts` — applicant_user_id·취소/복구 결과 source; 필요 시 fan-out 입력 전달을 위한 최소 타입 변경만 허용
- `src/features/auth/api/benefits-access.server.ts` — Wake HR 판별 기준 source

---

## 구현 순서

1. SQL 77에서 기존 type 전체 + 신규 6종 CHECK 작성·적용
2. TypeScript notification type·metadata·복지 유형 라벨 계약 확장
3. active operations 조회와 operations-priority dedupe map 구현
4. 이벤트·대상별 카피 builder와 bulk fan-out 구현
5. import created-only 연결 및 duplicate/error skip
6. cancel/restore 200 연결, actor=self 자연어 분기
7. CTA helper 연결
8. API/DB specs로 타입·수신자·dedupe·best-effort·activity log 검증
9. Playwright로 Realtime·카드·카피·CTA 검증
10. cleanup → tsc → lint → react-doctor → build

**Checkpoint:** Step 4 완료 후 도서 import 1건과 HR 본인 취소 1건을 API/DB로 검증한 뒤 Route 전체 연결을 진행한다.

---

## 리스크와 완화

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 신청자가 operations에도 속해 알림·CTA가 중복됨 | 단일 `Map<user_id, audience>`와 operations 우선 규칙, AC-10·12 |
| HIGH | fan-out 오류가 import·취소·복구를 실패/롤백시킴 | 원 mutation 성공 후 독립 try/catch, AC-13~15 |
| HIGH | SQL CHECK 기존 타입 누락으로 다른 도메인 알림 실패 | 최신 SQL 57 전체 enum을 기준으로 additive migration, 기존 타입 회귀 INSERT |
| HIGH | duplicate/error 경로에서 잘못된 알림 생성 | import `status==='created'` 성공 분기 안에서만 호출, AC-04~07 |
| MED | 이벤트 도중 role/status 변경으로 수신자 불일치 | fan-out 시작 시 active operations snapshot 1회 조회 |
| MED | actor/applicant 이름이 metadata·로그에 중복 노출 | 이름은 operations body 스냅샷만; metadata allowlist와 구조화 오류 로그 |
| MED | Route auth 분기 activity log 회귀 | 기존 helper 유지, 전 return branch API 검증, AC-19~20 |
| LOW | 한 줄 카드에서 긴 body가 잘림 | title에 이벤트·유형, body 앞부분에 핵심 이름·문서번호 유지; 픽셀 확장 Out |

---

## 롤백

1. 세 benefit Route의 fan-out 호출을 제거해 기존 mutation-only 동작으로 복귀한다.
2. notification type·CTA·fan-out helper를 제거한다.
3. SQL 77 타입 허용은 기존 기능에 영향을 주지 않으므로 우선 유지할 수 있다.
4. CHECK 완전 복구가 필요하면 신규 6종 notification fixture/운영 행의 보존·정리 정책을 먼저 확정한 뒤 이전 허용 타입 목록으로 되돌린다.
5. 이미 저장된 benefit_documents와 기존 activity_logs는 변경하거나 삭제하지 않는다.

---

## 추정

- 범위: 제품 코드 약 7~9파일 + SQL 1파일 + E2E/helper 약 3~5파일
- 예상 변경량: 약 250~400 LOC
- 복잡도: **Medium**
- 예상 시간: **약 4~6시간**
- 체크포인트: fan-out helper + 2개 대표 API 검증 완료 시점

---

## requirements-pipeline Express 요약

### Scoping

- 단일 기능: 복지비 등록·취소·복구 인앱 알림
- 기존 복지비 mutation과 notifications 플랫폼을 연결한다.
- 신규 UI 화면이나 외부 메시징 채널은 만들지 않는다.

### 핵심 가정

| ID | 가정 |
|----|------|
| A1 | import 성공 문서는 기존 로직에서 유일한 active applicant의 `applicant_user_id`를 가진다. |
| A2 | 알림은 이벤트 시점 snapshot이며 이후 role/status/name 변경으로 과거 row를 수정하지 않는다. |
| A3 | operations와 applicant가 겹치면 operations 정보가 더 풍부하므로 operations 알림이 우선한다. |
| A4 | 기존 NotificationsRealtime은 type을 필터하지 않아 신규 type도 자동 invalidate한다. |
| A5 | 알림 delivery 실패는 원장 mutation 실패가 아니며 서버 로그로 관찰한다. |

### 우선순위

- Must: 세 이벤트, 세 복지 유형, operations+applicant, dedupe·actor 포함
- Must: duplicate/error skip, amount·민감 정보 제외, best-effort
- Must: 기존 activity log·Realtime·CTA·cleanup 회귀 검증
- Won't: 이메일, batch, retry queue, 신규 page, 실패 알림

---

## 열린 질문

없음. Phase 1 인터뷰와 Phase 2 battle-plan에서 카피·수신자·오류 정책을 확정하고 사용자 `go` 승인을 받았다.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|-----------|--------|
| 2026-10-13 | 최초 작성 — 복지비 3유형 등록·취소·복구 operations+applicant Realtime 알림 | planner |
