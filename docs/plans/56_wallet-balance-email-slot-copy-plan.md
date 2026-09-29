# 식대 잔액 이메일 — 슬롯별 카피 기획서

> Date: 2026-09-29
> Status: Approved
> Author: planner
> **신규 SQL:** 없음 (코드 상수·dispatch slot 판별·notification metadata만)
> **선행:** [08](./08_activity-audit-log-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [51](./51_wallet-balance-email-plan.md), [55](./55_wallet-balance-email-admin-dual-slot-plan.md)

---

## ⛔ BLOCKER — plan 51 allowlist 유지

**본 plan도 plan 51 BLOCKER를 그대로 상속한다.** dev/staging에서 `shhong@wakecorp.com`·E2E 테스트 계정 외 실사용자 SMTP **금지**. `WALLET_BALANCE_EMAIL_MODE=allowlist` 기본 · Production 전환은 **Out**.

---

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **51** (Approved) | 식대 잔액 이메일 preferences·dispatch·run/recipient·`wallet.balance_email` · allowlist BLOCKER · due=0 no-run |
| **55** (Approved) | 2회 KST 슬롯(slot1/slot2) · admin `wallet.balance_email_admin` · due OR 쿼리 · duplicate schedule 400 |
| **27** (Approved) | `notifications` INSERT · Realtime · CTA helper |
| **08** (Approved) | CUD activity log 정책 (본 plan 신규 CUD **Out**) |

**관계:** plan 55 dual-slot 인프라 위에 **슬롯별 고정 카피**를 코드 상수로 분기. dispatch가 매칭 슬롯(1|2)을 판별해 이메일·인앱·metadata·로그 UI에 반영.

**중복 금지:** copy DB 컬럼·사용자 커스텀 제목·admin 알림 문구 변경 — **Out**.

---

## 한 줄 요약

식대 잔액 이메일 dispatch 시 **매칭된 슬롯(1|2)** 에 따라 이메일 subject/HTML 헤더·text intro·사용자 인앱 알림 title/body를 서로 다른 **고정 카피**로 발송하고, `notifications.metadata.slot`에 기록한다. 설정 Sheet/entry에는 슬롯별 고정 라벨을 표시하며, admin 발송 로그 UI에서 수신자 행에 슬롯을 보여준다.

---

## deep-interview 확정 (2026-09-29 · A/A/A)

| # | 결정 |
|---|------|
| Q1 Copy | 슬롯1·2 각각 이메일 subject/HTML title·subtitle/text intro·인앱 title/body **고정 문구** (아래 Copy 표) |
| Q2 Scope | 이메일·`wallet.balance_email`·Settings Sheet/entry 고정 라벨 **In** · admin `wallet.balance_email_admin`·사용자 커스텀·copy DB **Out** |
| Q3 Slot tracking | `notifications.metadata.slot`: `1` \| `2` · dispatch slot 판별 · balance-email-logs UI 슬롯 표시 **In** |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | eligible user, slot1=09:00, enabled, allowlist, dry-run | KST 09:00 dispatch | recipient `sent` · notification `title`=「식대 잔액 안내」·`body`=「남은 식대를 확인해 보세요.」·`metadata.slot`=**1** |
| AC-02 | API | slot1=09:00, `slot2_enabled=true`, slot2=18:30 | KST **18:30** dispatch | notification `title`=「식사 맛있게 하셨나요?」·`body`=「남은 식대를 한번 더 확인해 보세요.」·`metadata.slot`=**2** |
| AC-03 | API | AC-02 조건, SMTP mock/stub | slot2 dispatch sent | email `subject`=「[WakeOne] 식사 맛있게 하셨나요?」·HTML에 「식사 후 남은 식대 잔액을 확인해 보세요.」 |
| AC-04 | API | AC-01 조건, SMTP mock/stub | slot1 dispatch sent | email `subject`=「[WakeOne] 식대 잔액 안내」·HTML subtitle 「오늘 사용 가능한 식대 잔액입니다.」 |
| AC-05 | Playwright | matched ≥ 1, slot2 enabled | Sheet 열기 | `getByText('알림 1 · 식대 잔액 안내')` · `getByText('알림 2 · 식사 맛있게 하셨나요?')` visible |
| AC-06 | Playwright | enabled, slot1=12:15, slot2=18:30 | entry card | summary에 「알림 1 · 식대 잔액 안내」+ 12:15 · 「알림 2 · 식사 맛있게 하셨나요?」+ 18:30 |
| AC-07 | Playwright | admin, slot2 dispatch run 존재 | run Dialog 수신자 테이블 | 해당 row **「알림 2」** Badge 또는 슬롯 컬럼 |
| AC-08 | Playwright | user, slot1 dispatch 성공 | `/dashboard/notifications` | 「식대 잔액 안내」·「남은 식대를 확인해 보세요.」·CTA 「식대 카드 보기」 (plan 51 유지) |
| AC-09 | API | due **0명** | dispatch | HTTP 200 · `run: null` · admin/user 알림 **0건** (plan 51 AC-NEW-01 유지) |
| AC-10 | CLI | 구현 완료 | `bunx playwright test e2e/wallet-balance-email/` · tsc · lint · build | green · allowlist 외 sent 0건 · E2E cleanup pass |

**Dashboard presence:** 신규 `/dashboard/*` 페이지 없음 — `dashboard/layout` `DashboardPresenceTrack` 상속 변경 **불필요** (plan 49).

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **Copy constants** | 슬롯1·2 이메일·인앱·설정 라벨 — SSOT 1파일 |
| B | **Mail** | `sendWalletBalanceEmail({ slot: 1 \| 2, ... })` — subject·HTML title/subtitle·text intro 분기 |
| C | **Due user** | `listDueWalletBalanceEmailUsers` — tick vs preferences로 `matched_slot` 판별 |
| D | **User in-app** | `insertWalletBalanceEmailNotification` — 슬롯별 title/body + `metadata.slot` |
| E | **Settings UI** | Sheet: `알림 N · {settingsLabel}` + 시각 Select |
| F | **Entry card** | enabled 시 슬롯별 고정 라벨 + 시각 요약 |
| G | **Logs UI** | run Dialog 수신자 테이블 슬롯 컬럼/Badge |
| H | **Logs API (Read)** | recipient `slot` — notification join 또는 tick+preferences 역추론 |
| I | **E2E** | AC-01~10 · plan 51 BLOCKER grep |

### Out Scope

- `wallet.balance_email_admin` 카피 변경
- 사용자 커스텀 제목/본문
- copy용 DB 컬럼·SQL migration
- preferences PATCH 스키마 변경
- pg_cron·allowlist BLOCKER·Production MODE 전환
- notification INSERT용 **신규** activity action
- per-recipient activity log metadata `slot` 확장 (선택·AC 불필요)

---

## Copy 표 (확정)

| 필드 | Slot 1 | Slot 2 |
|------|--------|--------|
| Email subject | `[WakeOne] 식대 잔액 안내` | `[WakeOne] 식사 맛있게 하셨나요?` |
| Email HTML title | 식대 잔액 안내 | 식사 맛있게 하셨나요? |
| Email HTML subtitle | 오늘 사용 가능한 식대 잔액입니다. | 식사 후 남은 식대 잔액을 확인해 보세요. |
| Email text intro | 오늘 사용 가능한 식대 잔액입니다. | 식사 후 남은 식대 잔액을 확인해 보세요. |
| In-app title | 식대 잔액 안내 | 식사 맛있게 하셨나요? |
| In-app body | 남은 식대를 확인해 보세요. | 남은 식대를 한번 더 확인해 보세요. |
| Settings label | 식대 잔액 안내 | 식사 맛있게 하셨나요? |

**UI 고정 라벨 형식:** `알림 1 · 식대 잔액 안내` / `알림 2 · 식사 맛있게 하셨나요?` (+ entry card에 시각 `HH:mm`).

**슬롯 무관 (plan 51 유지):** snapshot 카드(지급액·남은 식대) · CTA 「식대 카드 보기」「알림 설정 변경」 · disclaimer · 푸터 · 인앱 CTA.

---

## Copy constants 위치

**신규:** `src/features/wallet/constants/wallet-balance-email-slot-copy.ts`

```typescript
export type WalletBalanceEmailSlot = 1 | 2;

export const WALLET_BALANCE_EMAIL_SLOT_COPY = {
  1: { emailSubject, emailHtmlTitle, emailHtmlSubtitle, emailTextIntro, inAppTitle, inAppBody, settingsLabel },
  2: { ... }
} as const;
```

| 소비처 | import |
|--------|--------|
| `send-wallet-balance-email.ts` | slot → copy |
| `fan-out.server.ts` | slot → in-app title/body |
| Sheet / entry | `settingsLabel` → `알림 N · {settingsLabel}` |
| E2E helpers | 동일 문자열 assert |

**금지:** copy를 mail·fan-out·FE에 **각각 하드코딩**.

---

## BE 요구사항

### Slot 판별 — `listDueWalletBalanceEmailUsers`

**현재 문제:** due 쿼리는 slot1 OR slot2를 매칭하지만 반환 `hour`/`minute`는 항상 slot1 값.

**변경:**

```
tick = (hour, minute)
slot1Match = pref.hour === hour && pref.minute === minute
slot2Match = pref.slot2_enabled && pref.hour2 === hour && pref.minute2 === minute
matched_slot = slot2Match ? 2 : 1  // duplicate schedule은 PATCH 400으로 불가
```

- `WalletBalanceEmailDueUser`에 `matched_slot: 1 | 2` 추가.
- dispatch → `sendWalletBalanceEmail({ slot: user.matched_slot, ... })`.
- dispatch → `insertWalletBalanceEmailNotification({ slot: user.matched_slot, ... })`.

### Mail — `send-wallet-balance-email.ts`

- 파라미터 `slot: WalletBalanceEmailSlot` 추가.
- `WALLET_BALANCE_EMAIL_SLOT_COPY[slot]`에서 subject·HTML title/subtitle·text intro 사용.

### In-app fan-out — `fan-out.server.ts`

- `InsertWalletBalanceEmailNotificationInput`에 `slot: 1 | 2`.
- metadata: `{ kind: 'wallet.balance_email', run_id, slot: 1 | 2 }` — 금액·이메일 **금지**.

### Logs API (Read)

- `GET /api/wallet/balance-email/logs/[runId]` — recipient에 `slot?: 1 | 2 | null`.
- `notification_id` 있으면 `notifications.metadata.slot` join.
- `blocked`/`skipped`/`failed`(인앱 미생성): run `run_key` KST tick + user preferences **역추론**.

---

## FE 요구사항

### Settings Sheet (`wallet-balance-email-settings-sheet.tsx`)

| UI | 값 |
|----|-----|
| 슬롯1 헤더 | `알림 1 · 식대 잔액 안내` |
| 슬롯2 헤더 | `알림 2 · 식사 맛있게 하셨나요?` |
| 시·분 Select | plan 55 유지 |
| `+ 알림 추가` / `−` | plan 55 유지 |

### Entry card (`wallet-balance-email-settings-section.tsx`)

- enabled + slot2 ON: 슬롯별 `알림 N · {label} HH:mm` (2줄 또는 wrap).
- slot2 OFF: `알림 1 · 식대 잔액 안내 HH:mm` + 기존 평일/매일·토·일 Badge.

### Balance email logs UI

- `recipients-infinite-table.tsx`: **슬롯** 컬럼 — `알림 1` / `알림 2` Badge · null → `—`.

### Notifications UI

- BE fan-out이 올바른 title/body INSERT — **추가 FE 분기 불필요**.

---

## 활동 감사 로그

> [plan 08](./08_activity-audit-log-plan.md)

**activity log 해당 없음 (신규 CUD Route·action 없음).**

| 구분 | 내용 |
|------|------|
| **Out** | 신규 Route·CUD·action |
| **유지** | plan 51 `wallet.balance_email_pref_update` / `send` / `blocked` / `failed` / `dispatch` — **회귀 green** |
| **Out** | `wallet.balance_email_admin` notification INSERT activity log (plan 55) |
| **Out** | READ (preferences GET, logs GET, notifications GET) |

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | allowlist 우회 실발송 | plan 51 BLOCKER·E2E dry-run·grep AC 유지 |
| MED | slot2 dispatch인데 slot1 copy 발송 | `matched_slot` 판별 + AC-02·AC-03 |
| MED | blocked/skipped recipient slot null | tick+preferences 역추론 helper 단일화 |
| LOW | entry 2슬롯 레이아웃 깨짐 | `flex-wrap` · 기존 Card 패턴 |
| LOW | 배포 전 notification metadata.slot 없음 | 로그 UI null → `—` · 신규 dispatch부터 AC |

---

## Rollback

- copy constants 삭제 + mail/fan-out/due user slot 파라미터 revert → plan 55 동작 복귀.
- DB migration 없음 — SQL rollback **불필요**.

---

## E2E (`e2e/wallet-balance-email/`)

| spec | AC |
|------|-----|
| `dispatch.api.spec.ts` | AC-01~04 · AC-09 · slot metadata |
| `notifications.spec.ts` | AC-08 |
| `00-preferences-ui.spec.ts` | AC-05 · AC-06 |
| `balance-email-logs.spec.ts` | AC-07 |
| `helpers.ts` | slot query · copy assert helper |

- storageState 재사용 · plan 51 allowlist·dry-run 전제.
- cleanup: E2E preferences·runs·notifications.

---

## env

plan 51 **변경 없음** — `WALLET_BALANCE_EMAIL_MODE`, `ALLOWLIST`, `CRON_SECRET`, `E2E_WALLET_BALANCE_EMAIL_DRY_RUN`.

---

## 구현 순서 (팀 handoff)

1. **backend-dev:** copy constants · `matched_slot` · mail/fan-out · logs API slot 필드
2. **designer:** Sheet/entry 슬롯 라벨 · logs 슬롯 컬럼 wireframe
3. **frontend-dev:** Sheet/entry 라벨 · logs 테이블 슬롯 컬럼
4. **verifier:** E2E AC-01~10 · plan 51 BLOCKER grep · build

---

## 변경 파일 (예상)

```
src/features/wallet/constants/wallet-balance-email-slot-copy.ts   — 신규
src/lib/mail/send-wallet-balance-email.ts
src/features/wallet/api/balance-email.types.ts
src/features/wallet/api/balance-email.service.server.ts
src/app/api/wallet/balance-email/dispatch/route.ts
src/features/notifications/api/fan-out.server.ts
src/features/wallet-balance-email-logs/api/service.server.ts
src/features/wallet-balance-email-logs/api/types.ts
src/features/wallet-balance-email-logs/components/.../recipients-infinite-table.tsx
src/features/wallet/components/wallet-balance-email-settings-sheet.tsx
src/features/wallet/components/wallet-balance-email-settings-section.tsx
e2e/wallet-balance-email/dispatch.api.spec.ts
e2e/wallet-balance-email/notifications.spec.ts
e2e/wallet-balance-email/00-preferences-ui.spec.ts
e2e/wallet-balance-email/balance-email-logs.spec.ts
e2e/wallet-balance-email/helpers.ts
docs/plans/README.md
```

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-29 | 최초 작성 (Approved) — 슬롯별 copy·metadata.slot·로그 UI · SQL 없음 | planner |
