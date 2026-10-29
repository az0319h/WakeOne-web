# 동방특송 노출 범위 감사 · 서버 제외 일원화 기획서

> Date: 2026-10-27
> Status: Completed
> Author: planner
> **퀵 2차(94~101) 중 2번째.** 선행: [94](./94_quick-realtime-and-small-fixes-plan.md) 완료 후 착수(코드 의존은 없음 · 순서 규칙)
> **SQL:** `supabase/sql/94_dongbang_visibility_rls.sql` — **생성·Dev 적용 완료**(2026-10-27 · backend-dev · `apply_migration` `94_dongbang_visibility_rls` · version `20261027134925`). `qual='true'` 정책은 0건이었으나 워크플로우 양식 4테이블의 「로그인 전원 허용」 SELECT 정책에 `not private.is_dongbang_user(...)`를 추가(D-8 · S-12). Main 미적용(사용자 수동)
> **brief 항목:** 16(동방특송 노출 범위)
> **확장:** [89](./89_quick-workflow-dongbang-openchat-plan.md) D-4(동방 제외 목록)를 「퀵·본인 프로필·알림·활동 로그 외 **전부 제외**」로 넓힌다 · [91](./91_pwa-web-push-notifications-plan.md) 그룹 카탈로그를 동방에게 2그룹만 노출
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [25](./25_activity-logs-ui-improvement-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [32](./32_wallet-kbcard-sync-plan.md), [42](./42_cs-support-plan.md), [74](./74_admin-my-benefits-proxy-plan.md), [76](./76_hr-benefits-manager-access-plan.md), [88](./88_workflow-expense-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [91](./91_pwa-web-push-notifications-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **89** | In Progress | D-4·D-5(allowlist)·`EXCLUDE_DONGBANG_OR_FILTER`·`private.is_dongbang_user`·공지 RLS를 **그대로 쓰되** 적용 범위를 전수로 넓힌다. allowlist(페이지·API) 자체는 변경 없음 |
| **91** | Completed | 푸시 그룹 카탈로그(`push-groups.ts` `admin_only`)에 **`dongbang_visible`** 개념 추가 → 동방은 `quick_request`·`profile`만. `insertNotifications()` 단일 지점에 **동방 수신 가드** |
| **27 · 42 · 32 · 74 · 76** | 각 Approved/Completed | admin 「타인 보기」 콤보(`notif_user`·`benefits_user`·`wallet` 콤보·CS 필터)의 후보 목록이 `GET /api/users`를 공유한다 → 기본 제외 + 예외 2곳(활동 로그·알림) |
| **25** | Approved | 활동 로그 「사용자 선택」 콤보는 **동방 포함**(admin이 동방 직원 로그를 봐야 함 · 사용자 답변 Q6) |
| **08** | Approved | 신규 CUD Route 없음(READ 필터·알림 가드) → 「activity log 해당 없음」 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 이미 제외됨 | `listActiveUserIds`(공지 fan-out) · 생일 배너 · 복지비 명단 · 워크플로우 결재선 · 조직도(소속별 조회) · Live 접속자(89) · 공지 RLS(`is_dongbang_user`) | `EXCLUDE_DONGBANG_OR_FILTER` 사용처 5파일 · SQL 89 L375~391 |
| **미적용 후보** | `GET /api/users`(`listUsersForAdmin` · 소속 필터 없음) → 이 API를 쓰는 콤보 7곳(활동 로그·알림·식대 카드·내 복지비 proxy·CS 필터) · `contracts/service.server.ts:1030`(이름 매칭 active 전원) · `wallet/service.server.ts:141`·`wallet-balance-email-logs:121`(이름 매칭) · `support/service.server.ts:222`(admin 목록) · `activity-logs/service.server.ts:116`(표시용 조인 · 유지) · `push-dispatch.server.ts:43`(수신자 기반 · 유지) | grep `from('profiles')` 14파일 |
| 알림 생성 | 알림 INSERT는 `insertNotifications()` 1곳(91 AC-17) → 동방 가드를 여기에 두면 모든 fan-out이 한 번에 걸러진다 | `src/features/notifications/api/insert.server.ts` |
| 푸시 그룹 | `PUSH_NOTIFICATION_GROUPS` 카탈로그 `admin_only`만 있음 · GET preferences가 역할로 필터 | `push-groups.ts:25~46` |
| `profiles` RLS | `profiles_select_self_or_admin`(본인 또는 admin) → 일반 사용자가 클라이언트로 동방 프로필을 직접 읽을 수 없음(안전) | SQL 01·03 |
| 사용자 관리 | `/dashboard/users`·승인/수정 Sheet는 동방 소속 변경을 위해 **보여야 함** | 사용자 답변 Q6 |

---

## 한 줄 요약

동방특송 계정이 **퀵 화면·본인 프로필·알림·활동 로그 밖**에서는 어디에도 나타나지 않도록 **서버에서** 걸러낸다. 사용자 목록 API는 기본으로 동방을 빼고, 예외 3곳(사용자 관리 · 활동 로그 「사용자 선택」 · 알림 「타인 보기」)만 명시적으로 포함한다. 동방에게 가는 알림은 **퀵 + 본인 프로필 변경** 2그룹만 생성되고, 푸시 설정 Dialog에도 그 2그룹만 보인다. 이름 매칭(계약서·식대 카드)도 동방을 후보에서 뺀다.

---

## 정책 확정안 (deep-interview Q6 · brief 16)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 원칙 | **서버 제외(기본 거부).** 프로필 목록을 돌려주는 모든 서버 코드는 `excludeDongbang`을 **기본값 true**로 적용하고, 예외는 호출부가 `includeDongbang: true`를 **명시**한다. 클라이언트 필터링만으로 끝내지 않는다 |
| D-2 | 보여야 하는 3곳 | ① `/dashboard/users` 목록·승인/수정 Sheet·프로필 모달 ② 활동 로그 「사용자 선택」 콤보(`log-user-combobox`) ③ 알림 페이지 admin 「타인 보기」 콤보(`notif-user-combobox`). 이 3곳의 `GET /api/users` 호출은 `?includeDongbang=1` |
| D-3 | 제외되는 곳 | `GET /api/users` 기본 · 식대 카드 콤보(`wallet-user-combobox`) · 내 복지비 admin proxy(`benefits_user`·`my-benefits-dashboard`) · CS 문의 필터(`support-list-filters`) · 계약서 이름 매칭(`contracts/service.server.ts`) · 식대 카드 동기화 이름 매칭(`wallet/service.server.ts`) · 식대 잔액 메일 대상(`wallet-balance-email-logs`·`balance-email.service.server.ts`) · CS admin 목록(`support/service.server.ts`) · (이미 제외) 공지·생일·복지비·워크플로우·조직도·Live |
| D-4 | 알림 생성 가드 | `insertNotifications(rows)`에서 **수신자가 동방이면 `groupOfType(type) ∈ {quick_request, profile}`인 행만 남긴다.** 나머지는 insert 전에 버린다(`console.warn` 1줄 · 호출부 반환값은 남은 행 기준). 퀵 알림 규칙(92·93·94)은 변화 없음 |
| D-5 | 푸시 그룹 | `PushNotificationGroup`에 `dongbang_visible: boolean` 추가 — `quick_request`·`profile`만 true. `GET /api/notifications/push/preferences`가 동방이면 그 2개만 `groups`로 돌려주고, `PUT`에서 동방이 다른 그룹을 보내면 **400** 「알림 종류가 올바르지 않습니다.」(기존 문구) |
| D-6 | 활동 로그 표시 | 로그 행의 actor 이름 조인(`activity-logs/service.server.ts:116`)은 **유지**(동방 행위 로그는 보여야 함). 동방 본인의 `/dashboard/logs`는 본인 행만(기존) |
| D-7 | 감사 산출물 | backend-dev가 **감사표**(파일 · 쿼리 · 현재 동방 포함 여부 · 조치 · 검증 AC)를 이 plan §감사표에 **줄 번호와 함께 완성**한다(AC-01). 표에 없는 `from('profiles')` 호출이 남으면 FAIL |
| D-8 | RLS | `pg_policies`에서 `qual = 'true'`(authenticated 전체 허용) SELECT 정책을 가진 public 테이블을 나열하고, 동방이 읽어서는 안 되는 테이블(예: 워크플로우 양식·공지 첨부 외)이 있으면 `not private.is_dongbang_user(auth.uid())`를 추가한다(SQL 94). 0건이면 SQL 없음 |
| D-9 | 사용자 관리 필터 | Users 표 「소속」 필터에 「동방특송」이 있으므로 변경 없음. 동방 행에 보조 배지 「퀵 전용」 **Out**(요청 없음) |

### 감사표 (backend-dev 완성 · AC-01 · 2026-10-27)

> 기준: `grep -rn "from('profiles')" src --include=*.ts --include=*.tsx` = **42건**(구현 후 줄 번호). 분류 **A** 이번에 서버 제외 적용 · **R** 이미 제외(회귀만) · **K** 유지(본인/단건 id/admin 관리/퀵·로그 허용 범위) · **G** 가드 자체. 아래 표 밖 매치 0건. `benefits/api/service.server.ts`는 `from("profiles")`(큰따옴표)라 위 grep에 잡히지 않지만 R로 함께 등재. 경로는 `src/` 상대.

| # | 파일:줄 | 용도 | 현재 | 조치 | 분류 | 검증 |
|---|---------|------|------|------|------|------|
| S-1 | `features/users/api/service.server.ts:370,389` `listUsersForAdmin` | `GET /api/users` count·data | 포함 | `applyDongbangScope(query, { includeDongbang })` **두 쿼리 모두** · 기본 false | A | AC-02·03 |
| S-2 | `app/api/users/route.ts:47-48` | 쿼리 파싱 | — | `includeDongbang=1` → `true` · `requireAdminSession` 뒤 | A | AC-02 |
| S-3 | `features/contracts/api/service.server.ts:1032` | 계약 이름 매칭 후보(active) | 포함 | `applyDongbangScope` → 동방 이름 unmatched | A | AC-05④ |
| S-4 | `features/wallet/api/service.server.ts:142` `buildProfileNameIndex` | KB카드 이름 매칭 | 포함 | `applyDongbangScope` | A | AC-05⑤ |
| S-5 | `features/wallet/api/balance-email.service.server.ts:284` · `features/wallet-balance-email-logs/api/service.server.ts:122` | 잔액 메일 대상(단건 maybeSingle) · 로그 표시 이름 조인 | 포함 | `applyDongbangScope` → 대상 skip · 로그 `recipient_full_name` null(기존 fallback) | A | AC-05⑤ |
| S-6 | `features/support/api/service.server.ts:224` `fetchProfilesByUserIds` | CS 작성자/담당 표시 조인 | 포함 | `applyDongbangScope` → 미조인 시 기존 `'알 수 없음'` fallback(`:153`) | A | AC-05③ |
| S-7 | `features/notifications/api/insert.server.ts:56` `listDongbangRecipientIds` | 알림 INSERT 가드(동방 수신자 판별 1회 조회) | 가드 없음 | D-4: 동방 수신자 + `groupOfType ∉ {quick_request, profile}` 행 drop · `console.warn` 1줄 · 반환은 남은 행 | G | AC-06·07 |
| S-8 | `features/notifications/lib/push-groups.ts` `dongbang_visible` · `listPushGroupsForRole(role,{dongbang})` · `isPushGroupVisibleForDongbang` · `app/api/notifications/push/preferences/route.ts` GET/PUT | 그룹 카탈로그 | 동방 8그룹 | D-5: GET 2그룹 · PUT 비가시 그룹 → 400 `PUSH_INVALID_GROUP_MESSAGE` | A | AC-08 |
| S-9 | `features/activity-logs/api/service.server.ts:115,136` | 로그 actor 조인 · 이름 검색 | 포함 | **유지**(D-6 · 동방 행위 로그는 보여야 함) | K | AC-04 |
| S-10a | `features/birthday-celebrants/api/service.server.ts:60` `getBirthdayCelebrantsServer` | 생일 카드(plan 102 휠 목록 · `GET /api/birthdays`) | 제외(`applyDongbangScope` `:60` · 2026-10-29 plan 102에서 `.or(EXCLUDE…)` 대체) | 회귀만 | R | AC-09 |
| S-10b | `features/benefits/api/service.server.ts:155,287` (`from("profiles")`) | 복지비 관리 명단 · 신청자 이름 매칭 | 제외(`:158,290`) | 회귀만 · **BE-7 Dev DB 재확인: 명단 쿼리 재현 결과 동방 0건 / 전체 47명** | R | AC-09 |
| S-10c | `features/workflow/api/service.server.ts:146` `listActiveMembers` | 결재선 콤보 | 제외(`:149`) | 회귀만 | R | AC-09 |
| S-10d | `features/workflow/api/service.server.ts:129` | 문서 구성원 id 조인 | id 기반(동방은 결재선에 들어갈 수 없음) | 유지 | K | AC-09 |
| S-10e | `features/notifications/api/fan-out.server.ts:173` `listActiveUserIds` · `:236` `listMatchedAuthorUserIds` | 공지 fan-out · 계약 author 매칭 | 제외(`:176,240`) | 회귀만 | R | AC-06·09 |
| S-10f | `features/notifications/api/fan-out.server.ts:216` `listActiveAdminUserIds` · `:677` `listActiveBenefitOperationsUserIds` · `:721` `getActiveProfileDisplayName` | admin 목록 · 복지 운영진(후처리: affiliation/rank 판정 · 동방 rank null) · 단건 표시명 | 동방 해당 없음 | 유지(+ S-7 가드가 최종 방어) | K | AC-06 |
| S-10g | `features/org-chart/api/service.server.ts:309` `fetchGroupCeoProfile` · `:360` `listOrgChartProfiles` | 조직도 | 제외(`position_level='CEO'` 단건 · `eq('affiliation', ORG_AFFILIATIONS)` · 동방은 position_level null) | 회귀만 | R | AC-09 |
| S-11 | `features/notifications/api/push-dispatch.server.ts:42` `listActiveRecipientIds` | 푸시 수신자 active 확인 | 수신자 id 기반 | 유지(가드는 S-7) | K | AC-07 |
| S-13 | `features/quick-request/api/workflow.server.ts:374,537` · `features/quick-request/api/messages.server.ts:163` | 퀵 담당자/배차/채팅 이름·수신자 | 포함 | 유지 — 퀵 화면은 허용 범위 | K | AC-11 |
| S-14 | `app/api/users/[id]/route.ts:157,450,576,656,685,790,852` · `app/api/users/[id]/approval/approve/route.ts:122,241` · `app/api/users/[id]/approval/reject/route.ts:102,170` · `features/users/api/service.server.ts:58,168` | 사용자 관리(단건 id · 이메일 단건 · update) | admin 전용 | 유지 — D-2① 동방 소속 변경을 위해 보여야 함 | K | AC-03 |
| S-15 | `features/auth/api/session.server.ts:63,82,119` · `features/auth/api/service.ts:19` · `app/api/auth/google/callback/route.ts:224` | 본인 세션 프로필(단건 `eq('user_id', 본인)`) | 본인 | 유지 — 본인 프로필은 허용 범위 | K | AC-11 |
| S-16 | `features/activity-logs/api/log.server.ts:534` `fetchUserTargetLabel` · `lib/supabase/middleware.ts:100` (큰따옴표 `from("profiles")`) | 활동 로그 target 라벨 단건 · 미들웨어 본인 세션 플래그 단건 | id 기반 단건(`eq('user_id', …)`) | 유지 — verifier AC-01 큰따옴표 grep으로 발견 · 감사표 보강(2026-10-27) | K | AC-01 |
| S-17 | `features/quick-request/api/participants.server.ts:62,107,250` | 퀵 채팅 참여자(plan 101) — 참여자 이름 단건 조회(`in('user_id', …)`) · active 동방 목록(퀵 화면 허용 범위) · **초대 후보 검색** | 후보는 요청자·admin만 · 동방 제외 | 후보 검색(L250)에 **`applyDongbangScope` 적용**(+ admin·pending·요청자·본인 제외) · 나머지 2곳은 퀵 화면 허용 범위(S-13과 같음) · verifier(101) AC-01 grep으로 등재(2026-10-28) | A·K | AC-01 |
| S-12 | `pg_policies` SELECT 감사(Dev MCP) | RLS | `qual='true'` **0건**. 「로그인 전원 허용」 4개: `workflow_templates_select`(is_active…) · `workflow_template_fields_select`(templates cascade) · `workflow_template_default_approvers_select`·`_referrers_select`(`auth.uid() is not null`). 그 밖 전부 본인/admin/문서·퀵 가시성 함수로 제한. 적용 전 동방 세션: templates 1 · fields 15 · approvers 0 · referrers 0 | **SQL 94 적용**: 4정책에 `and not private.is_dongbang_user((select auth.uid()))` · 적용 후 동방 세션 4테이블 **0행** · 비동방 user 세션 templates 1 · fields 15(불변) | A | AC-10 |

---

## 목표 & 완료 기준 (AC)

공통: 계정 `admin.json`·`user.json`·`dongbang.json`·`hr.json`(복지비 관리자 · 76)·`logistics.json`. 동방 fixture는 `createOrgChartTestUser({affiliation:'dongbang'})`(89).

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | 문서·grep | 구현 완료 | `grep -rn "from('profiles')" src --include=*.ts --include=*.tsx` 결과 전부 | §감사표에 **파일:줄 전부 등재**(누락 0) · 각 행 「조치」·「검증」 채움 · 표 밖 매치 0 |
| AC-02 | API | `admin.json` · 동방 active 1명 | `GET /api/users?limit=200` / `GET /api/users?limit=200&includeDongbang=1` / `user.json`으로 `…&includeDongbang=1` | 기본: 동방 **0건** · `includeDongbang=1`: 동방 **1건** · 일반 user는 기존대로 403(admin 전용 API) |
| AC-03 | Playwright | `admin.json` | `/dashboard/users` 목록 · 수정 Sheet 열기 | 동방 사용자 **보임** · 소속 「동방특송」 · 수정 가능(89 AC-02 회귀) |
| AC-04 | Playwright | `admin.json` | `/dashboard/logs` 「사용자 선택」 콤보 · `/dashboard/notifications` 「타인 보기」 콤보 | 두 콤보에 동방 이름 **있음** · 선택 시 동방의 로그/알림 조회 200 |
| AC-05 | Playwright·API | `admin.json`·`hr.json` | ① `/dashboard/wallet` 사용자 콤보 ② `/dashboard/my-benefits?benefits_user=` 콤보(hr·admin) ③ `/dashboard/support` 필터 콤보 ④ 계약서 `POST /api/contracts/import`(OpenClaw) 이름이 동방 직원 이름과 같은 fixture ⑤ 식대 동기화 fixture에 동방 이름 | ①②③ 동방 **0건** ④ 매칭 **실패**(동방 미매칭 · `unmatched` 처리) ⑤ 매칭 0 · 잔액 메일 대상 0 |
| AC-06 | API·DB | 동방 active 1명 · `admin.json` | 공지 1건 발행 · 워크플로우 결재 요청 1건(동방을 결재선에 넣을 수 없으므로 fan-out만) · CS 문의 등록 · 복지비 import | dev DB `notifications` `recipient_user_id = 동방`인 행 **0건**(퀵·`user.update` 제외) · `console.warn` 가드 메시지 ≥ 1(서버 로그 · 선택) |
| AC-07 | API·DB | 동방 active · 구독 1개(mock endpoint) | admin이 동방 프로필 이름 변경 · `user.json` 퀵 등록 | 동방 알림 2건(`user.update`·`vendor_event`) · 푸시 발송 2건(`last_used_at` 갱신) · 그 밖 0 |
| AC-08 | API·Playwright | `dongbang.json` | `GET /api/notifications/push/preferences` · 알림 페이지 「휴대폰 알림 설정」 Dialog · `PUT {disabled_groups:['announcement']}` | `groups` **2개**(`quick_request`·`profile`) · Dialog Switch 2개 · PUT **400** 「알림 종류가 올바르지 않습니다.」 · `PUT {disabled_groups:['quick_request']}` 200 |
| AC-09 | Playwright | `user.json`·`admin.json` | 89 AC-07(조직도·복지비 명단·공지 fan-out 0건) · 생일 배너 · Live 접속자 | 전부 green(회귀) |
| AC-10 | SQL (Dev MCP) | — | `select tablename, policyname from pg_policies where schemaname='public' and cmd='SELECT' and qual='true'` | 결과를 §감사표 S-12에 기록 · 동방이 읽으면 안 되는 테이블은 SQL 94로 `not private.is_dongbang_user(...)` 추가 · 적용 후 동방 세션 `select` **0행**(AC-06과 함께) · 0건이면 「SQL 없음」 수정 이력 기록 |
| AC-11 | API | `dongbang.json` | 89 AC-04·05·06(allowlist) | 변경 없음 · green |
| AC-12 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/users e2e/notifications e2e/push-notifications e2e/quick-workflow/access.spec.ts e2e/wallet e2e/benefits e2e/support e2e/org-chart` | 모두 통과 |

**AC 총 12개.**

---

## 범위 (In / Out)

### In
1. `listUsersForAdmin` `includeDongbang` 옵션 + Route 파싱 + 콤보 3곳 호출부 수정(`log-user-combobox`·`notif-user-combobox`·users 페이지 query)
2. 이름 매칭·대상 조회 4곳 제외(S-3~S-6)
3. `insertNotifications` 동방 가드(D-4) + `push-groups.ts` `dongbang_visible` + preferences GET/PUT 필터
4. RLS 감사(D-8) + 필요 시 SQL 94
5. 감사표 완성(D-7) · E2E 신규 `e2e/quick-round2/95-dongbang-visibility.spec.ts` · 회귀
6. README 95 등록 · 89/91 수정 이력 1행

### Out
| 항목 | 이유 |
|------|------|
| 동방 allowlist(페이지·API) 변경 | 89 그대로. 이 plan은 「남에게 보이는 곳」만 |
| Users 표 「퀵 전용」 배지 | 요청 없음 |
| 활동 로그 actor 조인 제외 | 감사 추적성(D-6) |
| 동방이 **받는** 퀵 알림 규칙 변경 | 92·93·94 범위 |
| 과거에 이미 생성된 동방 수신 알림 삭제 | 감사·이력 보존(0건일 것으로 예상 · AC-06은 신규 생성만 판정) |
| Main DB 적용 | 사용자 수동 |

---

## UI 요구사항 (designer 지시)

- 새 화면·새 컴포넌트 없음. 콤보 3곳의 후보 목록이 줄어들 뿐이다.
- 푸시 설정 Dialog(91)에서 동방은 Switch 2개만 보인다. 빈 설명 없이 기존 행 레이아웃 유지.
- designer 산출물: 「변경 없음」 확인 메모 1줄.

---

## API / DB 요구사항

| Route | 변경 |
|-------|------|
| `GET /api/users` | `includeDongbang=1`(admin 전용 · 기본 false) |
| `GET /api/notifications/push/preferences` | 동방이면 `groups` 2개 |
| `PUT /api/notifications/push/preferences` | 동방 + 비가시 그룹 → 400 |
| 그 밖 READ 서비스 4곳 | 쿼리에 `.or(EXCLUDE_DONGBANG_OR_FILTER)` |

공용 helper: `src/features/users/api/profile-scope.server.ts` `applyDongbangScope(query, { includeDongbang })`(한 곳에서 `.or(EXCLUDE_DONGBANG_OR_FILTER)` 적용 · 신규 호출부가 빠뜨리지 않도록 서비스 계층 진입점으로 사용).

SQL 94(조건부): `create policy … using (… and not private.is_dongbang_user((select auth.uid())))` — 대상 테이블은 AC-10 결과로 확정.

---

## 활동 감사 로그

> **activity log 해당 없음** — READ 필터·알림 생성 가드·푸시 설정 응답 필터만 바꾼다. `PUT preferences` 400 분기는 기존 `push_preference.update` 로그(91)에 이미 기록된다. 신규 CUD Route 없음. 삭제 UI 없음.

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `src/features/users/api/{service.server,profile-scope.server(신규)}.ts` · `src/app/api/users/route.ts` · `src/features/contracts/api/service.server.ts` · `src/features/wallet/api/{service.server,balance-email.service.server}.ts` · `src/features/wallet-balance-email-logs/api/service.server.ts` · `src/features/support/api/service.server.ts` · `src/features/notifications/api/insert.server.ts` · `src/features/notifications/lib/push-groups.ts` · `src/app/api/notifications/push/preferences/route.ts` · (조건부) `supabase/sql/94_dongbang_visibility_rls.sql` |
| FE | `src/features/activity-logs/components/log-user-combobox.tsx` · `src/features/notifications/components/notif-user-combobox.tsx` · `src/features/users/api/queries.ts`(`includeDongbang` 파라미터) · `src/features/notifications/components/push-preferences-dialog.tsx`(groups 응답 그대로 렌더 · 변경 최소) |
| verifier | `e2e/quick-round2/95-dongbang-visibility.spec.ts`(신규) · 회귀 8 디렉터리 |

**패턴:** `EXCLUDE_DONGBANG_OR_FILTER`(89) · `listActiveUserIds`(fan-out) · `groupOfType`(91) · `jsonWithActivityLog`.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 감사 누락(새 호출부가 다시 동방을 노출) | `applyDongbangScope` 진입점 + AC-01 grep 전수 대조 + 알림은 단일 가드(S-7) |
| MED | `GET /api/users` 기본 제외로 사용자 관리 페이지가 동방을 못 봄 | users 페이지 query에 `includeDongbang=1` 명시 · AC-03 |
| MED | 알림 가드가 퀵 알림까지 거름(그룹 매핑 오류) | `groupOfType` exhaustive(91) · AC-07 |
| LOW | RLS 추가로 동방의 퀵 화면이 깨짐(퀵 테이블은 대상 아님) | AC-10 대상을 「동방이 읽으면 안 되는」 테이블로 한정 · AC-11 회귀 |

**롤백:** 코드 revert · SQL 94는 정책 drop.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | root Step 0 백업 | — | HIGH | — |
| 1 | BE: 감사표 완성(grep 전수 · pg_policies) → S-1·S-2 옵션 → S-3~S-6 제외 → S-7 가드 → S-8 그룹 → (조건부) SQL 94 → tsc | API·가드 | HIGH | 0 |
| 2 | FE: 콤보 3곳 `includeDongbang=1` · queries 파라미터 | UI | HIGH | 1 |
| 3 | verifier: 신규 spec(AC-02~08·10) + 회귀(AC-09·11·12) | green | MED | 2 |

**추정:** 수정 약 14파일 · +250/−30줄 · **Medium** · 약 2.5~3.5시간. Checkpoint = 1단계 직후(AC-02·06·08 API).

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 동방 계정은 `affiliation='dongbang'`뿐이며 다른 식별자는 없다 | 89 D-4 |
| A2 | admin이 동방을 봐야 하는 곳은 사용자 관리·활동 로그·알림 타인 보기 3곳뿐 | 사용자 답변 Q6 |
| A3 | 동방이 받을 알림은 퀵 + 본인 프로필 변경뿐 | 사용자 답변 Q6 |
| A4 | `profiles` RLS(본인/admin)로 클라이언트 직접 조회는 이미 막혀 있다 | SQL 01·03 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| admin이 식대 카드 화면에서 사용자 선택 | 동방 없음(AC-05) |
| admin이 활동 로그에서 동방 직원 선택 | 가능(AC-04) |
| 공지 발행 | 동방 알림 0(AC-06) |
| 동방이 푸시 설정 열기 | 그룹 2개(AC-08) |

---

## 구현 팀 전달 메모

### designer
- 변경 없음 확인 메모만.

### backend-dev
- 감사표를 먼저 채운다(AC-01). `applyDongbangScope` 진입점 → 4곳 제외 → `insertNotifications` 가드 → 그룹 `dongbang_visible` → `pg_policies` 감사(AC-10) → 조건부 SQL 94.

### frontend-dev
- 콤보 3곳에 `includeDongbang=1`. 그 밖 변경 없음.

### verifier
- 동방 fixture 1명 + 콤보 7곳 스냅샷 · 알림 0건은 dev DB 조회 · 회귀 8 디렉터리.

---

## 열린 질문

| # | 질문 | 기본값 |
|---|---|---|
| OQ-1 | AC-10에서 `qual='true'` 테이블이 나오면 어디까지 막을지 | 퀵·알림·프로필 외 전부 막음 · 수정 이력 기록 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-27 | 최초 작성 · Approved(/root 단일 게이트 · Q6 답변 반영). 서버 기본 제외 원칙 · 예외 3곳 · `insertNotifications` 동방 가드(퀵·프로필 2그룹) · 푸시 그룹 `dongbang_visible` · 감사표 12행 · 조건부 SQL 94 · AC 12 | planner |
| 2026-10-27 | **BE 구현 완료.** 감사표 42건 전수 등재(A 8 · R 7 · K 11+ · G 1). `applyDongbangScope`(`features/users/api/profile-scope.server.ts`) 신규 · S-1~S-6 적용 · S-7 가드(`lib/dongbang-notification-guard.ts` 순수 함수 + predicate 주입) · S-8 `dongbang_visible` · **SQL 94 생성·Dev 적용**(워크플로우 양식 4정책 · `qual='true'`는 0건이었으나 로그인 전원 허용 정책을 D-8 OQ-1 기본값대로 막음) · BE-7 복지비 명단 Dev DB 재확인 동방 0건. `node --test` 48/48 · `tsc` 0. 활동 로그: 신규 CUD Route 없음 · PUT preferences 400 분기는 기존 `push_preference.update` validation 로그 경로 재사용. 산출물 `.claude/handoff/95-backend.md` | backend-dev |
| 2026-10-27 | **verifier 완료.** `e2e/quick-round2/95-dongbang-visibility.spec.ts` 신규(AC-01~11 · 13 test) **13/13 green** · 회귀 users/activity-logs/benefits/contracts/org-chart/notifications/workflow/quick-workflow/quick-chat/push-notifications(실패는 전부 기존·stale·플레이크 범주) · `node --test` 48/48 · tsc 0 · lint:strict 0 · react-doctor 79(오류 0 · plan 95 파일 0건) · build exit 0 · `npm run e2e:cleanup` remaining 전부 0. 발견·조치: ① **BE 누락** `push-preferences.server.ts` RSC prefetch가 `{ dongbang }` 옵션 없이 8그룹 hydration → 알림·프로필 페이지 Dialog에 동방 8 Switch(AC-08 FAIL) → verifier가 소규모 직접 수정(옵션 인자 + `notifications/page.tsx`·`profile/page.tsx` `isDongbang` 전달) ② 감사표 큰따옴표 `from("profiles")` 2건 누락(`log.server.ts:534`·`middleware.ts:100` · K) → S-16 보강 ③ `playwright.config.ts` `chromium-quick-round2`에 `setup-hr-benefits` 의존 추가(hr.json stale 401). 산출물 `.claude/handoff/95-verifier.md` | verifier |
| 2026-10-29 | 감사표 S-10a 갱신 — 생일 쿼리가 `.or(EXCLUDE_DONGBANG_OR_FILTER)`에서 `applyDongbangScope`(`service.server.ts:60`)로 바뀜(plan [102](./102_overview-birthday-wheel-list-plan.md) · 옛 `this-month` Route 삭제 · `GET /api/birthdays`). 제외 결과는 동일 | planner |
