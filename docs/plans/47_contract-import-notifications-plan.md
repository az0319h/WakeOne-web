# 계약서 Import 인앱 알림 기획서

> Date: 2026-09-01
> Status: Approved
> Author: planner
> **SQL:** `47` · `supabase/sql/47_notifications_contract_import_types.sql` (구현 시)
> **선행:** [08](./08_activity-audit-log-plan.md), [16](./16_contract-management-plan.md), [18](./18_contract-approved-at-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [28](./28_contract-reminder-notifications-plan.md), [41](./41_user-my-contracts-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **08** | mutation Route activity log 정책 — 본 plan은 import Route **fan-out만** 추가 · 신규 mutation action **없음** |
| **16** | `POST /api/contracts/import` · OpenClaw service token · idempotent upsert · `contract.import_*` activity log |
| **18** | `approved_at` 필수 · `import_backfill` 경로 (`approved_at` null 기존 row 보완) |
| **27** | `notifications` 테이블 · Realtime · `fan-out.server.ts` · 알림 INSERT activity log **Out** |
| **28** | 계약 도메인 알림 선례 — admin bulk fan-out · 타입 분리 · duplicate skip · fan-out try/catch |
| **41** | user READ-only · `/dashboard/my-contracts` · `normalizePersonName` 이름 매칭 · 첨부 업로드 **admin-only** |

**중복 금지:** import Route·activity log action 변경 Out. `author_user_id` 연결 Out (plan 41). 이메일·Slack·push Out. admin 타인 알림 read Out (plan 27).

---

## 한 줄 요약

OpenClaw `POST /api/contracts/import` 성공(`created`·`backfill`) 시 **모든 active admin**과 **이름 매칭 active user**에게 in-app 알림을 fan-out한다. `duplicate`·`failed`는 알림 없음. 작성자 알림은 「내 계약서에서 확인」만, 첨부 업로드 CTA **금지**.

---

## 정책 확정안 (deep-interview + battle-plan)

| 항목 | 확정 |
|------|------|
| **Fan-out 트리거** | `importContractDocument` 결과 `status === 'created'` **또는** `'backfill'` |
| **Fan-out skip** | `'duplicate'` · validation/401/403/500 등 **모든 failed** |
| **Admin 수신** | **모든 active admin** (`system_role='admin'`, `status='active'`) — plan 28 `listActiveAdminUserIds()` 재사용 |
| **작성자 수신** | `system_role='user'` · `status='active'` · `normalizePersonName(full_name) === normalizePersonName(author_name)` — plan 41 my-contracts scope **동일** |
| **작성자 미매칭** | 매칭 user **0명** → admin만 알림 · 작성자 fan-out **skip** |
| **동명이인** | 매칭 active user **전원** 각 1건 (plan 41 정책 a) |
| **import_backfill** | `import_create`와 **동일** fan-out |
| **import_failed** | in-app 알림 **Out** — activity log · import events만 |
| **알림 INSERT log** | **Out** — plan 27/28 원칙 |
| **Fan-out 실패** | try/catch · **import HTTP 응답 불변** (201/200 유지) |

### RBAC · 문구 제약

| 수신자 | title (초안) | body (초안) | CTA |
|--------|--------------|-------------|-----|
| admin | `계약서가 import되었습니다` | `문서번호 {document_number} · 작성자 {author_name}` | **계약서 관리** → `/dashboard/contracts` |
| 작성자 (user) | `계약서가 등록되었습니다` | `문서번호 {document_number}가 등록되었습니다. 내 계약서에서 확인하세요.` | **내 계약서에서 확인** → `/dashboard/my-contracts` |

**금지:** 작성자 알림에 「첨부 업로드」「첨부파일을 올려 주세요」 등 **첨부 유도 문구·CTA 없음** (plan 41 — user 첨부 업로드 불가).

---

## 알림 타입 설계

plan 28과 동일하게 **타입 2종 분리** — CTA·템플릿·`getNotificationActions` 분기 명확.

| `type` | 수신자 | CTA action id | route |
|--------|--------|---------------|-------|
| `contract.import_admin` | 각 active admin | `view-contracts` | `/dashboard/contracts` |
| `contract.import_author` | 매칭 active user (0~N명) | `view-my-contracts` | `/dashboard/my-contracts` |

**metadata allowlist:** `contract_id`, `document_number`, `author_name`, `import_status` (`created` \| `backfill`), `kind` (`contract.import_admin` \| `contract.import_author`)

**민감 데이터 금지:** external_payload · email · token · 첨부 URL metadata **저장 금지**.

---

## Fan-out 규칙

```
POST /api/contracts/import
  → importContractDocument(payload, requestId)
  → if result.status in ['created', 'backfill']:
       try {
         insertContractImportAdminNotifications({ contract, importStatus })
         insertContractImportAuthorNotifications({ contract, importStatus })
       } catch (e) {
         console.error('[contracts/import] notification fan-out failed', e)
         /* HTTP 응답 변경 금지 */
       }
  → return 201 (created) | 200 (backfill | duplicate) — 기존과 동일
```

| import 결과 | HTTP | admin 알림 | author 알림 |
|-------------|------|------------|-------------|
| `created` | 201 | ✅ 전 active admin | ✅ 매칭 user 전원 |
| `backfill` | 200 | ✅ 동일 | ✅ 동일 |
| `duplicate` | 200 | ❌ | ❌ |
| failed (4xx/5xx) | 기존 | ❌ | ❌ |

### 작성자 매칭 helper (신규)

```ts
listMatchedAuthorUserIds(authorName: string): Promise<string[]>
// profiles: system_role='user' AND status='active' AND full_name not null
// filter: normalizePersonName(full_name) === normalizePersonName(authorName)
// return: user_id[] (동명이인 전원)
```

참조: `src/lib/normalize-person-name.ts` · plan 41 · reminder group 매칭(`service.server.ts`).

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | active admin A·B, valid import token, 신규 document_number | `POST /api/contracts/import` → `created` | HTTP 201 · A·B **각각** `contract.import_admin` 알림 1건 · body에 `document_number` |
| AC-02 | API | AC-01 + user C (`full_name`↔`author_name` 매칭) | 동일 import | C에게 `contract.import_author` 1건 · metadata `import_status=created` |
| AC-03 | API | `approved_at` null 기존 row, 동일 document_number | import payload에 `approved_at` 포함 → `backfill` | admin·매칭 작성자 알림 **AC-01/02와 동일** · metadata `import_status=backfill` |
| AC-04 | API | 동일 `full_name` active user C·D | `created` import | C·D **각 1건** `contract.import_author` |
| AC-05 | API | `author_name` 매칭 active user **0명** | `created` import | admin 알림만 · author 알림 **0건** |
| AC-06 | API | 동일 document_number, 변경 없음 | `duplicate` 재import | admin·author 알림 **0건** |
| AC-07 | API | `approved_at` 누락 등 validation 실패 | import 400 | 알림 **0건** · `contract.import_failed` log만 (기존) |
| AC-08 | Playwright | admin, AC-01 후 | admin `/dashboard/notifications` | admin 카드 · CTA **「계약서 관리」** 클릭 → `/dashboard/contracts` |
| AC-09 | Playwright | user C, AC-02 후 | C `/dashboard/notifications` | CTA **「내 계약서에서 확인」** → `/dashboard/my-contracts` · **첨부 업로드** 관련 문구·버튼 **없음** |
| AC-10 | API/회귀 | plan 27 | admin이 user B `user.update` 알림 | 기존 **「프로필 보기」** CTA 유지 · import 타입 간섭 없음 |
| AC-11 | API | fan-out INSERT 실패(mock/spy) | import `created` 성공 | HTTP **201** 유지 · contract row 생성됨 |
| AC-12 | CLI | 구현 완료 | `bunx playwright test e2e/contract-import-notifications/` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **SQL `47`** | `notifications.type` CHECK에 `contract.import_admin` · `contract.import_author` 추가 |
| B | **BE helper** | `listMatchedAuthorUserIds(authorName)` |
| C | **BE fan-out** | `insertContractImportAdminNotifications` · `insertContractImportAuthorNotifications` (`fan-out.server.ts`) |
| D | **BE route** | `import/route.ts` — `created`/`backfill` 성공 후 fan-out + try/catch |
| E | **FE types** | `NotificationType` · `NotificationMetadata` 확장 |
| F | **FE helpers** | `notification-helpers.ts` — CTA · `NOTIFICATION_ACTION_ROUTES` |
| G | **검증** | `e2e/contract-import-notifications/` spec |

### Out of Scope

| 항목 | 사유 |
|------|------|
| `import_duplicate` · `import_failed` in-app 알림 | deep-interview 확정 |
| 작성자 미매칭 시 admin skip | deep-interview **A** — admin만 |
| user 첨부 업로드 CTA·문구 | plan 41 RBAC |
| `author_user_id` import 시 연결 | plan 41 Out |
| import Route·activity log action 변경 | plan 16 유지 |
| 알림 INSERT activity log | plan 27 Out |
| 이메일·Slack·push | — |
| admin 타인 알림 read | plan 27 Out |
| 신규 알림 UI 화면 | plan 27 NotificationCenter·목록 **타입 확장만** |
| Realtime 구독 변경 | plan 27 기존 INSERT 구독으로 충분 |

---

## DB (`supabase/sql/47_notifications_contract_import_types.sql`)

```sql
-- Plan: 47_contract-import-notifications-plan.md
-- Status: Approved

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'contract.import_admin',
      'contract.import_author',
      'wallet.sync_admin',
      'wallet.sync_recipient',
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created'
    )
  );
```

**주의:** `46_support_comments_notifications.sql` CHECK 목록과 **동기화** — 구현 시 최신 SQL 파일의 type enum 전체를 포함할 것.

---

## API / BE 변경

### `POST /api/contracts/import` (확장)

| 항목 | 내용 |
|------|------|
| **변경** | `importContractDocument` 성공 + `status ∈ {created, backfill}` 직후 fan-out |
| **불변** | token 검증 · validation · idempotent · HTTP status · response body |
| **GET /api/notifications** | 변경 없음 — plan 27이 신규 type 반환 |

### Fan-out 구현 위치

```
src/features/notifications/api/
  fan-out.server.ts     — + insertContractImportAdminNotifications
                        — + insertContractImportAuthorNotifications
                        — + listMatchedAuthorUserIds (또는 contracts helper)
  types.ts              — NotificationType 확장

src/app/api/contracts/import/route.ts
  — success 분기 후 fan-out try/catch
```

---

## UI 요구사항 (FE)

| 항목 | 내용 |
|------|------|
| **변경 범위** | 기존 알림 카드·Popover·목록 — **타입별 CTA만** 추가 |
| **admin** | `contract.import_admin` → **「계약서 관리」** primary redirect |
| **작성자** | `contract.import_author` → **「내 계약서에서 확인」** primary redirect |
| **금지** | 작성자 카드에 첨부·업로드 관련 action |
| **로딩** | 신규 page 없음 — `loading.tsx` 변경 **Out** |
| **Realtime** | plan 27 `NotificationsRealtime` — INSERT 구독 **유지** |

---

## 활동 감사 로그

**activity log 해당 없음** — 본 plan은 import Route에 **notification INSERT fan-out**만 추가. import Route의 기존 `contract.import_create` / `import_backfill` / `import_duplicate` / `import_failed` 정책(plan 16) **유지**. 알림 INSERT → activity log **Out** (plan 27/28). `GET /api/notifications` → READ **Out**.

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `supabase/sql/47_notifications_contract_import_types.sql` | 신규 |
| `src/features/notifications/api/types.ts` | type·metadata |
| `src/features/notifications/api/fan-out.server.ts` | fan-out + helper |
| `src/app/api/contracts/import/route.ts` | fan-out 호출 |
| `src/features/notifications/components/notification-helpers.ts` | CTA |
| `e2e/contract-import-notifications/*.spec.ts` | 신규 |

**패턴:** plan 28 reminder fan-out · plan 32 wallet sync admin bulk · plan 41 name match.

---

## 구현 순서

1. SQL `47` — type CHECK migration
2. `listMatchedAuthorUserIds` helper
3. `fan-out.server.ts` insert 함수 2종
4. `import/route.ts` fan-out + try/catch
5. FE types + `notification-helpers.ts`
6. `e2e/contract-import-notifications/` — AC-01~12
7. tsc · lint · build

**Checkpoint:** Step 4 + API spec green (~1h)

---

## 리스크 & 완화책

| 우선순위 | 리스크 | 완화 |
|----------|--------|------|
| HIGH | fan-out throw → import 500 | Route **try/catch** · AC-11 |
| HIGH | duplicate에 알림 | `status === 'duplicate'` skip · AC-06 |
| HIGH | 작성자 첨부 CTA | type 분리 · AC-09 grep |
| MED | backfill fan-out 누락 | `backfill` = `created` 동일 분기 · AC-03 |
| MED | 동명이인 1명만 수신 | 전원 loop · AC-04 |
| MED | CHECK enum 누락 | sql/46 목록 병합 |
| LOW | inactive admin 수신 | `listActiveAdminUserIds()` 재사용 |

---

## E2E spec 구조

```
e2e/contract-import-notifications/
  import-notifications.api.spec.ts   — AC-01~07, AC-11
  import-notifications.spec.ts       — AC-08, AC-09, AC-10 회귀
```

**인증:** storageState 재사용 · import token env · mock document_number (E2E scope).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-01 | 최초 작성 · `/root` planner Phase 3+4 · Status Approved | planner |
