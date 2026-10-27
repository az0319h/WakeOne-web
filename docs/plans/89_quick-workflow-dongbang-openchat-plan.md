# 퀵 업무 흐름 리뉴얼 · 동방특송 소속 · 오픈채팅 webhook 자동 발송 기획서

> Date: 2026-10-21
> Status: In Progress
> Author: planner
> **Supersedes:** [82](./82_quick-request-plan.md)의 notify 501·「DB 저장 없음」·「대시보드/내역 Out」·「activity log 해당 없음」, [86](./86_quick-request-kakao-redesign-plan.md) AC-13·AC-16·AC-22(501·복사·reset), [87](./87_quick-request-goods-notes-address-picker-plan.md) AC-22(복사 흐름)·「최근 주소 FE 병렬 기록」, `e2e/quick-request/notify.api.spec.ts` 전체
> **상속(변경 없음):** 86·87의 요청 폼 UI·테마·반응형, 물품 크기, 특이사항 칩(SQL `85`), 주소 검색 모달, 최근 주소 테이블
> **부분 superseded by:** [92](./92_quick-web-only-notifications-plan.md) — 오픈채팅 webhook 전체(D-1·2·3·13·16·17, U-7, resend Route, AC-11~14·35 등)를 삭제하고 웹 알림으로 일원화. 건별 대화는 [93](./93_quick-request-chat-plan.md)
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [39](./39_announcements-plan.md), [49](./49_live-users-presence-plan.md), [57](./57_google-auth-approval-migration-plan.md), [63](./63_org-chart-admin-profile-plan.md), [76](./76_hr-benefits-manager-access-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **82** | Approved | 아래 결정을 **번복**한다. `POST /api/quick-request/notify` 501 → **삭제**(새 `POST /api/quick-request`가 대체). 「DB 저장 없음」→ 저장. 「퀵 그룹 페이지 1개」→ 퀵 대시보드 추가. 「activity log 해당 없음」→ CUD 전부 기록 |
| **83** | Approved | 폼 모델(경유 무제한·운임 방식)을 그대로 상속한다 |
| **86** | Approved | UI·테마·반응형은 상속한다. **AC-13·AC-16·AC-22**(501·클립보드 복사·폼 reset)는 이 plan의 AC-08·AC-09가 대체한다 |
| **87** | Approved (r1) | 칩·최근 주소·주소 모달은 상속한다. 최근 주소 기록은 FE 병렬 호출 → **서버 등록 Route 안에서 기록**하도록 바꾼다(§D-12). `POST /api/quick-request/recent-addresses` Route 자체는 남긴다 |
| **08·25·45** | Approved | 신규 CUD Route는 모든 return 분기(2xx/4xx/5xx)에서 `recordActivityLog`를 호출하고 `x-request-id`를 붙인다 |
| **14** | Completed | 취소는 `AlertModal`로 확인한다. `window.confirm`은 쓰지 않는다 |
| **27·78** | Approved | 인앱 알림 fan-out 선례. 신규 type 2개를 추가한다 |
| **39** | Approved | 공지 `announcements` RLS가 `authenticated` 전체 `true`이고, `listActiveUserIds()` fan-out 대상이다 → 동방특송을 제외해야 한다(§D-4) |
| **49·50** | Approved | Live 접속자 presence. 동방특송은 track하지 않는다(§D-4) |
| **57** | Approved | Google 로그인 → admin 승인 흐름을 재사용한다. 승인 Sheet에 「동방특송」 소속을 추가한다 |
| **63·67~71** | Approved | 조직도는 소속별 탭으로 되어 있다. 동방특송은 노출하지 않는다 |
| **76** | Completed | `affiliation + rank` 기반 권한 선례(`rank='인사팀'`). 「구매물류팀」 전체 조회도 같은 방식으로 판별한다 |
| **60** | Approved | 개인정보처리방침에 외부 업체(동방특송) 접근과 퀵 요청 정보 처리를 반영할지는 **별도 plan `[TBD]`**(이 plan에서는 Out) |

### 정찰로 확인한 사실

| 항목 | 사실 | 근거 |
|------|------|------|
| 소속 | DB CHECK `profiles_affiliation_check`: `wake`/`sans`/`sans_foundry`. FE `AFFILIATIONS`·`RANK_BY_AFFILIATION`·`POSITION_LEVEL_BY_AFFILIATION`이 `Record<Affiliation,…>` 형태 | dev DB, `src/features/users/constants/organization.ts` |
| 구매물류팀 | `affiliation='wake' AND rank='구매물류팀'`, dev active 2명 | dev DB SELECT |
| 서버 게이트 | Next 16 `proxy.ts`가 dashboard·API를 모두 거친다. `updateSession`이 profile의 `system_role, status, affiliation, rank`를 이미 읽는다 | `proxy.ts`, `src/lib/supabase/middleware.ts:99` |
| 로그인 후 착지 | `/dashboard` → `/dashboard/overview`. sign-in 이후에도 overview로 보낸다 | `src/app/dashboard/page.tsx`, `proxy.ts` |
| 기계 호출 | Bearer secret 선례가 있다(`CRON_SECRET`, OpenClaw import) | `src/app/api/contracts/_utils.ts` |
| 직접 조회 RLS | `announcements`·`announcement_attachments` SELECT가 `true`(로그인한 누구나). 나머지 테이블은 본인 또는 admin만 | dev `pg_policies` |
| E2E | `createOrgChartTestUser({affiliation, rank})`로 소속별 테스트 계정을 만들 수 있다. webServer `env`를 run마다 다르게 줄 수 있다(`isQuickRequestE2eRun`) | `e2e/auth.hr-benefits.setup.ts`, `playwright.config.ts` |
| 카카오 | 오픈채팅방 발송 공식 API는 없다(카카오 devtalk 답변). 실제 게시는 외부 봇이 맡는다 | Phase 0 보고 |

---

## 한 줄 요약

직원이 퀵을 **등록하면 DB에 저장**되고 `2026-01` 같은 번호가 발급된다. 서버는 **외부 발송 봇(webhook)**에 메시지를 자동으로 보낸다. 새 소속 **「동방특송」** 직원은 퀵 화면에서만 **접수 → 배차완료**를 처리하고 모든 항목을 수정할 수 있다. 요청자나 admin이 **최종금액을 승인**한다. 그 밖의 WakeOne 페이지와 API는 동방특송에게 **서버에서 차단**한다.

---

## 정책 확정안 (deep-interview 2026-10-21 · root 확정 · battle-plan 결정)

| # | 항목 | 확정 |
|---|------|------|
| D-1 | 발송 구조 | **WakeOne 쪽은 완전 자동.** 이벤트 4종(등록·접수·배차완료·취소)이 생기면 서버가 env `QUICK_OPENCHAT_WEBHOOK_URL`로 `POST`하고 `Authorization: Bearer ${QUICK_OPENCHAT_WEBHOOK_SECRET}`를 붙인다. 실제 오픈채팅방 게시는 **외부 봇 몫(범위 밖)**이다. 승인 때는 보내지 않는다 |
| D-2 | 발송 실패·재시도 | 요청 1건 처리 중 **최대 2회 시도**(각 timeout 4초, 네트워크 오류·5xx·408·429일 때만 1회 재시도). 그래도 실패하면 기록을 `failed`로 남기고, 동방특송·admin이 상세 화면에서 **「다시 보내기」**를 누른다. **자동 백그라운드 재시도(cron)는 Out**이다. 이유: 큐·cron 인프라가 없고 Vercel 함수가 응답 후 종료된다 |
| D-3 | 미설정 | URL이나 SECRET이 비어 있으면 HTTP 호출 없이 기록을 `not_configured`로 남긴다. **상태 변경은 정상 진행**하고, 발송 실패도 업무를 막지 않는다 |
| D-4 | 동방특송 소속 | `affiliation='dongbang'`(라벨 **「동방특송」**), `system_role='user'`. 승인·수정 때 이 소속을 고르면 부서(rank)·직급·리더 입력을 **숨기고 저장값은 null**로 둔다. 조직도·overview 생일 배너·Live 접속자·공지 fan-out·복지비 명단에서 **제외**한다 |
| D-5 | 동방특송 허용 범위 (allowlist) | **페이지:** `/dashboard/quick`(대시보드·상세), `/dashboard/profile`, `/dashboard/notifications`, `/dashboard/logs`. **API:** `/api/quick-request/**`(단, 등록 `POST /api/quick-request`·`notes/**`·`recent-addresses`는 403), `/api/profile`(GET·PATCH), `/api/notifications/**`, `/api/activity-logs`, `/api/auth/**`. **그 밖의 dashboard 페이지는** `/dashboard/quick`로 redirect하고 access-denied flash를 띄운다. **그 밖의 API는** `403 {"success":false,"message":"접근 권한이 없습니다."}`를 돌려준다. `/dashboard`·`/dashboard/overview`·sign-in 착지는 `/dashboard/quick`로 바꾼다 |
| D-6 | 동방특송의 퀵 요청 등록 | **불가.** `/dashboard/quick/request`는 `/dashboard/quick`로 redirect한다. 메뉴의 「퀵 요청하기」도 숨긴다 |
| D-7 | 요청번호 | `{KST 연도}-{순번}`. 연도별 1부터 시작하고 **최소 2자리**로 0을 채운다(`2026-01` … `2026-99`, `2026-100`). DB 카운터 테이블 + `insert … on conflict do update … returning`으로 원자적으로 발급한다(동시성 안전). `lpad`는 자리를 자르므로 쓰지 않는다 |
| D-8 | 상태 | `requested`(신규요청) → `dispatching`(접수 및 배차중) → `dispatched`(배차완료 및 결과) → `approved`(승인). 그 밖에 `cancelled`(취소)가 있다. 전이는 `where status = 기대값` 조건부 update로 처리하고, 경합하면 **409** 「이미 다른 사용자가 처리한 요청입니다. 새로고침해 주세요.」를 돌려준다 |
| D-9 | 역할별 권한 | 아래 §권한 매트릭스 |
| D-10 | admin 대리 처리 | **admin은 동방특송이 할 수 있는 모든 동작을 대리**할 수 있다(접수·배차완료·수정·취소·다시 보내기). 이유: 동방 담당자가 전화로 처리한 건을 총무가 대신 입력하는 경우가 있고, 동방 계정 문제 때 업무가 멈추지 않아야 한다 |
| D-11 | 구매물류팀 | `wake` + `rank='구매물류팀'`은 **전체 조회만** 가능하다(수정·접수·승인 불가, 본인 요청의 승인·취소는 일반 요청자와 동일). 이유: 사용자 답변이 「전체 조회」였고, 수정 권한까지 주면 책임 주체가 흐려진다 |
| D-12 | 최근 주소 기록 | 등록 Route가 **insert 성공 직후 서버에서** `recordQuickRequestRecentAddresses`를 호출한다(실패해도 등록은 성공, 로그 metadata `recentAddressesRecorded:false`). FE의 병렬 `POST recent-addresses` 호출은 제거한다. 이유: 등록이 실패했는데 주소만 남는 불일치를 없앤다 |
| D-13 | 클립보드 복사 UX | 등록 확인 시 **자동 복사는 제거**한다. 등록 성공 → 상세 화면으로 이동한다. 발송이 `failed`/`not_configured`일 때를 대비해 상세의 「오픈채팅 발송」 패널(동방·admin만)에 **「메시지 복사」** 보조 버튼을 둔다 |
| D-14 | 조회 기간 | 대시보드는 **최근 7일**(KST 기준 오늘 포함 7일, `requested_at`)만 다룬다. 카드 숫자도 같은 기간·같은 조회 범위다. 전체 기간 「퀵 내역」 메뉴와 CSV는 **2차(Out)** |
| D-15 | 데이터 이전 | SANS QUICK 데이터는 **이전하지 않는다**(Out) |
| D-16 | 인앱 알림(보조 채널) | ① `quick_request.vendor_event`: 등록·취소 시 **active 동방특송 전원**에게 보낸다(webhook이 실패해도 동방이 알 수 있게). ② `quick_request.requester_event`: 접수·배차완료·최종금액 입력·admin 승인·동방/admin 취소 시 **요청자**에게 보낸다. 행위자 본인에게는 보내지 않는다 |
| D-17 | 개인정보 | webhook `text`에는 **기사 연락처·기사 이름·예상금액**이 들어간다(기존 SANS 메시지와 동일). 출발·도착 담당자 연락처는 **넣지 않는다**(링크로만 확인) |

### 권한 매트릭스

조회 범위: 일반 직원은 자기 요청만 본다. **동방특송·admin·구매물류팀**(viewer-all)은 전체를 본다.

| 동작 | 요청자 본인 | 동방특송 | admin | 구매물류팀(타인 건) | 허용 상태 |
|------|:-:|:-:|:-:|:-:|------|
| 등록 | O (active 직원·admin) | **X** | O | O(본인 건) | — |
| 상세·목록 조회 | 본인 건 | 전체 | 전체 | 전체 | 전 상태 |
| 항목 수정(주소·이름·연락처·일정·물품·차량·운임·메모·특이사항·배차정보·금액) | **X** | O | O | X | `requested`·`dispatching`·`dispatched` |
| 접수 | X | O | O | X | `requested` → `dispatching` |
| 배차완료(예상금액·차량정보·기사이름·기사연락처 **필수**) | X | O | O | X | `dispatching` → `dispatched` |
| 최종금액 입력·수정 | X | O | O | X | `dispatched` |
| 승인(최종금액 **필수**) | O | X | O | X | `dispatched` → `approved` |
| 취소(사유 선택 입력, 최대 200자) | O (**`requested`만**) | O | O | X | 요청자: `requested` / 동방·admin: `requested`·`dispatching`·`dispatched` |
| 오픈채팅 다시 보내기·메시지 복사 | X | O | O | X | 해당 이벤트 기록 존재 시 |
| `approved`·`cancelled` 이후 | 모든 변경 **불가** (admin 포함) | | | | |

---

## 목표 & 완료 기준 (AC)

공통 사항:
- 시각 표기는 `formatAbsoluteDateTimeKo`(`yyyy-MM-dd (EEE) HH:mm:ss`)로 하고, 상대 시각은 쓰지 않는다.
- 금액은 `20,000원`처럼 표기한다(부가세 별도 문구는 배차 메시지에만).
- E2E 셀렉터는 `getByRole`/`getByPlaceholder`/`getByTestId`만 쓴다.
- E2E 계정은 `user.json`(일반), `user2.json`(타 일반), `admin.json`, **신규** `dongbang.json`(`affiliation='dongbang'`), **신규** `logistics.json`(`wake`·`구매물류팀`)이다.
- 퀵 E2E run은 webServer env에 `QUICK_OPENCHAT_WEBHOOK_URL=http://127.0.0.1:4599/openchat`과 `QUICK_OPENCHAT_WEBHOOK_SECRET=e2e-openchat-secret`를 넣는다. mock 서버는 globalSetup에서 띄우고, 받은 요청을 기록하며 실패 모드를 켜고 끌 수 있다. 미설정 케이스는 별도 project(env 없이)로 돌리거나 API 단위로 검증한다.

### A. 소속·접근 차단

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-01 | Playwright | admin · 승인 대기 사용자 1명 | `/dashboard/users` 승인 Sheet에서 소속 **「동방특송」** 선택 | 부서·직급·리더 입력칸이 **사라짐** · 승인 성공 · DB `affiliation='dongbang'`, `rank`·`position_level`·`leader_role` **null** · `user.approve` 로그 1건 |
| AC-02 | Playwright | admin · 기존 사용자 수정 Sheet | 소속을 「동방특송」으로 변경 저장 | 동일하게 조직 필드 숨김·null 저장 · Users 표 소속 열 「동방특송」 |
| AC-03 | Playwright | `dongbang.json` | 사이드바·kbar 확인 | 노출 메뉴는 **「퀵 대시보드」·「알림」·「활동 로그」·프로필(사용자 메뉴)**뿐 · 「퀵 요청하기」·「대시보드(overview)」·「조직도」·「공지사항」 등 **0건** |
| AC-04 | Playwright | `dongbang.json` | `/dashboard`, `/dashboard/overview`, `/dashboard/org-chart`, `/dashboard/announcements`, `/dashboard/my-benefits`, `/dashboard/kanban`, `/dashboard/quick/request`, `/dashboard/support` 직접 입력 | 모두 **`/dashboard/quick`**로 이동 · overview를 제외한 경로는 access-denied 토스트 표시 |
| AC-05 | API | `dongbang.json` 세션 | `GET /api/org-chart?affiliation=wake`, `GET /api/announcements`, `GET /api/users`, `GET /api/my-benefits`, `GET /api/google-tasks/lists`, `POST /api/quick-request`, `GET /api/quick-request/notes` | 모두 **403** · body `{"success":false,"message":"접근 권한이 없습니다."}` |
| AC-06 | API | `dongbang.json` 세션 | ① `GET /api/notifications`, `GET /api/activity-logs`, `GET /api/quick-request`, `GET /api/quick-request/summary` ② `GET /api/profile`, `PATCH /api/profile` | ① 모두 **200** ② proxy 403 본문 `{"success":false,"message":"접근 권한이 없습니다."}`이 **아님** — Route 자체 응답(GET은 핸들러가 없어 **405**, PATCH는 Route의 기존 응답)이면 통과. 의도: 동방특송 허용 API는 proxy가 막지 않는다 |
| AC-07 | Playwright·DB | 동방특송 active 1명 존재 | `user.json`으로 `/dashboard/org-chart` 각 탭 · admin `/dashboard/benefits` 명단 · 공지 1건 발행 | 동방특송 사용자가 조직도·복지비 명단에 **0건** · 공지 발행 알림 수신자에 동방특송 **0건** · Supabase client로 `announcements` select 시 동방 세션은 **0행**(RLS) |

### B. 등록·번호·발송

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-08 | Playwright | `user.json` · 유효 폼 | `/dashboard/quick/request` 등록 → 미리보기 Dialog **「확인」** | `POST /api/quick-request` **201** · 토스트 **「퀵 요청이 등록되었습니다. (요청번호 YYYY-NN)」** · URL **`/dashboard/quick/{요청번호}`** · 상세 상태 배지 **「신규요청」** · 클립보드 자동 복사 **없음** |
| AC-09 | Playwright | 375px 모바일 | 하단바 등록 → 확인 | AC-08과 같은 결과 |
| AC-10 | API·DB | 같은 해 연속 등록 | `POST /api/quick-request` 5건 **동시** 실행 | 요청번호 5개 **모두 다름** · 숫자 부분 연속 · 형식 `^\d{4}-\d{2,}$` · 순번 9 → `-09`, 10 → `-10` · 순번 100은 `-100`(SQL 함수 단위 검증) |
| AC-11 | API (mock webhook) | webhook env 설정 | 등록 | mock이 **1건 수신** · 헤더 `Authorization: Bearer e2e-openchat-secret`, `X-WakeOne-Event: quick_request.created`, `Idempotency-Key: {id}:created` · body에 `event`·`requestNo`·`status`·`text`·`link`·`occurredAt` · `text` 첫 줄 **`❗ 퀵요청 - {요청번호}`** · `text`에 「동방특송 담당자님 상세 내역을 확인하시고 접수 및 배차를 진행해주세요.」 · `link` = `{NEXT_PUBLIC_APP_URL}/dashboard/quick/{요청번호}` · 출발·도착 담당 연락처 **미포함** · 발송 기록 `sent` |
| AC-12 | API (mock 실패 모드) | mock이 500 응답 | 등록 | 등록은 **201** · mock 수신 **2회**(재시도 1회) · 발송 기록 `failed` · `attempt_count=2` · 응답 `openchat.status='failed'` · FE 경고 토스트 **「오픈채팅 자동 발송에 실패했습니다. 상세 화면에서 다시 보낼 수 있습니다.」** |
| AC-13 | API | webhook env **미설정** | 등록 | **201** · HTTP 호출 없음 · 기록 `not_configured` · 상세 발송 패널에 **「미설정」** |
| AC-14 | Playwright | `dongbang.json` · AC-12의 `failed` 건 | 상세 「오픈채팅 발송」 패널 → 등록 이벤트 **「다시 보내기」** (mock 정상 모드) | 상태 **「발송됨」** · `attempt_count` 증가 · 같은 `Idempotency-Key` · `quick_request.openchat_resend` 로그 1건 · 「메시지 복사」 클릭 시 「메시지가 복사되었습니다.」 |
| AC-15 | Playwright | 등록 성공 | `/dashboard/quick/request` 다시 진입 → 주소 모달 「최근 이용 내역」 | 방금 쓴 주소가 **맨 위** · FE가 `POST /api/quick-request/recent-addresses`를 호출하지 **않음**(network 0건) |

### C. 동방특송 처리 흐름

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-16 | Playwright | `dongbang.json` · `requested` 건 | 대시보드 표 「업무 처리」 **「접수」** 또는 상세 「접수」 | 상태 **「접수 및 배차중」** · mock 수신 `X-WakeOne-Event: quick_request.accepted`, text 첫 줄 **`✅접수완료 및 배차중 - {번호}`** · 요청자 인앱 알림 1건 · `quick_request.accept` 로그 |
| AC-17 | Playwright | `dongbang.json` · `dispatching` 건 | 「배차완료」 → Dialog에서 예상금액·차량정보·기사이름·기사연락처 중 하나라도 비움 | 한국어 필드 에러 · 요청 미전송 |
| AC-18 | Playwright | AC-17 계속 | 예상금액 `20000`, 차량정보 `오토바이 8514`, 기사이름 `홍길동`, 연락처 `01012345678` 입력 → 저장 | 상태 **「배차완료 및 결과」** · 상세에 `20,000원`·`오토바이 8514`·`홍길동`·`010-1234-5678` · mock text에 **`🚚배차등록 완료 - {번호}`**, `예상금액: 20,000원(부가세 별도)`, `차량정보: 오토바이 8514`, `기사이름: 홍길동`, `기사 연락처: 010-1234-5678` · `quick_request.dispatch` 로그 |
| AC-19 | Playwright | `dongbang.json` · `dispatching` 건 | 수정 Sheet에서 도착지 상세주소·도착 담당 연락처·차량 종류 변경 → 저장 | 상세 즉시 반영 · `quick_request.update` 로그 metadata `changedFields`에 변경 필드 · webhook **발송 없음** |
| AC-20 | Playwright | `dongbang.json` · `dispatched` 건 | 최종금액 `23000` 입력 저장 | 상세·표 「최종금액」 `23,000원` · 요청자 인앱 알림 「최종금액이 입력되었습니다. 확인 후 승인해 주세요.」 |
| AC-21 | API | 동시성 | 같은 `requested` 건에 `accept` 2회 동시 실행 | 하나는 200, 하나는 **409** 「이미 다른 사용자가 처리한 요청입니다. 새로고침해 주세요.」 · webhook 1회 |

### D. 요청자·승인·취소·잠금

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-22 | Playwright·API | `user.json` · 본인 `requested` 건 | 상세 화면 확인 · `PATCH /api/quick-request/{번호}` 직접 호출 | 「수정」 버튼 **없음** · PATCH **403** 「요청자는 등록 후 내용을 수정할 수 없습니다.」 |
| AC-23 | Playwright | `user.json` · 본인 `requested` 건 | 「요청 취소」 → **AlertModal**(「퀵 요청을 취소할까요?」) → 확인 | 상태 **「취소」** · mock text 첫 줄 **`🚫퀵요청 취소 - {번호}`** · 동방특송 인앱 알림 · `quick_request.cancel` 로그 · `window.confirm` 사용 0건(grep) |
| AC-24 | Playwright·API | `user.json` · 본인 `dispatching` 건 | 상세 확인 · `POST …/cancel` 직접 호출 | 「요청 취소」 버튼 **없음** · API **403** 「접수된 요청은 취소할 수 없습니다. 동방특송 담당자에게 연락해 주세요.」 |
| AC-25 | Playwright | `user.json` · 본인 `dispatched` 건 · 최종금액 **없음** | 「승인」 | 버튼 **비활성** + 안내 「최종금액이 입력되면 승인할 수 있습니다.」 · API 직접 호출 시 **409** |
| AC-26 | Playwright | `user.json` · 본인 `dispatched` 건 · 최종금액 있음 | 「승인」 → 확인 | 상태 **「승인」** · webhook **발송 없음**(mock 0건 증가) · `quick_request.approve` 로그 |
| AC-27 | API | `dongbang.json` · `approved`·`cancelled` 건 | PATCH·accept·dispatch·cancel | 모두 **409** 「완료되었거나 취소된 요청은 변경할 수 없습니다.」 · admin도 동일 |
| AC-28 | API | `dongbang.json` | `POST /api/quick-request/{번호}/approve` | **403** |

### E. 대시보드·조회 범위

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-29 | Playwright | `user.json`·`user2.json` 각각 등록 | `user.json`으로 `/dashboard/quick` | 제목 **「나의 퀵 내역」** · 본인 건만 · `user2` 건 **0건** · `user2` 건 상세 URL 직접 접근 시 **「퀵 요청을 찾을 수 없습니다.」**(API 404) |
| AC-30 | Playwright | `dongbang.json`·`admin.json`·`logistics.json` 각각 | `/dashboard/quick` | 제목 **「퀵 내역」** · 두 사용자 건 **모두** 노출 · `logistics.json`에는 「접수」·「수정」·「배차완료」 버튼 **0건** |
| AC-31 | Playwright | 상태별 데이터 존재 | 카드 4개 확인 · 「접수 및 배차중」 카드 클릭 | 카드 라벨 **「신규요청」「접수 및 배차중」「배차완료 및 결과」「승인」**과 숫자 · 별도 **「취소 N」** 표시 · 클릭 시 표가 해당 상태만 · URL `?status=dispatching`(nuqs) |
| AC-32 | Playwright | — | 검색창에 요청번호 일부 / 요청자 이름 / 도착 주소 일부 입력 | 300~500ms debounce 후 일치 행만 · 결과 없으면 「조건에 맞는 퀵 요청이 없습니다.」 |
| AC-33 | Playwright | 8일 전 `requested_at` 행(DB fixture) | 대시보드 | 해당 행 **미노출** · 안내 문구 **「최근 7일 기준」** 표시 |
| AC-34 | Playwright | — | 표 열 헤더 확인 | 「진행 상태」「요청 정보」「요청자」「이동 경로」「물품·차량」「예상금액」「최종금액」「상세 보기」「업무 처리」 · 하단 문구 **「운송 완료 후 실제 금액을 확인하고 승인해주세요.」** · 요청 시각 절대 시각 형식 |
| AC-35 | Playwright | `admin.json`·`dongbang.json` | 대시보드 상단 | webhook 설정 시 **「오픈채팅 자동 발송: 연결됨」**, 미설정 시 **「오픈채팅 자동 발송: 미설정」** · 일반 직원에게는 **미노출** |
| AC-36 | Playwright | 375px · `dongbang.json` | `/dashboard/quick` · 상세 | 가로 스크롤 없음 · 표는 모바일 카드 리스트로 전환 · 버튼 터치 영역 ≥ 44px |

### F. 활동 로그·품질

| AC | 유형 | 전제 | 동작 | 기대 |
|----|------|------|------|------|
| AC-37 | Playwright | AC-08·16·18·23 수행 후 | `user.json`·`dongbang.json` 각자 `/dashboard/logs` | 본인 행위 로그 **「퀵 요청 등록」「퀵 요청 접수」「퀵 배차 완료」「퀵 요청 취소」** 노출 · 결과 열 성공 표시 · admin `/dashboard/logs`에서 403 실패 로그도 1건 이상 조회(AC-22 PATCH 403) |
| AC-38 | grep | — | 신규 CUD Route 8개 | 모든 `return`이 `jsonWithActivityLog`/`finishWithActivityLog`를 거침 · `notify/route.ts` **삭제됨** · `formatQuickRequestKakaoMessage` 클립보드 자동 복사 코드 0건 |
| AC-39 | CLI | — | `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npx playwright test e2e/quick-request e2e/quick-workflow` | 모두 통과 |

**AC 총 39개**: A 7 · B 8 · C 6 · D 7 · E 8 · F 3. 유형은 Playwright 위주이고, API·DB 직접 검증은 AC-05·06·10·11·12·13·21·27·28, grep은 AC-38, CLI는 AC-39다.

---

## 범위 (In / Out)

### In
1. SQL `89`(plan 88 workflow-expense가 SQL 86~88을 예약했으므로 89 이상. backend-dev가 `ls supabase/sql`·`list_migrations`로 재확인): `affiliation` CHECK에 `dongbang` 추가, `quick_request_counters`·`quick_requests`·`quick_request_openchat_dispatches`, RLS, 번호 발급·생성 RPC, `notifications_type_check`에 2종 추가, `announcements`·`announcement_attachments` SELECT 정책에서 동방 제외
2. 동방특송 소속: 상수·승인 Sheet·수정 Sheet·Users 표·조직도/생일/Live/공지 fan-out/복지비 명단 제외
3. `proxy.ts` 동방 allowlist 게이트(페이지 redirect·API 403)와 착지 경로, `requireDashboardSession` 계층 2차 방어(layout에서 동방이 허용되지 않은 경로면 redirect)
4. 퀵 API: 등록·목록·상세·수정·접수·배차완료·승인·취소·다시 보내기
5. webhook 발송 모듈(템플릿 4종·재시도·기록), 인앱 알림 2종
6. FE: `/dashboard/quick`(대시보드), `/dashboard/quick/[requestNo]`(상세), 요청 화면 「확인」 동작 교체, nav 「퀵 대시보드」, 동방용 nav 필터
7. activity log 8 action과 라벨
8. E2E: 신규 auth 2종, mock webhook, 기존 `notify.api.spec.ts` 삭제, `order-page.spec.ts` AC-13/22 교체

### Out
| 항목 | 이유 |
|------|------|
| 실제 오픈채팅 게시 봇 구축·운영 | WakeOne 밖. 비공식 봇은 카카오 이용 정지 위험이 있다(운영 판단) |
| 전체 기간 「퀵 내역」 메뉴·CSV 다운로드 | 2차 plan |
| SANS QUICK 데이터 이전 | 사용자 결정 Q5 |
| 자동 백그라운드 재시도(cron/queue) | D-2 |
| 승인 취소(un-approve)·승인 후 수정 | 정산 확정 의미 유지 |
| 동방특송의 퀵 등록 | D-6 |
| Realtime 목록 자동 갱신 | React Query `refetchOnWindowFocus` + mutation `onSettled` invalidate로 충분하다. 2차에서 검토 |
| 개인정보처리방침 개정 | 별도 plan `[TBD]` |
| Main DB 적용 | dev만. 운영 반영은 별도 승인 |

---

## UI 요구사항 (designer 지시)

| # | 화면 | 요구 |
|---|------|------|
| U-1 | nav | 「퀵」 그룹: **「퀵 대시보드」** `/dashboard/quick`(아이콘 기존 세트, shortcut `q d`)를 「퀵 요청하기」 위에 둔다. 동방특송은 「퀵 대시보드」·「알림」·「활동 로그」만 보이고 kbar도 같다 |
| U-2 | `/dashboard/quick` | `PageContainer`. 상단에 제목(「나의 퀵 내역」/「퀵 내역」), 「최근 7일 기준」 보조 문구, 우측 「퀵 요청하기」 버튼(동방 제외), 발송 상태 뱃지(동방·admin). 카드 4개(클릭하면 상태 필터, 선택 강조)와 「취소 N」 작은 표시. 필터 shell(검색 Input·상태 Select)은 plan 40 규칙대로 유지하고 body만 Spinner. 표는 기존 `data-table` 패턴을 쓰고, 모바일은 카드 리스트. 하단에 안내 문구 |
| U-3 | 표 셀 | 진행 상태(Badge 색: 신규=blue, 접수=amber, 배차완료=violet, 승인=green, 취소=muted), 요청 정보(번호 굵게 + 요청 시각), 요청자, 이동 경로(출발 시·구 → 도착 시·구, 경유 N), 물품·차량(크기 라벨 / 차량·대수), 예상금액·최종금액(없으면 「—」), 상세 보기(링크 버튼), 업무 처리(역할·상태에 맞는 버튼 1개: 접수/배차완료/최종금액 입력/승인, 없으면 「—」) |
| U-4 | 상세 `/dashboard/quick/[requestNo]` | 상단: 번호·상태 Badge·4단계 Stepper(취소면 「취소됨」 배너와 사유). 섹션: 요청 정보(요청자·연락처·요청 시각), 출발/경유/도착(주소·담당·연락처·일정·특이사항·메모), 물품·차량·운임, 배차 정보(예상금액·차량정보·기사·연락처), 금액(예상·최종), 처리 이력(접수/배차/승인/취소 시각·처리자). 하단 고정 액션바: 역할별 버튼 |
| U-5 | 수정 Sheet (동방·admin) | 요청 폼과 같은 필드를 Sheet(데스크톱 우측, 모바일 Drawer)로 연다. **86·87 섹션 컴포넌트를 재사용**(주소 모달·특이사항 칩 포함, 다만 칩 「관리」 CRUD는 숨김. 칩은 요청 시 저장된 라벨을 표시하고 선택 해제만 가능). 배차정보·금액 필드 추가. 저장 시 변경 필드만 PATCH |
| U-6 | Dialog | 「배차완료」 Dialog(4필드 필수), 「최종금액 입력」 Dialog, 「승인」 확인 AlertModal, 「요청 취소」 AlertModal(사유 Textarea 선택) |
| U-7 | 오픈채팅 발송 패널 (동방·admin) | 이벤트별 행: 이벤트명, 상태 Badge(발송됨/실패/미설정), 시도 횟수, 마지막 시도 시각, 오류 요약, 「다시 보내기」, 「메시지 복사」 |
| U-8 | 요청 화면 | 미리보기 Dialog 「확인」 문구를 **「등록」**으로 바꾸고 pending 동안 Spinner. 성공하면 상세로 `router.push`. 폼 reset은 불필요(페이지 이동) |
| U-9 | 승인·수정 Sheet (users) | 소속 Select에 「동방특송」 추가. 선택하면 부서·직급·리더·생일 입력을 숨기고 안내 「동방특송은 퀵 화면만 이용할 수 있습니다.」 |
| U-10 | 404 | 권한 없음이나 미존재는 같은 화면 「퀵 요청을 찾을 수 없습니다.」 + 「퀵 대시보드로」 버튼 |

---

## API / DB 요구사항

### DB (SQL `89_quick_requests_workflow.sql` · dev 전용 · 번호는 적용 직전 재확인)

```
profiles_affiliation_check  → ('wake','sans','sans_foundry','dongbang')

quick_request_counters (year int pk, last_seq int not null default 0)

quick_requests
  id uuid pk default gen_random_uuid()
  request_no text unique not null          -- 'YYYY-NN'
  request_year int not null, request_seq int not null, unique(request_year, request_seq)
  status text not null check in ('requested','dispatching','dispatched','approved','cancelled')
  requester_user_id uuid not null references auth.users on delete restrict
  requester_name text not null              -- 등록 시 profiles.full_name 스냅샷 (클라이언트 값 불신)
  requester_phone text null                 -- 스냅샷
  goods_size text not null, item_description text not null default ''
  vehicle_types text[] not null, vehicle_other_text text null, vehicle_count int not null check (>0)
  freight_payment text not null check in ('monthly','collect')
  origin jsonb not null, stopovers jsonb not null default '[]', destination jsonb not null
  requested_at timestamptz not null default now()
  estimated_amount int null check (>=0), final_amount int null check (>=0)
  dispatch_vehicle_info text null (<=100), driver_name text null (<=50), driver_phone text null (11자리)
  accepted_at/by, dispatched_at/by, final_amount_set_at/by, approved_at/by, cancelled_at/by, cancel_reason (<=200)
  created_at, updated_at (set_updated_at trigger)
  index (requested_at desc), (status, requested_at desc), (requester_user_id, requested_at desc)

quick_request_openchat_dispatches
  id bigint identity pk, quick_request_id uuid fk on delete cascade
  event text check in ('created','accepted','dispatched','cancelled'), unique(quick_request_id, event)
  status text check in ('sent','failed','not_configured')
  attempt_count int not null default 0, http_status int null, error_message text null (<=500)
  payload jsonb not null                    -- 다시 보내기에 그대로 사용
  last_attempt_at timestamptz null, sent_at timestamptz null, created_at, updated_at
```

- **RPC** `create_quick_request(p_requester uuid, p_payload jsonb, …)`는 `security definer`, `search_path=''`, **service_role만 execute**한다. 하나의 트랜잭션에서 KST 연도를 구하고, counter를 upsert해 `returning last_seq`를 받은 뒤 `request_no = year || '-' || case when seq < 10 then '0' || seq else seq::text end`로 만들어 insert하고 row를 돌려준다.
- **RLS:** `quick_requests` SELECT는 `requester_user_id = auth.uid() OR public.can_view_all_quick_requests()`로 둔다. 이 함수는 security definer이고, active이면서 admin, `dongbang`, 또는 `wake`+`구매물류팀`일 때 true다. dispatches SELECT는 `can_view_all_quick_requests()`만 허용한다. 두 테이블 모두 `authenticated`의 insert/update/delete를 **revoke**한다(쓰기는 Route Handler + service role).
- `notifications_type_check`에 `quick_request.vendor_event`, `quick_request.requester_event`를 추가한다. **plan 88(workflow-expense)도 이 CHECK에 `workflow.*` 6종을 추가하므로**, 적용 시점의 현재 CHECK 목록을 dev DB에서 읽어 **기존 값 전부 + 신규 2종**으로 재정의한다(덮어쓰기 금지).
- `announcements_authenticated_select`·`announcement_attachments_authenticated_select`는 `true` → `not public.is_dongbang_user()`로 바꾼다. 공지 Storage 버킷 정책도 같은 조건으로 점검한다(backend-dev 확인).

### 판별 helper (`src/features/auth/api/quick-access.server.ts` 신규)

- `isDongbang(profile)`: `affiliation === 'dongbang'`
- `isLogisticsViewer(profile)`: `system_role === 'user' && affiliation === 'wake' && rank === '구매물류팀'`
- `canViewAllQuickRequests(profile)`: admin, 동방, 구매물류팀 중 하나
- `canOperateQuickRequests(profile)`: admin 또는 동방
- `src/config/dongbang-routes.ts`: `DONGBANG_ALLOWED_PAGE_PREFIXES`, `isDongbangAllowedApi(pathname, method)`. `proxy.ts`와 nav 필터가 함께 쓴다.

### Route (모두 `requireSession` + active, 오류 메시지는 한국어)

| Method · Path | 권한 | 동작 | 주요 응답 |
|---|---|---|---|
| `POST /api/quick-request` | active, 동방 제외 | 기존 notify 스키마를 재사용(`requesterName`·`requestedAtIso`는 **무시**하고 서버에서 결정). RPC 생성 → 최근 주소 기록 → webhook `created` → 동방 인앱 알림 | 201 `{data:{requestNo, id, openchat:{status}}}` · 400 · 403 · 500 |
| `GET /api/quick-request?status=&search=&page=&limit=` | active | 최근 7일 + 조회 범위. `counts`(5상태), `viewer:{scope:'own'\|'all', canOperate}`, `openchatConfigured`(동방·admin만) | 200 |
| `GET /api/quick-request/[requestNo]` | 조회 권한 | 상세 + `permissions`(canEdit/accept/dispatch/setFinal/approve/cancel/resend) + dispatches(viewer-all만) | 200 · 404(권한 없음 포함) |
| `PATCH /api/quick-request/[requestNo]` | 동방·admin | 부분 수정(zod partial). `final_amount`는 `dispatched`에서만 | 200 · 400 · 403 · 404 · 409 |
| `POST /api/quick-request/[requestNo]/accept` | 동방·admin | `requested` → `dispatching`, webhook `accepted` | 200 · 403 · 404 · 409 |
| `POST /api/quick-request/[requestNo]/dispatch` | 동방·admin | 4필드 필수, `dispatching` → `dispatched`, webhook `dispatched` | 200 · 400 · 403 · 404 · 409 |
| `POST /api/quick-request/[requestNo]/approve` | 요청자·admin | `dispatched` + final_amount → `approved` | 200 · 403 · 404 · 409 |
| `POST /api/quick-request/[requestNo]/cancel` | §권한 매트릭스 | → `cancelled`, webhook `cancelled` | 200 · 400 · 403 · 404 · 409 |
| `POST /api/quick-request/[requestNo]/openchat/resend` body `{event}` | 동방·admin | 저장된 payload 재전송(같은 재시도 규칙) | 200 `{status}` · 400 · 403 · 404 · 409(`sent` 상태 재전송 불가) |
| ~~`POST /api/quick-request/notify`~~ | — | **삭제** | — |

`[requestNo]`는 `^\d{4}-\d{2,}$`로 검증하고, 맞지 않으면 404다. 정적 세그먼트(`notes`, `recent-addresses`)가 우선하므로 충돌하지 않는다.

### webhook 계약 (`src/features/quick-request/lib/openchat-webhook.server.ts`)

```http
POST {QUICK_OPENCHAT_WEBHOOK_URL}
Authorization: Bearer {QUICK_OPENCHAT_WEBHOOK_SECRET}
Content-Type: application/json
X-WakeOne-Event: quick_request.created | quick_request.accepted | quick_request.dispatched | quick_request.cancelled
Idempotency-Key: {quick_request_id}:{event}

{
  "event": "quick_request.created",
  "requestNo": "2026-01",
  "status": "requested",
  "text": "<오픈채팅에 그대로 올릴 본문>",
  "link": "https://<NEXT_PUBLIC_APP_URL>/dashboard/quick/2026-01",
  "occurredAt": "2026-10-21T05:12:00.000Z",
  "requesterName": "김주원",
  "route": { "from": "서울 강남구", "to": "서울 용산구", "stopoverCount": 0 },
  "dispatch": null | { "estimatedAmount": 20000, "vehicleInfo": "오토바이 8514", "driverName": "홍길동", "driverPhone": "01012345678" }
}
```

성공은 2xx다. 봇은 같은 `Idempotency-Key`를 중복 게시하지 않도록 처리하는 것을 권장한다(봇 쪽 책임).

**메시지 템플릿** (`text`, 줄바꿈 `\n`):
- created: `❗ 퀵요청 - {no}` / `🚚{출발 시·구}→{도착 시·구}{경유 있으면 " (경유 N)"}` / `출발일시: {즉시 요청 | 절대시각}` / 빈 줄 / `"{요청자}"님이 퀵 요청을 하였습니다.` / `동방특송 담당자님 상세 내역을 확인하시고 접수 및 배차를 진행해주세요.` / 빈 줄 / `상세 확인: {link}`
- accepted: `✅접수완료 및 배차중 - {no}` / `접수 후에는 요청 내용을 수정할 수 없습니다. 변경이 필요하면 동방특송 담당자에게 연락해 주세요.` / `상세 확인: {link}`
- dispatched: `🚚배차등록 완료 - {no}` / `예상금액: {n}원(부가세 별도)` / `차량정보: {info}` / `기사이름: {name}` / `기사 연락처: {010-0000-0000}` / `상세 확인: {link}`
- cancelled: `🚫퀵요청 취소 - {no}` / `"{행위자}"님이 퀵 요청을 취소하였습니다.` / `사유: {reason}`(있을 때만) / `상세 확인: {link}`

「시·구」는 도로명주소 앞 두 토큰이다(예: `서울 용산구`). `[INFERRED]` 기존 SANS의 「본사」 같은 별칭은 데이터가 없어 쓰지 않는다.

### env

| 키 | 필수 | 설명 |
|---|---|---|
| `QUICK_OPENCHAT_WEBHOOK_URL` | 선택 | 없으면 `not_configured` |
| `QUICK_OPENCHAT_WEBHOOK_SECRET` | 선택(URL과 쌍) | Bearer |
| `NEXT_PUBLIC_APP_URL` | 기존 | 상세 링크 생성. 개발에서는 `http://localhost:3000` |

`.env.example`에 키 이름만 추가한다(값은 넣지 않음).

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md). READ(GET)는 Out이다.

| Route | action | 라벨(`labels.ts`) | target | return 분기 |
|---|---|---|---|---|
| `POST /api/quick-request` | `quick_request.create` | 퀵 요청 등록 | `quick_request` / `{requestNo}` | 201 · 400(JSON·zod) · 401/403(`logQuickRequestAuthFailure`) · 403(동방) · 500 |
| `PATCH /api/quick-request/[no]` | `quick_request.update` | 퀵 요청 수정 | 〃 | 200 · 400 · 403 · 404 · 409 · 500 · metadata `changedFields` |
| `POST …/accept` | `quick_request.accept` | 퀵 요청 접수 | 〃 | 200 · 403 · 404 · 409 · 500 |
| `POST …/dispatch` | `quick_request.dispatch` | 퀵 배차 완료 | 〃 | 200 · 400 · 403 · 404 · 409 · 500 |
| `POST …/approve` | `quick_request.approve` | 퀵 요청 승인 | 〃 | 200 · 403 · 404 · 409 · 500 |
| `POST …/cancel` | `quick_request.cancel` | 퀵 요청 취소 | 〃 | 200 · 400 · 403 · 404 · 409 · 500 |
| `POST …/openchat/resend` | `quick_request.openchat_resend` | 퀵 오픈채팅 재발송 | 〃 | 200 · 400 · 403 · 404 · 409 · 500 |
| 기존 `users` 승인·수정 Route | `user.approve` / `user.update` (기존) | — | 소속 `dongbang` 변경도 기존 로그로 기록됨을 확인만 한다 |

- 자동 webhook 결과는 해당 action의 metadata `openchat: {event, status, attempts}`에 남긴다. 별도 로그 행은 없다.
- 최근 주소 서버 기록 결과는 `quick_request.create` metadata의 `recentAddressesRecorded`에 남긴다.
- 동방이 `proxy.ts`에서 403 받은 API 요청은 로그 대상이 아니다(Route 진입 전 차단, 기존 proxy 401/403과 동일).

---

## 영향 파일 & 패턴

| 팀 | 파일 |
|---|---|
| BE | `supabase/sql/89_quick_requests_workflow.sql`(신규), `proxy.ts`, `src/lib/supabase/middleware.ts`(필드 확인), `src/config/dongbang-routes.ts`(신규), `src/features/auth/api/quick-access.server.ts`(신규), `src/features/auth/api/session.server.ts`(`requireDashboardSession` 2차 방어), `src/app/api/quick-request/route.ts`(신규), `src/app/api/quick-request/[requestNo]/**`(신규), `src/app/api/quick-request/notify/route.ts`(**삭제**), `src/app/api/quick-request/_utils.ts`, `src/features/quick-request/api/service.server.ts`, `src/features/quick-request/lib/openchat-webhook.server.ts`·`openchat-message.ts`(신규), `src/features/quick-request/schemas/*`(create·patch·dispatch·cancel), `src/features/notifications/api/fan-out.server.ts`(`listActiveUserIds` 동방 제외 + 퀵 2종), `src/features/notifications/api/labels.ts`, `src/features/activity-logs/labels.ts`, `src/app/api/users/[id]/approval/approve/route.ts`·`src/app/api/users/[id]/route.ts`(dongbang 시 조직 필드 null), `src/features/org-chart/api/service.server.ts`·`src/app/api/org-chart/route.ts`(`ORG_CHART_AFFILIATIONS`), 생일·Live·복지비 명단 쿼리(동방 제외), `.env.example` |
| FE | `src/features/users/constants/organization.ts`(`AFFILIATIONS`에 `dongbang`, `ORG_AFFILIATIONS` 분리, `Record<Affiliation>` 타입 영향 정리), `user-approval-sheet.tsx`·`user-form-sheet.tsx`·`user-org-form-fields.tsx`·`schemas/user.ts`, `src/config/nav-config.ts`, `src/contexts/nav-access.tsx`(동방 필터), `src/app/dashboard/quick/page.tsx`·`[requestNo]/page.tsx`·`loading.tsx`(신규), `src/features/quick-request/components/dashboard/**`·`detail/**`(신규), `quick-request-order-page.tsx`(확인 동작 교체), `api/{service,queries,mutations,keys,types}.ts`, `src/lib/searchparams.ts`(status·search), `DashboardPresenceTrack`(동방 skip) |
| verifier | `e2e/auth.dongbang.setup.ts`·`e2e/auth.logistics.setup.ts`(신규), `e2e/helpers/openchat-mock.ts`(신규, globalSetup), `e2e/quick-workflow/**`(신규), `e2e/quick-request/notify.api.spec.ts`(삭제), `order-page.spec.ts` AC-13·22(교체), `playwright.config.ts`(project·env), `e2e/global-teardown.ts`(quick_requests 정리) |

**따를 패턴:**
- plan 87 SQL 85: RLS 본인 select, 쓰기 revoke, service-role RPC
- plan 76: `affiliation+rank` 판별
- plan 40: filter shell
- plan 73: nuqs URL 필터와 debounce
- plan 14: AlertModal
- `jsonWithActivityLog`/`finishWithActivityLog`
- React Query `onSettled` invalidate(`quickRequestKeys.list/detail`)

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|---|---|---|
| HIGH | 동방 차단 누락(새 API·페이지 추가 시 구멍) | **allowlist** 방식(기본 거부)을 `proxy.ts` 한 곳에서 처리한다. layout에서 2차 redirect한다. RLS로 직접 조회도 막는다(announcements). AC-04·05·07 |
| HIGH | `Affiliation` 타입 확장 시 `Record<Affiliation, …>` 컴파일 오류가 연쇄된다(조직도·직급·부서) | `ORG_AFFILIATIONS`(3종)와 `AFFILIATIONS`(4종)를 분리한다. 조직 관련 Record는 `OrgAffiliation`으로 좁힌다. tsc를 체크포인트로 둔다 |
| HIGH | 외부 봇 미준비·비공식 봇 이용 정지 | 업무는 webhook과 독립적으로 진행한다(D-3). 「다시 보내기」·「메시지 복사」 fallback과 동방 인앱 알림으로 보완한다. 봇 운영 리스크는 사용자에게 고지(Out) |
| MED | 요청번호 경합·연도 경계(KST) | DB 원자 upsert, `Asia/Seoul` 연도, AC-10 동시 5건 |
| MED | 상태 경합(동방 2명 동시 접수) | 조건부 update + 409, webhook은 update 성공 후에만 보낸다. AC-21 |
| MED | webhook 지연으로 응답이 느려짐(최대 약 9초) | timeout 4초 × 2회. FE는 pending Spinner를 보여 준다. 응답이 늦어도 DB는 이미 커밋되어 있으므로 재클릭 중복 등록은 버튼 disable로 막는다 |
| MED | 수정 Sheet에서 86·87 섹션을 재사용하려면 react-hook-form 컨텍스트 결합도가 높다 | designer가 재사용 범위를 확정한다. 안 되면 상세 전용 경량 폼으로 대체하되 필드 집합은 동일하게 유지한다 |
| LOW | 기존 e2e(notify 501·복사) 깨짐 | 이번 plan에서 삭제·교체를 명시했다 |
| MED | plan 88(workflow-expense)과 병행 구현: SQL 번호·`notifications_type_check`·`labels.ts`·nav-config 동시 수정 충돌 | SQL 번호는 적용 직전 재확인. CHECK는 현재값 기반 재정의. 공용 파일은 append만 하고 merge 시 양쪽 항목 보존 |
| LOW | `middleware.ts`와 `proxy.ts`가 공존 | Next 16은 `proxy.ts`를 사용한다. backend-dev가 `middleware.ts`의 사용 여부를 확인하고, 미사용이면 손대지 않는다(삭제는 Out) |

**롤백:** SQL 89는 신규 테이블·함수·정책 위주라 drop 스크립트로 되돌릴 수 있다. CHECK는 `dongbang` 사용자가 0명일 때만 원복할 수 있다. FE·BE는 git revert로 되돌린다. Main DB에는 적용하지 않는다.

---

## Battle Plan (단계)

| # | 단계 | 산출물 | 확신도 | 의존 |
|---|---|---|---|---|
| 1 | designer: 대시보드·상세·수정 Sheet·Dialog·nav·승인 Sheet 설계 요약 | 설계 노트 | MED | — |
| 2 | BE: SQL 89 dev 적용(`apply_migration`) + 타입 | 테이블·RPC·RLS | HIGH | — |
| 3 | BE: 소속 확장 + 동방 allowlist(proxy·layout) + 명단 제외 + **tsc 체크포인트** | 게이트 | MED | 2 |
| 4 | BE: 퀵 Route 9종 + webhook 모듈 + 알림 + 로그 | API | MED | 2 |
| 5 | FE: 승인/수정 Sheet 소속, nav 필터 | UI | HIGH | 3 |
| 6 | FE: 대시보드·상세·Dialog·요청 화면 확인 교체 | UI | MED | 4 |
| 7 | verifier: auth 2종·mock webhook·spec → tsc·lint·build | green | MED | 5·6 |

**추정:** 신규·수정 파일 약 45~60개, 2,500~3,500줄. 복잡도 Complex. 체크포인트는 3단계(tsc 통과)와 4단계(API AC-08~28 curl 통과)다.

### 분할 판단
plan은 **하나로 유지**한다. 이유는 두 가지다.
1. 동방 소속·게이트(A)가 없으면 퀵 흐름(B~E)의 권한 AC를 검증할 수 없어 둘이 강하게 묶여 있다.
2. root가 연속으로 실행하므로 나눠도 이득이 작다.

대신 2차 범위(전체 기간 퀵 내역·CSV·Realtime 갱신)는 **후속 plan `[TBD]`**로 분리한다. 구현 중 3단계에서 막히면, A(소속·게이트)만 먼저 green으로 만든 뒤 B~E를 진행한다.

---

## 팀별 구현 순서

`designer` → `backend-dev`(SQL 89 → 게이트 → Route) → `frontend-dev` → `verifier`

## 검증 체크리스트 (verifier)

- [ ] SQL 89 dev 적용, `list_migrations` 확인, Main **미적용**
- [ ] AC-01~AC-39 spec 매핑(`e2e/quick-workflow/*.spec.ts`), mock webhook 기록 검증
- [ ] `notify.api.spec.ts` 삭제, `order-page.spec.ts` AC-13·22 교체 후 green
- [ ] `npx tsc --noEmit` · `npm run lint` · `npm run build`
- [ ] grep: `window.confirm` 0, `notify/route.ts` 없음, 신규 Route 로그 분기 누락 0

## 열린 질문

| # | 질문 | 기본값(답 없으면) |
|---|---|---|
| OQ-1 | 실제 오픈채팅 게시 봇은 누가 만들고, 어디서 운영하나요(URL·SECRET 발급) | `not_configured`로 운영. 봇이 준비되면 env만 설정 |
| OQ-2 | 개인정보처리방침에 외부 업체 접근을 반영할지 | 별도 plan |
| OQ-3 | 2차(전체 기간 내역·CSV) 착수 시점 | 후속 plan `[TBD]` |

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-21 | 최초 작성(번호 88 → **89**: 병행 plan 88 workflow-expense와 충돌해 변경, SQL도 89 이상). deep-interview Q1~Q6 답변과 root 확정 반영. 82·86·87 일부 supersede. Status Approved(/root 단일 게이트 규칙) | planner |
| 2026-10-22 | verifier 피드백(기획 문제) 반영: **AC-06** 정정 — `/api/profile`에는 GET 핸들러가 없어(PATCH만) `GET 200`이 성립하지 않으므로, profile은 「proxy 403 본문이 아님(Route 자체 응답 405/PATCH 기존 응답)」으로 바꾸고 notifications·activity-logs·quick-request·quick-request/summary는 200 유지. verifier가 수정한 사이드바 버그 기록: 접힌 상태에서 그룹 label이 메뉴 클릭을 가로챔 → `app-sidebar.tsx` `SidebarGroupLabel`에 `group-data-[collapsible=icon]:pointer-events-none` 추가. 구현·자동 검증(AC 39/39 PASS) 완료, 실제 봇 연결·사용자 수동 QA 남음 → Status **In Progress** | planner |
| 2026-10-22 | plan **92**가 오픈채팅 관련 결정을 supersede: D-1·D-2·D-3(webhook·재시도·미설정), D-13(메시지 복사), D-16(인앱 알림 수신자 → 92 §수신자 매트릭스), D-17, U-7, §webhook 계약·§env, `POST …/openchat/resend`, AC-11·12·13·14·35 폐기, AC-16·18·19·21·23·26·38의 webhook 판정 제거, Out 「Realtime 목록 자동 갱신」 번복(92 D-7), OQ-1 종료. 요청자가 접수 후 취소·변경을 부탁하던 오픈채팅 용도는 plan **93**(건별 채팅)이 대체. 상태 흐름·권한·allowlist·번호 발급은 유지 | planner |
| 2026-10-26 | 커밋 전 최종 확인(89·90·91 묶음): Status **In Progress 유지** — 오픈채팅 봇은 아직 미연결이며, webhook 잔여 항목은 plan 92(웹 알림 일원화)에서 정리 예정. 회귀 검증(build·tsc·lint·`e2e/quick-workflow`·`quick-info`·`quick-request`) 결과는 plan 91 수정 이력 참조 | verifier |
| 2026-10-27 | **오픈채팅 제거 완료(92)** — webhook 발송·재발송 Route·발송 패널·상태 배지·경고 토스트·메시지 복사·env·e2e mock·`quick_request_openchat_dispatches`(SQL 91 drop) 삭제. 알림은 WakeOne 인앱 단일 채널(92 §수신자 매트릭스·§문구표). 이 plan의 webhook 판정을 뺀 AC(08·10·16~34·36·37) 회귀 green(92 AC-23). legacy 라벨 `quick_request.openchat_resend`·metadata `openchat`만 유지 | verifier |
