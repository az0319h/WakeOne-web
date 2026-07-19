# 프로필 이름 변경 전파 (live display) 기획서

> Date: 2026-07-18
> Status: Approved
> Author: planner
> **SQL:** 없음 (read-time join · service layer)
> **선행:** [08](./08_activity-audit-log-plan.md), [19](./19_user-single-name-plan.md), [25](./25_activity-logs-ui-improvement-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [28](./28_contract-reminder-notifications-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **08** | `activity_logs` append-only · `actor_display_name`·`target_label` **기록 시점 스냅샷** — 본 plan은 **조회 시 live `profiles.full_name` 우선** 표시로 확장. INSERT 스키마·`recordActivityLog` 패턴 유지 |
| **19** | `full_name` 단일 필드 · 관리자 `PUT` 수정 — 이름 변경 트리거 도메인 |
| **25** | 활동 로그 5컬럼 UI · admin `search`(target) — live 표시 시 **검색도 resolved 이름**과 정합 필요 |
| **27** | `user.update` 알림 fan-out · title/body **필드 라벨만**(값·이전이름 Out) — 본 plan은 알림 row **UPDATE 금지**·표시 경로 read-time 정책만 명시 |
| **28** | `contract.reminder_recipient` `metadata.author_name` — **표시 enrichment Out**(이름 매칭 로직 Out과 동일) |

**중복 금지:** `notifications`·`activity_logs` 과거 행 **UPDATE/백필** · `contracts.author_name` · `system_email_logs.author_name` · 독촉 **이름 매칭** 로직 변경 **Out**.

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | 사용자 `full_name` 변경 후에도 활동 로그·사이드바 등 **사람 이름 표시 UI**가 최신 `profiles.full_name`을 반영한다. 과거 감사 스냅샷 컬럼은 유지하되 **읽기 경로에서 live join**한다. |
| **Done when** | AC #1~#12 Playwright green · API #13~#15 · PUT `target_label` 버그 수정 검증 · tsc · lint · build |
| **Not doing** | rank/email live 표시 · 알림 DB row UPDATE · 계약서·메일 로그 스냅샷 변경 · 독촉 이름 매칭 · SQL migration(기본) |

### STEPS (구현 순서)

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | BE — `listActivityLogs` live name enrichment | `enrichActivityLogsWithLiveNames()` · admin search 보강 | HIGH |
| 2 | BE — `PUT /api/users/[id]` success `target_label` **업데이트 후** 재조회 | `route.ts` 수정 | HIGH |
| 3 | FE — `ProfileRealtime`(또는 `ProfileStatusRealtime` 확장) | `full_name`/`avatar_url` UPDATE 시 `router.refresh()` | MED |
| 4 | BE — 알림 read path 정책 확인 | row UPDATE 없음 · title/body plan 27 유지 | HIGH |
| 5 | E2E + API 검증 | `e2e/profile-name-live-display/` | MED |

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | admin `target_label` 검색이 live 이름과 불일치 | 검색 시 `profiles.full_name` 매칭 `target_user_id` OR 조건 추가 (§API) |
| MED | 삭제·비활성 사용자 프로필 없음 | 스냅샷 `actor_display_name`/`target_label` → email fallback (deep-interview 확정) |
| LOW | Realtime 과다 `router.refresh()` | `full_name`·`avatar_url` 변경 시에만 refresh |

### ROLLBACK

- `listActivityLogs` enrichment 제거 → 기존 스냅샷 표시로 복귀
- Realtime 확장 revert → 수동 새로고침만 필요
- PUT `target_label` 순서 revert → 감사 스냅샷만 구 이름 유지(display는 join으로 보완 가능)

### ESTIMATE

- 범위: ~8 파일 · ~200–350 LOC
- 복잡도: **Medium**
- 예상: **90–150분** (체크포인트: activity log join + E2E #1~#3)

---

## 한 줄 요약

관리자가 사용자 `full_name`을 변경해도 **활동 로그 행위자·대상**과 **사이드바 NavUser**는 최신 이름을 보여 준다. DB 스냅샷 컬럼은 append-only로 두고 **`listActivityLogs` read-time `profiles` join**으로 표시를 갱신하며, `PUT /api/users/[id]` 성공 로그의 `target_label`은 **업데이트 후** 기록하도록 버그를 수정한다. 알림·계약서·메일 로그의 과거 스냅샷은 **변경하지 않는다**.

---

## 정책 확정안 (deep-interview · 사용자 명시)

| 항목 | 확정 |
|------|------|
| **활동 로그 actor/target 표시** | 조회 시 `profiles.full_name` **live join** (우선). 프로필 없음/삭제·비활성 → **기록 시점 스냅샷** (`actor_display_name` / `target_label`) → **email** |
| **활동 로그 DB row** | **UPDATE 없음** — append-only 유지. 표시만 enrichment |
| **인앱 알림** | 과거 `notifications` 행 **UPDATE 금지**. title/body는 plan 27 템플릿 유지(필드 라벨·「관리자」). 카드에 사람 이름 미표시 — **read path row mutation 없음** 확인 |
| **contract reminder system-email-logs** | `author_name` 등 **발송 시점 스냅샷 유지** — 변경 Out |
| **contract documents `author_name`** | **변경 Out** |
| **독촉 이름 매칭 로직** | **Out of scope** |
| **이번 스프린트 필드** | **`full_name`만** (rank·email live 표시 Out) |
| **NavUser / sidebar** | 본인 `profiles` UPDATE(`full_name`·`avatar_url`) 시 **Realtime 또는 `router.refresh()`** 로 RSC 프로필 재주입 |
| **PUT 버그** | `PUT /api/users/[id]` — `target_label`을 업데이트 **전**에 고정하지 말고, **200 성공 직전** 최신 프로필로 재조회 |

### Live name resolution (표시 우선순위)

**Actor** (`actor_user_id` not null):

1. `profiles.full_name` (trim, non-empty)
2. `activity_logs.actor_display_name` (스냅샷)
3. `activity_logs.actor_email`

**Target** (`target_type === 'user'` && `target_user_id` not null):

1. `profiles.full_name` + `profiles.email` → `"{full_name} ({email})"` (이름 없으면 email만)
2. `activity_logs.target_label` (스냅샷)
3. `target_user_id` 문자열

**Target** (`target_type !== 'user'`): `target_label` 그대로 (`formatTargetLabel` 유지).

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, active user B (이름 `이전이름`, 이메일 고정) | Users에서 B 이름을 `이후이름`으로 변경 저장 | `/dashboard/logs`에서 해당 `user.update` 행의 **대상** 컬럼에 **`이후이름`**(및 이메일)이 표시된다 |
| 2 | Playwright | AC #1 직후 | 동일 로그 행의 **행위자**가 admin 본인인 경우 | **행위자**에 admin의 **현재** `full_name`이 표시된다 (스냅샷이 구 이름이어도) |
| 3 | Playwright | admin, user B | B 이름 변경 전 기록된 **과거** `user.update` 로그가 목록에 있을 때 | B를 다시 다른 이름으로 변경한 뒤 `/dashboard/logs` 조회 | **과거·신규** 로그 모두 대상에 B의 **최신** `full_name`이 표시된다 |
| 4 | Playwright | admin | `/dashboard/logs` 대상 검색에 B의 **변경 후** 이름 일부 입력 (debounce 후) | B를 target으로 한 로그 행이 **필터링**된다 |
| 5 | Playwright | user B 로그인, admin이 B의 `full_name` 변경 | (Realtime 대기 ≤5s) | 사이드바 NavUser **표시 이름**이 **변경 후 이름**으로 바뀐다 (전체 페이지 수동 F5 없이) |
| 6 | Playwright | user B | admin이 B **아바타만** 변경 (`full_name` 동일) | NavUser 아바타 이미지가 **갱신**된다 |
| 7 | Playwright | user B, `/dashboard/notifications`에 `user.update` 알림 1건+ | admin이 B `full_name` 변경 후 알림 목록 확인 | 알림 제목 **「프로필 정보가 변경되었습니다」** · body **「이름이(가) 관리자에 의해 변경되었습니다」** 유지 (구/신 이름 문자열 **미포함**) |
| 8 | API | admin | AC #1 PUT 성공 직후 `GET /api/activity-logs` 최신 `user.update` 행 | 응답 `target_label` DB 컬럼은 **`이후이름 (email)`** 형식 (업데이트 **후** 스냅샷). `enriched` 표시 필드가 있으면 동일 |
| 9 | API | admin | `GET /api/activity-logs?search={이후이름 일부}` | B 관련 target 로그가 **포함** |
| 10 | API/로그 | admin | AC #1 PUT 성공 | `activity_logs` 1건 · action **`user.update`** · Status **2xx** · `metadata.changed_fields`에 `full_name` |
| 11 | Playwright | admin | `/dashboard/system-email-logs` 독촉 run 상세 | `author_name`이 **발송 당시 스냅샷** 그대로다 (B 이름 변경 후에도 변하지 않음) |
| 12 | Playwright | admin, 계약서 목록에 `author_name`이 B와 연관된 행 | B `full_name` 변경 후 계약서 테이블·상세 | `author_name` 컬럼/필드 **변경 없음** |
| 13 | API | — | 삭제·비활성으로 `profiles` 조회 불가인 `target_user_id` 로그(시드 또는 fixture) | `GET /api/activity-logs` | 대상은 **스냅샷 `target_label`**(없으면 email) fallback 표시 |
| 14 | CLI | 구현 완료 | `bunx playwright test e2e/profile-name-live-display/` | green |
| 15 | CLI | 구현 완료 | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 통과 |

**회귀:** plan 08 activity log append-only · plan 25 5컬럼·Combobox · plan 27 알림 fan-out/읽음 · plan 19 본인 PATCH 이름 403 · Users mutation `onSettled` invalidate.

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE → FE Realtime → E2E**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **BE — activity logs read** | `src/features/activity-logs/api/service.server.ts` — 로그 조회 후 `actor_user_id`·`target_user_id`(user 타입) 배치 profile fetch · `enrichActivityLogsWithLiveNames()` |
| B | **BE — activity logs search** | admin `search` 쿼리: `target_label` ilike **OR** `profiles.full_name` ilike 매칭 user id의 `target_user_id` |
| C | **BE — types/API** | `ActivityLog`에 optional `actor_display_name_resolved` / 표시용 필드 또는 기존 필드 overwrite(서버 only) — FE는 enriched 값만 사용 |
| D | **BE — PUT bugfix** | `src/app/api/users/[id]/route.ts` — **200 성공** `recordActivityLog` 직전 `fetchUserTargetLabel(id)` 재호출 (`full_name` 변경 포함 모든 성공 케이스) |
| E | **FE — activity logs** | `columns.tsx` `ActorCell`/`TargetCell` — enriched 필드 사용 (변경 최소) |
| F | **FE — NavUser refresh** | `ProfileStatusRealtime` 확장 또는 `ProfileRealtime` — `profiles` UPDATE on `user_id=me` 시 `full_name`/`avatar_url` 변경이면 `router.refresh()` |
| G | **BE — notifications audit** | `listNotifications` — row UPDATE 없음 확인 · plan 27 title/body 유지 (코드 변경 없거나 주석·테스트만) |
| H | **E2E** | `e2e/profile-name-live-display/` — AC #1~#7, #11~#12 |
| I | **API spec** | `e2e/profile-name-live-display/*.api.spec.ts` 또는 기존 activity-logs API 확장 — AC #8~#10, #13 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| `activity_logs`·`notifications` 과거 행 UPDATE/백필 | 정책상 금지 |
| `rank`·`email` live 표시 | 이번 스프린트 `full_name` only |
| `contracts.author_name` · import/backfill | 계약 도메인 스냅샷 |
| `system_email_logs` · 독촉 메일 본문 이름 | 발송 시점 스냅샷 |
| 독촉 `author_name` ↔ `profiles` **매칭 로직** | plan 20/28 유지 |
| `contract.reminder_recipient` `metadata.author_name` UI 표시·live resolve | 매칭 Out · 카드 미표시 |
| 알림 title/body에 **관리자 실명** 삽입 | plan 27 「관리자」 유지 |
| SQL migration / DB view | read-time join으로 충분 시 **생략** |
| Users 테이블·프로필 Dialog 이름 컬럼 | 이미 live query — **회귀만** |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/features/activity-logs/api/service.server.ts` | **핵심** — batch profile join · search OR |
| `src/features/activity-logs/api/types.ts` | enriched 표시 필드 (필요 시) |
| `src/features/activity-logs/api/log.server.ts` | `fetchUserTargetLabel` 재사용 · (선택) `resolveLiveUserLabel` 헬퍼 |
| `src/features/activity-logs/components/activity-logs-table/columns.tsx` | enriched actor/target 표시 |
| `src/app/api/users/[id]/route.ts` | PUT success `target_label` 재조회 |
| `src/features/auth/components/profile-status-realtime.tsx` | `full_name`/`avatar_url` UPDATE → `router.refresh()` |
| `src/app/dashboard/layout.tsx` | Realtime 컴포넌트 props (변경 최소) |
| `e2e/profile-name-live-display/*.spec.ts` | 신규 AC spec |
| `e2e/helpers/` | 이름 변경·로그 검증 헬퍼 (필요 시) |

**따라야 할 패턴:**

- Service layer read enrichment (`listActivityLogs` — plan 08 D)
- `ProfileStatusRealtime` — `postgres_changes` + `setAuth` (plan 03/27)
- Activity log INSERT는 기존 `jsonWithActivityLog` / `recordActivityLog` (plan 08)

**변경 없음 (명시):**

- `src/features/system-email-logs/**`
- `src/features/contracts/**` (`author_name` 필드)
- `src/lib/mail/send-contract-reminder-email.ts`
- `src/features/notifications/api/fan-out.server.ts` (INSERT 템플릿)

---

## UI 요구사항

| 화면 | 요구 |
|------|------|
| `/dashboard/logs` | 행위자·대상 — **live `full_name`** (plan 25 preview-2 레이아웃 유지) |
| Sidebar `NavUser` | `full_name`·아바타 Realtime 반영 |
| `/dashboard/notifications` | plan 27 UI **변경 없음** (정책 검증만) |
| `/dashboard/system-email-logs` | **변경 없음** |
| 계약서 목록/상세 | **변경 없음** |

**Designer:** UI 구조 변경 없음 — 기존 컴포넌트·5컬럼 유지. `preview` gate **생략**.

---

## API / Service Layer

### `GET /api/activity-logs` (enrichment)

1. 기존 RLS·pagination·`log_user`·`action` 필터 유지
2. 페이지 rows 수집 후 `actor_user_id` ∪ `target_user_id`(where `target_type='user'`) distinct → `profiles` batch `select user_id, full_name, email, status`
3. 각 row에 §Live name resolution 적용
4. admin `search`:
   - `escaped = search.replaceAll(',', ' ')`
   - `matchingUserIds` = `profiles` where `full_name ilike %escaped%` (service role 또는 admin session)
   - query: `target_label.ilike.%escaped%` **OR** `target_user_id.in.(matchingUserIds)`

**SQL migration 불필요 근거:** append-only `activity_logs` 유지 · 조회 시 1회 batch join으로 N+1 방지 · RLS는 기존 `activity_logs` SELECT 정책 + `profiles` SELECT(authenticated 본인/admin)로 충분.

### `PUT /api/users/[id]` (bugfix)

- 현재: L95 `const targetLabel = await fetchUserTargetLabel(id)` — 업데이트 **전** 고정 → L287 success에 동일 값 사용
- 수정: 실패 분기는 기존 `targetLabel`(시도 시점) 유지 가능 · **200 성공** 분기만 `const successTargetLabel = await fetchUserTargetLabel(id)` 후 `recordActivityLog`

### Notifications

- `listNotifications`: **SELECT only** — `title`/`body` DB 값 그대로 반환
- profile name 변경 시 **`UPDATE notifications` 호출 추가 금지** (grep AC)

---

## 활동 감사 로그

| 항목 | 내용 |
|------|------|
| **신규 CUD Route** | 없음 |
| **기존 mutation** | `PUT /api/users/[id]` — `user.update` **기존 action** · 전 HTTP 분기 로깅 **유지** |
| **변경점** | 200 성공 시 `target_label` = **업데이트 후** `fetchUserTargetLabel` |
| **조회** | READ — activity log **INSERT 없음** |

### 기록 연동 (변경 분기만)

| Route | action | 변경 |
|-------|--------|------|
| `PUT /api/users/[id]` | `user.update` | 200: `targetLabel` → post-update 재조회 · 나머지 분기 동일 |

**AC:** #10 — PUT 성공 후 `user.update` 2xx · `changed_fields`에 `full_name`

---

## E2E 범위

```
e2e/profile-name-live-display/
  logs-live-name.spec.ts      — AC #1~#4 (admin logs + search)
  nav-user-refresh.spec.ts    — AC #5~#6 (Realtime NavUser)
  notifications-unchanged.spec.ts — AC #7
  snapshots-unchanged.spec.ts — AC #11~#12 (email logs + contracts)
  live-display.api.spec.ts    — AC #8~#10, #13
```

**셀렉터:** `getByRole` · `getByPlaceholder` · `getByTestId` only.

**인증:** `storageState` 재사용 · admin / user B fixture.

---

## 리스크 & 완화책

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | HIGH — admin target 검색 불일치 | §API `search` OR `profiles` join |
| 2 | MED — `profiles` batch 실패 | catch 시 스냅샷 fallback · API 500 방지 |
| 3 | MED — Realtime refresh 루프 | payload.old/new 비교 후 변경 필드만 refresh |
| 4 | LOW — E2E Realtime flakiness | `expect.poll` 5s · test id on NavUser name span |

---

## 열린 질문

없음 (deep-interview 확정 · `go` 승인).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-18 | 최초 작성 (Approved) | planner |
