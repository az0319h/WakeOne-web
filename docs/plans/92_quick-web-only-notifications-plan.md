# 퀵 카카오톡(오픈채팅) 제거 · 웹 알림 일원화 · 퀵 대시보드 실시간 갱신 기획서

> Date: 2026-10-22
> Status: Approved
> Author: planner
> **SQL 예정:** `supabase/sql/{NN}_quick_web_only_notifications.sql` — `NN`은 적용 직전 `ls supabase/sql` 최대+1 (현재 실제 최대 `89`. plan 91이 `90`을 「예정」으로 적어 두었으나 **이 plan이 먼저 구현되면 이 plan이 `90`을 쓰고 91은 다음 번호로 밀린다**). **Dev DB만** 적용한다.
> **Supersedes:** [89](./89_quick-workflow-dongbang-openchat-plan.md)의 D-1·D-2·D-3(webhook·재시도·미설정), D-13(메시지 복사), D-16(인앱 알림 수신자), D-17(webhook 개인정보), U-7(발송 패널), §webhook 계약, §env, Route `POST …/openchat/resend`, action `quick_request.openchat_resend`, AC-11·12·13·14·35 전체와 AC-16·18·19·21·23·26·38의 webhook/mock 판정 부분, Out 「Realtime 목록 자동 갱신」, OQ-1
> **후속(분할):** [93](./93_quick-request-chat-plan.md) 퀵 요청 건별 실시간 채팅 — 이 plan 다음에 구현
> **선행:** [08](./08_activity-audit-log-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [37](./37_notifications-read-optimistic-update-plan.md), [86](./86_quick-request-kakao-redesign-plan.md), [87](./87_quick-request-goods-notes-address-picker-plan.md), [89](./89_quick-workflow-dongbang-openchat-plan.md), [90](./90_quick-dashboard-permission-info-plan.md), [91](./91_pwa-web-push-notifications-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **89** | In Progress (구현·AC 39/39 PASS, 미커밋) | **부분 supersede**(위 헤더). 상태 흐름·권한 매트릭스·동방 allowlist·요청번호·대시보드/상세 UI·activity log 8 action 중 7개는 **그대로 유지**한다 |
| **90** | Completed | 영향 없음. `info-content.ts`에 오픈채팅 문구 0건(grep). 90 문서 D-2 Out 표의 「오픈채팅 발송 시점」 언급만 수정 이력으로 정리 |
| **91** | Approved · **미구현**(dev에 `push_subscriptions` 없음, `insert.server.ts`·`sw.js`·`manifest.ts` 없음) | **순서: 92 → (93) → 91**(사용자 Q5=A). 91은 받는 사람·문구를 바꾸지 않고 「이미 생긴 알림을 휴대폰으로도 보내는」 채널이므로, 이 plan이 정한 수신자·문구가 그대로 푸시가 된다. 91이 수정하는 `quick-request/api/notifications.server.ts`의 insert 지점은 이 plan 이후 **2함수 → 1공용 함수**로 바뀌므로 91 구현자는 그 함수 하나만 `insertNotifications()`로 바꾼다. 알림 type은 이 plan에서 늘리지 않으므로 91의 `PUSH_NOTIFICATION_GROUPS`는 이 plan 때문에 바뀌지 않는다 |
| **27 · 37** | Approved · Completed | `notifications` 테이블·Realtime INSERT·읽음 처리·「알림 INSERT는 activity log Out」 원칙 재사용 |
| **86 · 87** | Approved | 「카카오 스타일」 UI와 Daum(kakaocdn) 우편번호 검색은 **유지**(카톡 메시지와 무관) |
| **08** | Approved | 신규 CUD Route 없음. resend Route 삭제. 기존 Route의 모든 return 분기 로그는 유지하고 metadata `openchat`만 제거 |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 카톡 실연결 | 로컬 `.env`에 `QUICK_OPENCHAT_*` 없음 → 항상 `not_configured`. 실제 봇은 만든 적 없음(89 OQ-1) | `grep -c QUICK_OPENCHAT .env` = 0 |
| dev 데이터 | `quick_request_openchat_dispatches` 0행 · `quick_requests` 0행 · active 동방 0 · 구매물류팀 2 · admin 1 · `activity_logs`에 `quick_request.openchat_resend` 1행, metadata `openchat` 224행(e2e 흔적) | dev SELECT |
| SQL 89 | dev 적용 완료 · **Main 미적용** | `89_quick_requests_workflow.sql` 헤더 |
| 현재 알림 규칙 | 등록 → 동방 전원 / 접수·배차완료·최종금액 → 요청자 / 승인 → 요청자(admin 대리 승인 시만) / 취소 → 동방 전원 + 요청자 / admin·구매물류팀 → 없음. 행위자 본인 제외. `safeNotify`로 실패 격리 | `src/features/quick-request/api/notifications.server.ts`, 호출 Route 6개 |
| 알림 클릭 | `type.startsWith('quick_request.')` → 「퀵 요청 보기」 → `metadata.quick_request_no` 있으면 `/dashboard/quick/{no}` | `notification-helpers.ts:130`, `notification-infinite-list.tsx:136` |
| Realtime | publication: `notifications`·`profiles`·`support_comments`만. `quick_requests` 없음 | dev `pg_publication_tables` |
| 함정 1 | `permissions.canResend`가 취소 Alert의 `canOperate`로도 쓰임 → **삭제가 아니라 `canOperate`로 이름 변경** | `quick-request-detail-page.tsx:167` |
| 함정 2 | `openchat-message.ts`의 `buildQuickRouteSummary`·`formatRouteRegion`·`formatQuickAmountWonText`는 알림·목록도 사용 → **이동 후** 파일 삭제 | `notifications.server.ts:4`, `workflow.server.ts:12` |
| 함정 3 | `ACTION_LABELS: Record<ActivityAction, string>` → action 타입을 지우면 라벨도 지워야 함. 과거 로그 표시를 위해 **legacy로 유지** | `activity-logs/labels.ts:9,85,165` |
| `notifyWarning` | 사용처는 퀵 오픈채팅 2곳뿐 → 제거 후 미사용. 공용 유틸이라 함수는 남기고 주석만 일반화 | `src/lib/notify.ts:15` |

---

## 한 줄 요약

퀵 업무에서 카카오톡 오픈채팅 기능(외부 webhook 발송·재발송·발송 기록·상태 배지·경고 토스트·메시지 복사)을 **코드·DB·설정·테스트까지 완전히 삭제**하고, 알림은 **WakeOne 인앱 알림 하나로** 처리한다. 동방특송은 모든 단계 알림을 받고, admin·구매물류팀은 등록·취소만 받으며, 문구는 휴대폰 푸시에 맞게 **짧게** 바꾼다. 퀵 대시보드·상세는 **Realtime으로 자동 갱신**되어 누가 접수하면 다른 사람 화면이 새로고침 없이 바뀐다.

---

## 정책 확정안 (deep-interview 2026-10-22 · 사용자 답변 Q1=A·Q2=B·Q3=A·Q4=A·Q5=A·Q6=B)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 카톡 제거 범위 (Q4=A) | 코드·Route·UI·env·e2e mock·DB 테이블 `quick_request_openchat_dispatches` **전부 삭제**. 과거 로그 표시용 라벨(`quick_request.openchat_resend` 「퀵 오픈채팅 재발송」, metadata 키 `openchat` 「오픈채팅 발송」)만 **legacy**로 남긴다(신규 기록 없음) |
| D-2 | 알림 채널 | WakeOne 인앱 알림(`notifications`)이 **유일한 채널**. 휴대폰 푸시는 plan 91이 이 알림을 그대로 OS로 보낸다 |
| D-3 | 알림 type | 기존 2종 유지(DB CHECK·plan 91 그룹 변경 없음). `quick_request.vendor_event` = **업무 담당·관리 측**(동방·admin·구매물류팀) 수신 / `quick_request.requester_event` = **요청자** 수신. `metadata.quick_request_event`로 사건을 구분 |
| D-4 | 수신자 (Q1=A · Q2=B) | §수신자 매트릭스. 공통: **행위자 본인 제외 · active만 · 한 사람이 여러 자격이면 1건만**(요청자 자격 우선) |
| D-5 | 문구 (Q3=A) | 짧게 핵심 1~2개. **기사 연락처·출발/도착 담당자 연락처는 알림에 넣지 않는다**(잠금화면 노출 방지). 제목 ≤ 30자, 본문 ≤ 120자(초과 시 `…`). §문구표 |
| D-6 | 클릭 이동 | 기존 규칙 유지: `/dashboard/quick/{요청번호}` |
| D-7 | 실시간 갱신 (Q6=B) | `quick_requests`를 Realtime publication에 추가. 대시보드·상세가 INSERT/UPDATE를 구독해 React Query를 invalidate한다. RLS가 그대로 적용되어 **볼 권한이 없는 건의 변경은 오지 않는다** |
| D-8 | 순서 (Q5=A) | 92 → 93 → 91. 91 문서에 메모를 남긴다 |
| D-9 | 화면 문구 | 미리보기 Dialog·배차완료 Dialog의 「오픈채팅」 안내를 「WakeOne 알림」 안내로 교체. `formatQuickRequestKakaoMessage` → `formatQuickRequestPreviewText`(기능 동일, 미리보기 본문 전용) |
| D-10 | 운영 정리 | 퀵 업무(89)는 **아직 운영에 반영되지 않았다**(사용자 확인 2026-10-22). 그래서 Vercel에서 지울 `QUICK_OPENCHAT_*` env는 **해당 없음**이다. 운영 반영 시 Main DB에 SQL 89 → 이 SQL 순서로 적용하는 것만 사용자 수동이다(Out) |

### 수신자 매트릭스 (D-4)

| 사건 | 동방특송 전원 | 요청자 | admin | 구매물류팀 | type |
|------|:-:|:-:|:-:|:-:|------|
| 등록 (`created`) | O | — | **O** | **O** | 동방·admin·구매물류 = vendor |
| 접수 (`accepted`) | **O** | O | X | X | 동방 = vendor · 요청자 = requester |
| 배차완료 (`dispatched`) | **O** | O | X | X | 〃 |
| 최종금액 입력·수정 (`final_amount_set`) | **O** | O | X | X | 〃 |
| 승인 (`approved`) | **O** | O | X | X | 〃 |
| 취소 (`cancelled`) | O | O | **O** | **O** | 〃 |

- 굵게 = 이번 plan에서 **새로 받게 되는** 사람. 모두 행위자 본인은 제외(예: 요청자가 직접 승인하면 요청자는 받지 않음).
- 요청자가 admin이거나 구매물류팀이면 requester_event 1건만 받는다(중복 제거, 요청자 자격 우선).
- 「동방특송 전원」 = `profiles.status='active' AND affiliation='dongbang'`. 「admin」 = active `system_role='admin'` **전원**(여러 명이면 모두에게, 사용자 확인 OQ-2). 「구매물류팀」 = active `affiliation='wake' AND rank='구매물류팀' AND system_role='user'`(89 D-11 판별과 동일).

### 문구표 (D-5)

`{no}` = 요청번호, `{행위자}` = 처리한 사람 이름, `{경로}` = `{출발 시·구} → {도착 시·구}`(경유 있으면 ` (경유 N)`), 금액 = `20,000원`.

| 사건 | 제목 | 본문 (vendor) | 본문 (requester) |
|------|------|---------------|------------------|
| 등록 | `새 퀵 요청 {no}` | `{요청자} · {경로}` | — |
| 접수 | `퀵 {no} 접수됨` | `{행위자}님이 접수했습니다.` | `동방특송이 접수해 배차를 진행하고 있습니다.` |
| 배차완료 | `퀵 {no} 배차완료` | `{차량정보} · 기사 {기사이름} · 예상 {예상금액}` | 동일 |
| 최종금액 | `퀵 {no} 최종금액 입력` | `최종금액 {최종금액} · {행위자}님 입력` | `최종금액 {최종금액} · 확인 후 승인해 주세요.` |
| 승인 | `퀵 {no} 승인됨` | `최종금액 {최종금액} · {행위자}님이 승인했습니다.` | 동일 |
| 취소 | `퀵 {no} 취소됨` | `{행위자}님이 취소했습니다.` + (사유 있으면) ` 사유: {사유}` | 동일 |

본문이 120자를 넘으면 119자 + `…`. 사유·차량정보 안의 줄바꿈은 공백 1칸으로 바꾼다.

---

## 목표 & 완료 기준 (AC)

공통:
- 시각은 `formatAbsoluteDateTimeKo`(`yyyy-MM-dd (EEE) HH:mm:ss`), 상대 시각 금지.
- E2E 계정: `user.json`(요청자) · `user2.json` · `admin.json` · `dongbang.json` · `logistics.json`(89 그대로). 수신자 검증용으로 **동방특송 2번째 계정**(`dongbang2`, 일회용 생성 helper 재사용)이 필요하다.
- 알림 검증은 dev DB(service role)에서 `notifications`를 `metadata->>'quick_request_no'`와 `metadata->>'quick_request_event'`로 조회한다.
- 셀렉터는 `getByRole`/`getByPlaceholder`/`getByTestId`만 쓴다.

### A. 카톡 흔적 제거

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | grep | 구현 완료 | `grep -rniE "openchat\|오픈채팅" src e2e playwright.config.ts env.example.txt` | 매치는 **legacy 3줄만**: `activity-logs/api/types.ts`의 `quick_request.openchat_resend`(주석 `legacy`), `labels.ts`의 그 라벨, `labels.ts`의 metadata 키 라벨 `openchat`. 그 밖에 0건 · 파일 `openchat-webhook.server.ts`·`openchat-message.ts`·`quick-openchat-panel.tsx`·`quick-openchat-status-badge.tsx`·`e2e/helpers/openchat-mock.ts`·`e2e/quick-workflow/unconfigured.spec.ts`·`src/app/api/quick-request/[requestNo]/openchat/` **없음** |
| AC-02 | grep | 〃 | `grep -rniE "kakao\|카카오\|카톡" src` | 매치는 `quick-request-daum-postcode-embed.tsx`(kakaocdn 우편번호 스크립트)와 `quick-request-order-form-sections.tsx`(「카카오 순서」 디자인 주석)뿐 · `formatQuickRequestKakaoMessage` 0건 · `formatQuickRequestPreviewText` 존재 |
| AC-03 | API | `admin.json` | `POST /api/quick-request/{번호}/openchat/resend` `{event:"created"}` | **404**(Route 없음) |
| AC-04 | API | `user.json` 등록 · `dongbang.json` 접수·배차·취소 각 1회 | 각 응답 body | `openchat` 키 **없음** · `GET /api/quick-request`·`/summary`·`/{번호}` 응답에 `openchatConfigured`·`openchat` 키 **없음** · 상세 `permissions`에 `canResend` 없고 `canOperate` 있음 |
| AC-05 | DB | SQL 적용 후 | dev `select to_regclass('public.quick_request_openchat_dispatches')` | **null** · `list_migrations`에 이번 migration 1건 · Main 미적용 |
| AC-06 | Playwright | `dongbang.json`·`admin.json` | `/dashboard/quick` 상단 · 상세 화면 | 「오픈채팅 자동 발송」 배지(`quick-openchat-status`) **0건** · 「오픈채팅 발송」 패널(`quick-openchat-panel`) **0건** · 「다시 보내기」·「메시지 복사」 버튼 0건 |
| AC-07 | Playwright | `user.json` · 유효 폼 | `/dashboard/quick/request` → 등록 → 미리보기 Dialog | 설명 문구 **「등록하면 요청번호가 발급되고 동방특송 담당자에게 WakeOne 알림이 갑니다.」** · 「오픈채팅」 텍스트 0건 · 「등록」 → 201 · 토스트 「퀵 요청이 등록되었습니다. (요청번호 YYYY-NN)」만(경고 토스트 없음) · 상세로 이동 |
| AC-08 | Playwright | `dongbang.json` · `dispatching` 건 | 「배차완료」 Dialog 열기 | 설명 **「{번호} 요청의 배차 정보를 입력합니다. 저장하면 요청자와 동방특송 담당자에게 알림이 갑니다.」** · 「오픈채팅」 0건 |
| AC-09 | CLI | — | `env.example.txt` · `playwright.config.ts` · `e2e/global-setup.ts` | `QUICK_OPENCHAT_*`·`E2E_OPENCHAT_MOCK`·`127.0.0.1:4599` **0건** · 퀵 e2e run이 mock 서버 없이 기동 |

### B. 알림 수신자·문구

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-10 | API·DB | 동방 2명(`dongbang`, `dongbang2`) active · `user.json` 등록 | 등록 직후 알림 조회(event `created`) | 수신자 = 동방 2명 + admin + 구매물류팀 전원(dev 2명 포함) · 요청자 0건 · type 모두 `vendor_event` · 제목 **`새 퀵 요청 {번호}`** · 본문이 `{요청자이름} · `로 시작하고 ` → ` 포함 |
| AC-11 | API·DB | AC-10 건 | `dongbang.json`이 접수 | `dongbang2` 1건(vendor, 제목 **`퀵 {번호} 접수됨`**, 본문 **`{동방1 이름}님이 접수했습니다.`**) · 요청자 1건(requester, 본문 **`동방특송이 접수해 배차를 진행하고 있습니다.`**) · `dongbang`(행위자)·admin·구매물류팀 **0건** |
| AC-12 | API·DB | AC-11 계속 | `dongbang.json` 배차완료(예상 20000 · `오토바이 8514` · `홍길동` · `01012345678`) | `dongbang2`·요청자 각 1건 · 제목 **`퀵 {번호} 배차완료`** · 본문 **`오토바이 8514 · 기사 홍길동 · 예상 20,000원`** · 본문에 `010` **미포함** |
| AC-13 | API·DB | AC-12 계속 | `admin.json`이 최종금액 23000 입력 | 동방 2명 각 1건(본문 **`최종금액 23,000원 · {admin 이름}님 입력`**) · 요청자 1건(본문 **`최종금액 23,000원 · 확인 후 승인해 주세요.`**) · admin(행위자) 0건 |
| AC-14 | API·DB | AC-13 계속 | `user.json`(요청자)이 승인 | 동방 2명 각 1건 제목 **`퀵 {번호} 승인됨`** · 요청자(행위자) **0건** · admin·구매물류팀 0건 |
| AC-15 | API·DB | 새 `requested` 건 | `user.json`이 사유 `날짜 변경`으로 취소 | 동방 2명 + admin + 구매물류팀 각 1건(vendor) · 제목 **`퀵 {번호} 취소됨`** · 본문 **`{요청자 이름}님이 취소했습니다. 사유: 날짜 변경`** · 요청자 0건 |
| AC-16 | API·DB | `logistics.json` 사용자가 직접 등록한 건 | `dongbang.json`이 취소 | 구매물류 요청자는 **requester_event 1건만**(vendor 중복 없음) · 동방2·admin 각 1건 · 동방1(행위자) 0건 |
| AC-17 | API·DB | 사유 150자 취소 | 알림 본문 | 길이 ≤ 120 · `…`로 끝남 |
| AC-18 | Playwright | AC-11 이후 `user.json` | `/dashboard/notifications`에서 접수 알림의 「퀵 요청 보기」 클릭 | URL `/dashboard/quick/{번호}` · 상태 배지 「접수 및 배차중」 |

### C. 실시간 갱신

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-19 | Playwright (2 context) | `admin.json`이 `/dashboard/quick` 열어 둠 | `user.json`이 API로 등록 | **새로고침 없이 5초 안에** admin 표에 새 번호 행 등장 · 「신규요청」 카드 숫자 +1 |
| AC-20 | Playwright (2 context) | `user.json`이 본인 `requested` 건 상세를 열어 둠 | `dongbang.json`이 API로 접수 | 5초 안에 상세 상태 배지 **「접수 및 배차중」** · Stepper 2단계 · 「요청 취소」 버튼 사라짐 |
| AC-21 | Playwright (2 context) | `user2.json`이 `/dashboard/quick`(「나의 퀵 내역」) 열어 둠 | `user.json`이 등록 | 8초 기다려도 user2 표에 그 번호 **0건**(RLS) |
| AC-22 | DB | SQL 적용 후 | `select tablename from pg_publication_tables where pubname='supabase_realtime'` | `quick_requests` 포함 · `quick_request_openchat_dispatches` 없음 |

### D. 회귀·품질

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-23 | Playwright | plan 89 흐름 | 등록 → 접수 → 배차완료 → 최종금액 → 승인 / 요청자 취소 / 409 경합 | 89 AC-08·10·16~34·36 중 webhook 판정을 뺀 기대가 그대로 통과 · AC-21(동시 접수) 409 1건 |
| AC-24 | Playwright · 로그 | AC-11~15 수행 후 | `dongbang.json`·`user.json` 각자 `/dashboard/logs` | 「퀵 요청 접수」「퀵 배차 완료」「퀵 요청 취소」 행 노출 · 행 metadata에 `openchat` 키 **없음** · admin `/dashboard/logs`에서 과거 legacy 행이 있으면 라벨 「퀵 오픈채팅 재발송」으로 표시(코드값 노출 아님) |
| AC-25 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/quick-request e2e/quick-workflow e2e/quick-info` | 모두 통과 |

**AC 총 25개**: A 9 · B 9 · C 4 · D 3.

---

## 범위 (In / Out)

### In
1. **삭제(BE)**: `src/features/quick-request/lib/openchat-webhook.server.ts`, `openchat-message.ts`(helper 이동 후), `src/app/api/quick-request/[requestNo]/openchat/resend/route.ts`, Route 4곳(`route.ts` POST·`accept`·`dispatch`·`cancel`)의 `dispatchQuickOpenchatEvent` 호출·응답 `openchat`·로그 metadata `openchat`, `workflow.server.ts`의 `DISPATCHES_TABLE`·`toQuickOpenchatSource`·`listDispatchViews`·`resolveOpenchatConfiguredForViewer`·detail `openchat`, `schemas/quick-request-workflow.ts`의 `QUICK_OPENCHAT_*`·메시지 3종·resend 스키마, `activity-logs/api/log.server.ts`의 `openchat` allowlist·sanitizer, `activity-logs/api/types.ts`의 metadata `openchat?`
2. **이동**: `buildQuickRouteSummary`·`formatRouteRegion`·`QuickRouteSummary` → `lib/quick-request-route-label.ts`, `formatQuickAmountWonText` → `lib/format-quick-amount.ts`
3. **이름 변경**: `permissions.canResend` → `permissions.canOperate`, `formatQuickRequestKakaoMessage` → `formatQuickRequestPreviewText`
4. **삭제(FE)**: `quick-openchat-panel.tsx`, `quick-openchat-status-badge.tsx`, `quick-dashboard-page.tsx`·`quick-dashboard-meta-bar.tsx`·`app/dashboard/quick/page.tsx`의 `openchatConfigured` prop, `notifyQuickOpenchatOutcome`과 호출 5곳(`quick-request-order-page.tsx`·`quick-request-row-action.tsx`·`quick-request-action-bar.tsx`·`quick-dispatch-dialog.tsx`·`quick-cancel-alert.tsx`), `CONFLICT_MESSAGES`의 `openchatAlreadySent`, `lib/quick-request-status.ts`의 `QUICK_OPENCHAT_*` 상수, `api/types.ts`·`service.ts`·`mutations.ts`의 openchat 타입·함수
5. **문구**: 미리보기 Dialog(AC-07), 배차완료 Dialog(AC-08), 주석(`quick-request-goods-visuals.ts:17`, `quick-cancel-alert.tsx:20`, `quick-request-order-page.tsx:78`, `notifications.server.ts` 머리 주석, `src/lib/notify.ts:15`)
6. **알림 재작성**: `quick-request/api/notifications.server.ts`를 **단일 진입점** `notifyQuickRequestEvent({row, event, actorUserId, actorName})`로 바꾼다. 내부에서 §수신자 매트릭스·§문구표를 적용하고 **insert는 1회**(행 배열)만 호출한다. 호출 Route 6곳은 `safeNotify('…', () => notifyQuickRequestEvent(...))` 한 줄로 바꾼다. 수신자 조회 helper `listActiveQuickAdminUserIds()`·`listActiveLogisticsUserIds()`를 `workflow.server.ts`에 추가한다(`listActiveDongbangUserIds` 패턴)
7. **DB SQL**: `drop table public.quick_request_openchat_dispatches`(trigger·policy 포함) + `alter publication supabase_realtime add table public.quick_requests`
8. **Realtime FE**: `src/features/quick-request/components/quick-request-realtime.tsx`(신규) — `quick_requests` INSERT/UPDATE 구독(필터 없음, RLS가 범위 제한), 300ms debounce로 `quickRequestKeys.lists()`·`summary()`·`detail(no)` invalidate. 대시보드 페이지와 상세 페이지에 마운트. `support-comment-realtime.tsx` 패턴(`realtime.setAuth` 후 subscribe, unmount 시 `removeChannel`)
9. **env·e2e**: `env.example.txt` 116~121행 삭제, `playwright.config.ts`의 `QUICK_OPENCHAT_E2E_ENV`, `e2e/global-setup.ts` mock 기동, `e2e/helpers/openchat-mock.ts` 삭제, `e2e/quick-workflow/unconfigured.spec.ts` 삭제, `register*.spec.ts`·`vendor-flow.spec.ts`·`requester.spec.ts`·`dashboard.spec.ts`·`logs.spec.ts`·`helpers.ts`·`e2e/quick-info/info-panel.spec.ts`·`e2e/quick-request/helpers.ts`에서 mock·`openchat` 판정 제거 + 알림 수신자 판정 추가, 신규 `e2e/quick-workflow/notifications.spec.ts`(AC-10~18)·`realtime.spec.ts`(AC-19~21)
10. **문서**: 89·90·91 수정 이력, README 92 등록

### Out
| 항목 | 이유 |
|------|------|
| 퀵 요청 건별 채팅 | **plan 93**으로 분리 |
| 휴대폰 푸시 | plan 91 |
| 알림 type 추가·세분화(예: admin 전용 type) | 기본값 승인(2종 유지). 91 그룹 변경 회피 |
| 대시보드 「최근 활동」 피드 | Q6=B(C 아님). 「활동 로그」 메뉴가 대신함 |
| 사용자별 알림 끄기(퀵 세부 사건 단위) | plan 91의 그룹 단위 설정으로 대체 |
| Main DB 적용 | 사용자 수동(D-10). Vercel env 삭제는 해당 없음(운영 미반영) |
| 과거 activity log 행의 `openchat` metadata 정리 | 감사 기록은 수정하지 않는다 |
| `notifyWarning` 함수 삭제 | 공용 유틸, 미사용이어도 유지 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | 대시보드 상단 메타 바 | 오픈채팅 배지 자리를 **비운다**(대체 요소 없음). 레이아웃이 어색하면 「최근 7일 기준」 보조 문구만 남기는 형태로 정리 |
| U-2 | 상세 aside | 「오픈채팅 발송」 패널 제거. aside는 금액 → 배차 정보 → 처리 이력 순서 유지(plan 93 채팅 카드가 들어올 자리를 designer가 미리 고려) |
| U-3 | 미리보기 Dialog | 설명 문구 교체(AC-07). 제목·본문·버튼은 그대로 |
| U-4 | 배차완료 Dialog | 설명 문구 교체(AC-08) |
| U-5 | 실시간 갱신 | 시각 효과 없음(조용히 갱신). 행 추가로 표가 튀지 않게 기존 정렬 유지. 갱신 중 Spinner 표시 금지(filter shell 규칙 plan 40 유지) |

---

## API / DB 요구사항

### DB (`supabase/sql/{NN}_quick_web_only_notifications.sql` · dev 전용)

```sql
-- Plan: 92_quick-web-only-notifications-plan.md
-- Date: 2026-10-22
-- Status: Approved
-- Summary: 오픈채팅 webhook 발송 기록 테이블 삭제 · quick_requests Realtime publication 추가

drop table if exists public.quick_request_openchat_dispatches;   -- trigger·policy·grant 함께 제거 (dev 0행 확인)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quick_requests'
  ) then
    alter publication supabase_realtime add table public.quick_requests;
  end if;
end $$;

-- 롤백: alter publication supabase_realtime drop table public.quick_requests;
--       (dispatches 테이블은 SQL 89의 해당 블록으로 재생성)
```

- SQL 89 파일은 **수정하지 않는다**(적용 이력 보존). Main에는 89 → 이 SQL 순서로 적용해야 한다(D-10, 사용자 수동).
- `quick_requests` RLS SELECT(요청자 본인 OR viewer-all)가 Realtime에도 그대로 적용된다. UPDATE 이벤트는 새 행 기준으로 판정되므로 replica identity 변경은 필요 없다 **[INFERRED: backend-dev가 dev에서 AC-21로 확인]**.

### API 응답 변경

| Route | 변경 |
|-------|------|
| `POST /api/quick-request` | 201 `{data:{requestNo, id}}` (`openchat` 삭제) |
| `GET /api/quick-request`, `GET /api/quick-request/summary` | `openchatConfigured` 삭제 |
| `GET /api/quick-request/[no]` | `openchat` 삭제 · `permissions.canResend` → `canOperate` |
| `POST …/accept`·`dispatch`·`cancel` | 응답 `openchat` 삭제 |
| `POST …/openchat/resend` | **삭제**(404) |

### 알림 모듈 (`src/features/quick-request/api/notifications.server.ts`)

```
notifyQuickRequestEvent({ row, event, actorUserId, actorName })
  1. 수신 후보 = §수신자 매트릭스(event)  ← listActiveDongbangUserIds / listActiveQuickAdminUserIds / listActiveLogisticsUserIds
  2. 요청자 자격 행(requester_event)을 먼저 만들고, 그 사람은 vendor 후보에서 제거
  3. 행위자 본인 제거 · 중복 제거
  4. 문구 = §문구표 (제목 ≤30, 본문 ≤120, 줄바꿈→공백, 연락처 미포함)
  5. metadata = { kind, quick_request_no, quick_request_id, quick_request_event, actor_user_id } (기존 키 유지)
  6. supabase.from('notifications').insert(rows)  ← 1회. plan 91 구현 시 insertNotifications(rows)로 교체
```

`safeNotify` 실패 격리는 유지한다(알림 실패가 업무 응답을 바꾸지 않는다).

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 변경 |
|-------|--------|------|
| `POST /api/quick-request` · `PATCH …/[no]` · `POST …/accept`·`dispatch`·`approve`·`cancel` | 기존 7 action | **모든 return 분기 로그 유지**. metadata에서 `openchat` 키만 제거 |
| ~~`POST …/openchat/resend`~~ | ~~`quick_request.openchat_resend`~~ | Route 삭제 → 신규 기록 없음. `ActivityAction` 유니온·`ACTION_LABELS`에는 **legacy 주석과 함께 유지**(과거 1행 표시용) |

- 신규 CUD Route 없음. 알림 INSERT는 기존 원칙대로 로그 Out.
- 검증: AC-24.

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `supabase/sql/{NN}_quick_web_only_notifications.sql`(신규), `src/app/api/quick-request/route.ts`, `[requestNo]/route.ts`(PATCH 최종금액 알림), `[requestNo]/accept|dispatch|approve|cancel/route.ts`, `[requestNo]/openchat/resend/route.ts`(삭제), `src/features/quick-request/api/notifications.server.ts`(재작성), `api/workflow.server.ts`, `api/types.ts`, `lib/openchat-*.ts`(삭제), `lib/quick-request-route-label.ts`·`lib/format-quick-amount.ts`(helper 이동), `schemas/quick-request-workflow.ts`, `src/features/activity-logs/api/{types,log.server}.ts`, `labels.ts`(legacy 주석), `env.example.txt` |
| FE | `src/app/dashboard/quick/page.tsx`, `components/dashboard/{quick-dashboard-page,quick-dashboard-meta-bar,quick-request-row-action}.tsx`, `quick-openchat-status-badge.tsx`(삭제), `components/detail/{quick-request-detail-page,quick-request-action-bar}.tsx`, `quick-openchat-panel.tsx`(삭제), `components/dialogs/{quick-dispatch-dialog,quick-cancel-alert}.tsx`, `quick-request-order-page.tsx`, `quick-request-preview-dialog.tsx`, `lib/format-quick-request-message.ts`, `lib/quick-request-mutation-feedback.ts`, `lib/quick-request-status.ts`, `api/{service,mutations}.ts`, `components/quick-request-realtime.tsx`(신규), `src/lib/notify.ts`(주석) |
| verifier | `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/helpers/openchat-mock.ts`(삭제), `e2e/quick-workflow/*`(수정·`unconfigured.spec.ts` 삭제·`notifications.spec.ts`·`realtime.spec.ts` 신규), `e2e/quick-info/info-panel.spec.ts`, `e2e/quick-request/helpers.ts` |

**따를 패턴:** `support-comment-realtime.tsx`(Realtime setAuth·channel·cleanup), `notifications-realtime.tsx`, `listActiveDongbangUserIds`(수신자 조회), React Query `onSettled` invalidate, `jsonWithActivityLog`/`finishWithActivityLog`.

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | helper 이동 누락으로 알림·목록 경로 문자열이 깨짐 | 이동 → import 교체 → 삭제 순서. tsc 체크포인트. AC-10 본문 ` → ` 확인 |
| HIGH | `canResend` 삭제 시 취소 Alert의 동방 분기가 깨짐 | 이름만 `canOperate`로 변경(AC-04). 취소 회귀 AC-23 |
| MED | Realtime 이벤트 폭주로 invalidate 과다 | 300ms debounce · lists/summary/detail 키만 invalidate |
| MED | Realtime이 RLS를 우회한다고 오해/설정 실수 | publication만 추가, 정책 변경 없음. AC-21로 차단 확인 |
| MED | 수신자 확대로 admin·구매물류 알림 과다 | 등록·취소만(Q2=B). 91 그룹 설정으로 푸시 끄기 가능 |
| MED | e2e 다수 수정으로 89 회귀 누락 | 89 AC 매핑표를 spec 상단 주석에 유지 · AC-23 |
| LOW | Main 적용 순서 착오(89 미적용 상태에서 drop) | `drop table if exists`. 최종 보고 체크리스트 |
| LOW | 91 구현자가 옛 2함수 구조를 기준으로 작업 | 91 수정 이력 메모 |

**롤백:** publication drop 1줄, dispatches는 SQL 89 블록으로 재생성. 코드는 Step 0 백업 또는 git revert.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 0 | root Step 0 백업 | 스냅샷 | HIGH | — |
| 1 | designer: U-1·U-2 aside 정리(93 채팅 자리 고려), 문구 2곳 확인 | 설계 메모 | HIGH | — |
| 2 | BE: helper 이동 → openchat 호출 제거 → resend Route 삭제 → 타입·스키마 정리 → **tsc** | API | HIGH | — |
| 3 | BE: `notifyQuickRequestEvent` 재작성 + 수신자 helper 2개 | 알림 | HIGH | 2 |
| 4 | BE: SQL dev 적용(`apply_migration`) | drop·publication | HIGH | — |
| 5 | FE: 패널·배지·토스트 제거, 문구, `canOperate`, Realtime 컴포넌트 | UI | HIGH | 2·4 |
| 6 | verifier: mock 제거·spec 수정·신규 2 spec → tsc·lint·build | green | MED | 3·5 |

**추정:** 삭제 6파일 · 신규 4파일(SQL·Realtime·spec 2) · 수정 약 35파일 · 순변경 −900 / +500줄. 복잡도 **Medium**. 약 3~5시간. 체크포인트는 2단계 tsc 통과와 3단계 AC-10~15 API 통과.

### 분할 판단

사용자 요청(카톡 제거 + 건별 채팅)을 **92 / 93 두 plan으로 나눈다.**
1. 92는 **삭제·정리 중심**이고 93은 **새 테이블·Route·UI 추가**라 실패했을 때 되돌리는 범위가 다르다.
2. 92만으로도 「카톡 없이 웹 알림으로 업무가 돈다」는 목표가 독립적으로 완성되고 검증된다(AC 25개).
3. 93은 92가 만든 `notifyQuickRequestEvent`·Realtime 컴포넌트·상세 aside 정리를 그대로 이어받으므로 순서가 자연스럽다.

---

## requirements-pipeline Express (Phase 3)

### 가정

| ID | 가정 | 출처 |
|----|------|------|
| A1 | 카톡 webhook은 운영에서도 미설정이었다(봇 미구축) | 89 OQ-1 · `.env` |
| A2 | 동방특송 직원은 WakeOne 알림(인앱, 이후 91 푸시)을 확인할 수 있다 | 사용자 의도 |
| A3 | admin·구매물류팀은 세부 진행은 대시보드로 본다 | Q2=B |
| A4 | Realtime은 RLS를 따른다(Supabase postgres_changes) | plan 27·43 선례 |

### 검증 시나리오

| 시나리오 | 기대 |
|----------|------|
| 정상 흐름 | 등록 → 접수 → 배차 → 최종금액 → 승인, 각 단계 알림 수신자 매트릭스대로(AC-10~14) |
| 취소 | 동방·admin·구매물류 + 요청자(행위자 제외)(AC-15·16) |
| 실시간 | 다른 사람 처리 결과가 5초 안에 화면 반영(AC-19·20), 권한 밖 건은 안 보임(AC-21) |
| 흔적 | grep·Route 404·응답 키 없음·테이블 없음(AC-01~06·09) |

---

## 구현 팀 전달 메모

### designer
- 상세 aside에서 오픈채팅 패널 제거 후 균형 정리. **plan 93 채팅 카드가 들어올 자리**(PC aside 또는 별도 열, 모바일 탭/시트)를 미리 염두에 둔다
- 대시보드 메타 바 배지 제거 후 정렬

### backend-dev
- helper 이동을 **가장 먼저** · `notifyQuickRequestEvent` 단일 진입점 · insert 1회 · 수신자 helper 2개 · resend Route 삭제 · 응답 키 정리 · SQL dev 적용 · legacy 라벨 유지

### frontend-dev
- `QuickRequestRealtime`(대시보드·상세 마운트) · 패널·배지·`notifyQuickOpenchatOutcome` 제거 · 문구 2곳 · `canOperate` · `formatQuickRequestPreviewText`

### verifier
- mock 서버·env 제거 후 퀵 run 기동 확인 · `dongbang2` 일회용 계정 helper · 알림 판정은 dev DB 조회 · Realtime은 2 context로 5초 대기 판정 · 89 회귀

---

## 열린 질문

남은 열린 질문 없음. 종료된 질문:

| # | 질문 | 결론 (사용자 답변 2026-10-22) |
|---|---|---|
| OQ-1 | 운영 Vercel에 `QUICK_OPENCHAT_*` env가 있나요? | **해당 없음** — 운영에 아직 반영되지 않아 지울 env 없음(D-10) |
| OQ-2 | admin이 여러 명이면 등록·취소 알림을 모두에게 보내나요? | **예** — active admin 전원(D-4) |
| OQ-3 | 실시간 갱신 시 새 행을 강조할까요? | **아니요** — 조용히 갱신(U-5) |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-22 | 최초 작성. deep-interview Q1=A(동방 전원 모든 단계)·Q2=B(admin·구매물류 등록·취소만)·Q3=A(짧은 문구, 연락처 제외)·Q4=A(완전 삭제, legacy 라벨만 유지)·Q5=A(92 → 91)·Q6=B(퀵 대시보드 Realtime) 반영. 기본값(type 2종 유지·메시지 복사 삭제) 승인. 사용자 추가 요청(건별 채팅)은 plan 93으로 분리. 89 일부 supersede. Status Approved(/root 단일 게이트). 사용자 지시로 기획만 진행, 구현은 사용자 지시 시 | planner |
| 2026-10-22 | 열린 질문 답변 반영: OQ-1 운영 미반영 → Vercel env 삭제 「해당 없음」(D-10·Out 수정), OQ-2 admin 전원 수신 확정(D-4 명시), OQ-3 강조 없음 유지. 남은 열린 질문 없음. plan 93이 「퀵 대화」·안 읽은 수를 추가하면서 92의 `QuickRequestRealtime`을 확장한다는 점 참고 | planner |
