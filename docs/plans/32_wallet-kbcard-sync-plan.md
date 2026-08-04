# KB카드 지갑 동기화 인앱 알림 기획서

> Date: 2026-08-04
> Status: Approved
> Author: planner
> **기존 SQL:** `37` · `supabase/sql/37_wallet_limit_sync.sql` (`Plan: 32_wallet-kbcard-sync-plan.md (예정)` 참조 존재)
> **신규 SQL:** `38` · `supabase/sql/38_notifications_wallet_sync_types.sql` (구현 시)
> **선행:** [08](./08_activity-audit-log-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [28](./28_contract-reminder-notifications-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **08** | CUD Route의 `recordActivityLog` 정책. 기존 wallet sync의 `wallet.sync_create` / `wallet.sync_failed`를 유지하고 notification INSERT는 파생 데이터이므로 별도 로그를 만들지 않는다. |
| **27** | `notifications` 테이블, service-role INSERT, 수신자별 Realtime INSERT 구독, 타입별 CTA 구조를 재사용한다. |
| **28** | `listActiveAdminUserIds()`와 active admin bulk fan-out 패턴을 재사용·확장한다. |

**관계:** plan 27·28의 인앱 알림 플랫폼을 KB카드 지갑 동기화 도메인으로 확장하는 신규 plan이다.
**중복 금지:** `wallet_syncs`는 지갑 스냅샷 원장, `notifications`는 사용자 안내, `activity_logs`는 감사 기록으로 역할을 분리한다.

---

## 한 줄 요약

KB카드 지갑 동기화에서 한 명 이상이 사용자와 매칭되어 지갑 행이 저장되면 모든 active admin에게 동기화 요약 알림 1건씩, 고유 matched 사용자에게 개인 알림 1건씩을 단일 bulk fan-out하며, 알림 실패는 지갑 저장과 HTTP 성공 응답에 영향을 주지 않는다.

---

## 목표 & 완료 기준

### 목표

- 지갑 동기화 성공 사실을 모든 active admin에게 빠짐없이 안내한다.
- 실제로 `wallet_syncs` matched 행이 저장된 각 일반 사용자에게 본인 지갑 갱신 사실을 안내한다.
- 중복 payload, unmatched, 알림 저장 실패가 지갑 원장과 응답 안정성을 훼손하지 않게 한다.
- 기존 notifications 조회·읽음·Realtime UI를 변경 없이 활용한다.

### Given-When-Then AC

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API/DB | active admin A·B, matched 일반 사용자 C·D가 존재 | 유효한 token으로 `POST /api/wallet/sync`가 C·D를 포함해 성공 | HTTP 200, `wallet_syncs` matched 행 저장, A·B 각각 `wallet.sync_admin` 1건, C·D 각각 `wallet.sync_recipient` 1건 |
| AC-02 | API/DB | 한 payload의 복수 항목이 같은 `user_id`로 matched | 동기화가 성공 | 해당 사용자의 matched 원장 행은 입력대로 저장되지만 개인 알림은 동기화 1회당 1건만 생성 |
| AC-03 | API/DB | 모든 입력이 unmatched | 동기화 API 호출 | HTTP 응답의 `matched=0`, 관리자·사용자 지갑 알림 모두 0건 |
| AC-04 | DB | active admin A와 inactive admin B가 존재 | `matched>=1` 동기화 성공 | A에게 관리자 요약 알림 1건, B에게 신규 알림 없음 |
| AC-05 | DB | 지갑 알림이 생성됨 | notification title/body/metadata 조회 | 한도·잔여 금액과 사용자 이름이 어느 필드에도 포함되지 않음 |
| AC-06 | API/DB/서버 로그 | notification bulk INSERT가 실패하도록 격리된 검증 환경 구성 | wallet sync 호출 | `wallet_syncs` 저장과 HTTP 200 유지, notification 신규 행 없음, 서버 오류 로그에 `requestId`와 수신자 건수만 기록 |
| AC-07 | DB | SQL 38 적용 | `wallet.sync_admin`, `wallet.sync_recipient` 타입 INSERT 및 임의 타입 INSERT 시도 | 신규 2종은 허용되고 미등록 타입은 CHECK 위반 |
| AC-08 | API/DB | 정상 동기화와 fan-out 성공 | 동일 `request_id`의 `activity_logs` 조회 | 기존 `wallet.sync_create` 성공 로그 1건만 존재하고 notification INSERT용 추가 activity log 없음 |
| AC-09 | 코드/API | 신규 타입 notification이 수신자에게 INSERT | 기존 `NotificationsRealtime`이 해당 수신자의 INSERT 이벤트 처리 | 타입과 무관하게 notification query invalidate 경로를 재사용하며 조회 API에서 신규 알림 확인 가능 |
| AC-10 | API/DB | admin과 일반 사용자가 알림을 조회 | 기존 `GET /api/notifications` 호출 | 기존 RLS·API 권한에 따라 본인 알림이 반환되고 admin viewer 동작 회귀 없음 |
| AC-11 | CLI | 구현 완료 | `npx tsc --noEmit`, `npm run lint:strict`, `npm run build` 실행 | 모두 성공 |

### 검증 제약

- **E2E/Playwright spec 작성 및 실행은 Out** — 사용자의 명시적 제약이다.
- 검증은 API 응답·`x-request-id`, `wallet_syncs`·`notifications`·`activity_logs` DB 행, 서버 로그, typecheck·strict lint·build로 수행한다.
- API/DB mutation 검증은 append-only `wallet_syncs` 특성을 고려해 통제된 검증 데이터와 고유 `request_id`를 사용한다.

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **fan-out 방식** | 관리자·사용자 notification 행을 한 배열로 구성해 **단일 bulk INSERT** |
| **트리거** | `syncWalletLimits()`가 성공하고 결과 `matched >= 1` |
| **관리자 수신자** | `profiles.system_role='admin' AND status='active'`인 모든 사용자 |
| **관리자 알림 단위** | 동기화 1회당 각 관리자에게 요약 1건 |
| **개인 수신자** | 이번 동기화에서 `wallet_syncs` matched 행이 저장된 사용자 |
| **개인 알림 단위** | `results[].user_id` 기준 고유 사용자당 동기화 1회에 1건 |
| **관리자/개인 중복** | 업데이트 대상은 관리자가 되지 않는다는 사용자 전제. 방어적으로 admin ID는 개인 수신자에서 제외 가능 |
| **matched=0** | 관리자·개인 알림 모두 생성하지 않음 |
| **unmatched** | 개인 알림 없음. 관리자 body의 미매칭 건수에만 반영 |
| **금액·이름** | title/body/metadata 및 서버 오류 로그에 저장 금지 |
| **실패 정책** | best-effort. notification 실패 시 wallet 저장·HTTP 응답 유지, 서버 로그만 기록 |
| **activity log** | 기존 `wallet.sync_create` / `wallet.sync_failed` 유지. notification INSERT 별도 로그 Out |
| **Realtime** | 기존 recipient-filtered INSERT invalidate 재사용. 신규 채널·구독 없음 |
| **CTA** | 관리자·개인 모두 `지갑 보기` → `/dashboard/wallet` |

### 알림 타입·문구

| type | 수신자 | title | body | CTA |
|------|--------|-------|------|-----|
| `wallet.sync_admin` | active admin | `KB카드 지갑 동기화 완료` | `사용자 {matched}명 반영 · 미매칭 {unmatched}명` | `지갑 보기` |
| `wallet.sync_recipient` | 고유 matched user | `KB카드 지갑이 업데이트되었습니다` | `KB카드 이용 한도 정보가 갱신되었습니다.` | `지갑 보기` |

### metadata allowlist

| type | 허용 키 |
|------|---------|
| `wallet.sync_admin` | `request_id`, `synced_at`, `matched_count`, `unmatched_count`, `kind` |
| `wallet.sync_recipient` | `request_id`, `synced_at`, `kind` |

`kind`는 각각 `wallet.sync_admin`, `wallet.sync_recipient`이다. 금액, matched name, 사용자 이름은 허용하지 않는다.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | DB | SQL 38로 `notifications.type` CHECK에 지갑 타입 2종 추가 |
| B | 타입 | `NotificationType`, `NotificationMetadata`에 신규 타입·allowlist 추가 |
| C | fan-out | 기존 active admin helper를 재사용해 관리자·고유 matched 사용자 단일 bulk INSERT |
| D | wallet Route | 저장 성공 후 `matched>=1`일 때 fan-out 호출, 실패를 독립 `try/catch`로 격리 |
| E | UI helper | 신규 타입 CTA를 기존 NotificationCard action 구조에 연결 |
| F | Realtime | 기존 type 무관 INSERT invalidate의 재사용·회귀 확인 |
| G | 감사 로그 | 기존 wallet action 유지 및 notification INSERT 비기록 확인 |
| H | 검증 | API/DB/서버 로그/typecheck/lint/build |

### Out of Scope

- E2E·Playwright spec 작성 또는 실행
- 이메일·푸시·SMS
- 알림 재시도 queue, dead-letter, 운영 재발송 UI
- 금액·사용자 이름의 notification 저장
- unmatched 사용자 개인 알림
- `matched=0` 관리자 알림
- 지갑·알림 페이지의 레이아웃 변경
- 알림 INSERT activity log
- `wallet_syncs` 스키마·append-only 정책 변경
- 기존 notifications 읽음 API·RLS·admin viewer 변경

---

## API / DB 요구사항

### SQL 37과 plan 번호

`supabase/sql/37_wallet_limit_sync.sql` 상단에는 이미 `Plan: 32_wallet-kbcard-sync-plan.md (예정)`이 명시되어 있다. 본 문서가 해당 예정 plan을 정식화한다. planner 단계에서는 SQL 37을 수정하지 않는다.

### SQL 38

신규 파일 `supabase/sql/38_notifications_wallet_sync_types.sql`에서 기존 CHECK를 additive migration으로 교체한다.

허용 타입:

- `user.update`
- `contract.reminder_admin`
- `contract.reminder_recipient`
- `wallet.sync_admin`
- `wallet.sync_recipient`

이미 적용된 SQL 35는 수정하지 않는다. notifications RLS·Realtime publication·인덱스는 변경하지 않는다.

### fan-out service

`src/features/notifications/api/fan-out.server.ts`에 지갑 전용 bulk fan-out helper를 추가한다.

입력 요구사항:

- `requestId`
- `syncedAt`
- `matchedUserIds`
- `matchedCount`
- `unmatchedCount`

처리 요구사항:

1. `matchedUserIds`를 `Set`으로 dedupe한다.
2. 고유 matched 사용자가 0명이면 DB 조회·INSERT 없이 종료한다.
3. 기존 `listActiveAdminUserIds()`로 active admin ID를 조회한다.
4. 관리자 요약 행과 일반 사용자 개인 행을 한 배열로 구성한다.
5. service-role client로 `notifications`에 한 번 bulk INSERT한다.
6. 오류는 호출 Route가 격리할 수 있도록 throw한다.

### wallet sync Route

`POST /api/wallet/sync`의 순서:

1. 기존 token·JSON·schema 검증
2. 기존 `syncWalletLimits(payload, requestId)` 실행
3. `result.results`에서 matched `user_id` 추출 및 fan-out 입력 구성
4. `matched>=1`이면 fan-out 호출
5. fan-out 오류는 catch 후 서버 로그만 기록
6. 기존 `wallet.sync_create` 기록과 HTTP 200 응답 유지

서버 오류 로그에는 `requestId`, 관리자/개인 수신자 예상 건수, 오류 메시지만 허용한다. 이름·금액·payload 전체를 출력하지 않는다.

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · 참조 [plan 08](./08_activity-audit-log-plan.md)

### 기록 정책

| 구분 | 기록 |
|------|------|
| 정상 wallet sync | 기존 `wallet.sync_create` 유지 |
| wallet sync 처리 실패 | 기존 `wallet.sync_failed` 유지 |
| notification bulk INSERT | **Out** — wallet sync의 파생 데이터이며 `wallet.sync_create`로 원인 mutation을 추적 |
| notification 조회 | Out — READ |
| notification 읽음 처리 | plan 27의 `notification.read` / `notification.read_all` 기존 정책 유지 |

### Route 분기

| Route | action | 분기 |
|-------|--------|------|
| `POST /api/wallet/sync` | `wallet.sync_create` | wallet 저장 성공 및 HTTP 200 |
| `POST /api/wallet/sync` | `wallet.sync_failed` | wallet sync 처리 예외 및 HTTP 500 |

fan-out 실패는 사용자 확정 정책에 따라 wallet mutation 실패로 전환하지 않는다. 따라서 성공한 wallet sync는 `wallet.sync_create` 1건으로 유지하며 별도 `wallet.notification_failed` action을 추가하지 않는다.

**민감 데이터:** activity log와 notification metadata에 금액·사용자 이름 추가 금지.
**삭제 확인 Dialog:** DELETE UI가 없어 해당 없음.

---

## UI 요구사항

- 신규 페이지·Dialog·폼은 없다.
- 기존 NotificationCard와 목록·Popover를 재사용한다.
- 두 신규 타입의 CTA는 `지갑 보기`이며 `/dashboard/wallet`로 이동한다.
- `NotificationsRealtime`은 recipient INSERT 시 query key를 invalidate하므로 타입별 분기 없이 신규 알림을 반영한다.
- 기존 읽음 처리, infinite scroll, admin `notif_user` viewer 동작을 유지한다.

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `supabase/sql/38_notifications_wallet_sync_types.sql` | 신규 타입 2종 CHECK 확장 |
| `src/features/notifications/api/types.ts` | notification type·metadata 확장 |
| `src/features/notifications/api/fan-out.server.ts` | 지갑 단일 bulk fan-out 추가, active admin helper 재사용 |
| `src/features/notifications/components/notification-helpers.ts` | 지갑 타입 CTA 분기 |
| `src/app/api/wallet/sync/route.ts` | sync 성공 후 best-effort fan-out 연결 |

확인만 하고 변경하지 않는 파일:

- `supabase/sql/37_wallet_limit_sync.sql` — 기존 wallet 원장과 plan 32 예정 참조
- `src/features/wallet/api/service.server.ts` — matched 결과·`user_id`의 source
- `src/features/notifications/components/notifications-realtime.tsx` — type 무관 INSERT invalidate
- `src/features/activity-logs/api/types.ts` — 기존 wallet action 유지, 신규 action 없음

따라야 할 패턴:

- plan 28 `listActiveAdminUserIds()`와 service-role bulk INSERT
- plan 27 notification type·metadata·CTA·Realtime
- wallet service의 `WalletSyncResult.results`
- plan 08에서 파생 notification INSERT를 별도 감사 로그로 중복 기록하지 않는 원칙

---

## 구현 순서

1. SQL 38 작성·적용 후 신규 타입 직접 INSERT 가능 여부 확인
2. notification TypeScript 타입과 metadata allowlist 확장
3. 단일 bulk fan-out helper 구현
4. wallet sync Route에 dedupe 입력과 best-effort 호출 연결
5. 신규 타입 CTA 연결
6. API/DB 검증으로 수신자·중복·matched=0·실패 격리·로그 비중복 확인
7. `npx tsc --noEmit`, `npm run lint:strict`, `npm run build`

**Checkpoint:** SQL 38 적용과 bulk helper 구현 후 Route 연결 전에 DB CHECK·수신자 행 구조를 검토한다.

---

## 리스크 & 완화책

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | DB CHECK가 신규 타입을 거부해 전체 notification batch 실패 | SQL 38을 코드보다 먼저 적용하고 타입별 DB 검증 |
| 2 | HIGH | payload 중복으로 개인 알림이 여러 건 생성 | 입력 item이 아니라 matched `results[].user_id` 기준 `Set` dedupe |
| 3 | HIGH | fan-out 오류가 wallet sync HTTP 200을 500으로 변경 | wallet 저장 이후 독립 `try/catch`, 오류 재throw 금지 |
| 4 | MED | 관리자 조회 조건 누락으로 inactive admin 수신 | 기존 `listActiveAdminUserIds()`의 role+status 조건 재사용 |
| 5 | MED | 관리자와 개인 수신자 중복 | 사용자 전제 유지, 방어적으로 admin ID를 개인 행에서 제외 |
| 6 | MED | 서버 로그·metadata에 금액이나 이름 노출 | allowlist와 구조화 로그, payload 전체 logging 금지 |
| 7 | LOW | 신규 타입 CTA 누락 | `notification-helpers.ts` 명시 분기 및 API 반환 확인 |
| 8 | LOW | 기존 Realtime이 타입을 제한한다고 오해해 불필요한 구독 추가 | 현재 recipient INSERT invalidate가 type 무관임을 회귀 확인 |

---

## 롤백

- wallet Route fan-out 호출, 지갑 helper, 신규 타입·CTA 분기를 되돌린다.
- SQL 38의 허용 타입 추가는 기존 기능에 영향을 주지 않으므로 우선 유지할 수 있다.
- DB CHECK 완전 복구가 필요하면 신규 타입 notification 행을 먼저 정리한 후 기존 3개 타입 CHECK로 되돌린다.
- `wallet_syncs`는 append-only이므로 이미 저장된 지갑 행은 보존한다.

---

## 구현 추정

- 범위: 코드 4파일 + SQL 1파일, 약 140–220 LOC
- 복잡도: Medium
- 예상 시간: 80–125분
- 검증: API/DB 20–30분, CLI 15–25분
- E2E/Playwright: Out

---

## requirements-pipeline Express

### Scoping

- 기능 단위는 **KB카드 지갑 동기화 인앱 알림** 1개다.
- 기존 지갑 저장과 notifications 플랫폼을 연결하며 별도 UI 기능으로 분리하지 않는다.
- Standard/Full의 상세 시나리오·유저플로우 단계는 Express 모드로 생략한다.

### 가정

| ID | 가정 |
|----|------|
| A1 | 업데이트 대상 사용자는 admin이 아니다. |
| A2 | matched 행 저장 자체를 사용자 지갑 업데이트로 정의한다. 이전 값과 동일해도 알림 대상이다. |
| A3 | notification batch 실패는 운영 서버 로그로 관찰하며 자동 재시도하지 않는다. |
| A4 | 기존 notifications RLS·조회 API·Realtime은 신규 type을 별도 제한하지 않는다. |
| A5 | SQL 37의 wallet 원장 구조와 API가 구현되어 동작 중이며 본 plan은 알림 확장에 집중한다. |

### 요구사항 우선순위

| 우선순위 | 요구사항 |
|----------|----------|
| Must | active admin 전체 요약, 고유 matched 사용자 개인 알림 |
| Must | matched=0 skip, 중복 사용자 dedupe |
| Must | 금액·이름 미저장, best-effort 실패 격리 |
| Must | SQL 38 타입 CHECK, 기존 Realtime·activity log 정책 유지 |
| Must | API/DB/CLI 검증, E2E Out |
| Won't | retry queue, 신규 UI, 외부 채널 |

### 검증 전략

- API: sync 응답·matched/unmatched·`x-request-id`
- DB: request 기준 wallet 원장, 수신자별 notification 행, activity log 1건
- 실패 격리: 통제 환경에서 notification INSERT 실패 후 wallet 보존 확인
- 정적/빌드: TypeScript, strict lint, production build
- E2E/Playwright: 사용자 명시로 작성·실행하지 않음

---

## 열린 질문

없음. Phase 1 인터뷰와 Phase 2 battle-plan에서 정책 확정 후 사용자 `go` 승인 완료.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-04 | 최초 작성 (Approved) — KB카드 wallet sync admin·matched user 단일 bulk 인앱 알림 | planner |
